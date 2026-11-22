package router

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gosnmp/gosnmp"

	"github.com/Programmer-Den/den-watcher/backend/internal/lan"
)

const (
	// snmpPort is where routers answer SNMP.
	snmpPort = 161
	// snmpTimeout is how long one SNMP request waits for its answer; it is
	// sent twice before the router counts as not answering.
	snmpTimeout = 1500 * time.Millisecond
	// snmpMaxRows is the most variables a walk reads: a table of 4096 rows
	// is far more than a router has.
	snmpMaxRows = 4096
)

// The BER tags SNMP uses.
const (
	tagInteger      = 0x02
	tagOctetString  = 0x04
	tagNull         = 0x05
	tagOID          = 0x06
	tagSequence     = 0x30
	tagIPAddress    = 0x40
	tagCounter32    = 0x41
	tagGauge32      = 0x42
	tagTimeTicks    = 0x43
	tagCounter64    = 0x46
	tagNoSuchObject = 0x80
	tagNoSuchInst   = 0x81
	tagEndOfMIB     = 0x82

	pduGet      = 0xa0
	pduResponse = 0xa2
	pduGetBulk  = 0xa5
	pduReport   = 0xa8
)

// snmpValue is the value of one variable in an answer.
type snmpValue struct {
	tag     byte
	number  uint64
	signed  int64
	text    string
	missing bool
}

// numeric returns the value as a number, for integers, counters, gauges and
// time ticks.
func (v snmpValue) numeric() (uint64, bool) {
	switch v.tag {
	case tagCounter32, tagGauge32, tagTimeTicks, tagCounter64:
		return v.number, true
	case tagInteger:
		if v.signed < 0 {
			return 0, false
		}
		return uint64(v.signed), true
	}
	return 0, false
}

// varbind is one variable of an SNMP answer.
type varbind struct {
	oid   string
	value snmpValue
}

// errTooManyRows ends a walk of a table larger than a router has.
var errTooManyRows = errors.New("too many rows")

// snmpClient asks a router over SNMP, v2c with a community or v3 with a
// user whose password authenticates (SHA) and encrypts (AES-128) every
// request. It only sends GET and GETBULK, which read; never SET.
type snmpClient struct {
	address   string
	host      string
	port      uint16
	community string
	// usm is the SNMPv3 user, nil for SNMPv2c.
	usm *gosnmp.UsmSecurityParameters

	mu sync.Mutex
	// session is the open connection, nil until the first request and
	// after a failed one, so the next one starts again (and an SNMPv3
	// router is asked for its engine again).
	session *gosnmp.GoSNMP
}

// newSNMPv2c returns a client of the router at address (host or
// host:port) with a community.
func newSNMPv2c(address, community string) *snmpClient {
	c := newSNMPClient(address)
	c.community = community
	return c
}

// newSNMPv3 returns a client of the router at address with a user and its
// password, used for both authentication and encryption.
func newSNMPv3(address, user, password string) *snmpClient {
	c := newSNMPClient(address)
	c.usm = &gosnmp.UsmSecurityParameters{
		UserName:                 user,
		AuthenticationProtocol:   gosnmp.SHA,
		AuthenticationPassphrase: password,
		PrivacyProtocol:          gosnmp.AES,
		PrivacyPassphrase:        password,
	}
	return c
}

func newSNMPClient(address string) *snmpClient {
	host, port := address, uint16(snmpPort)
	if h, p, err := net.SplitHostPort(address); err == nil {
		if n, err := strconv.ParseUint(p, 10, 16); err == nil {
			host, port = h, uint16(n)
		}
	}
	host = strings.Trim(host, "[]")
	return &snmpClient{address: net.JoinHostPort(host, strconv.Itoa(int(port))), host: host, port: port}
}

// newSession returns a session that is not connected yet.
func (c *snmpClient) newSession(ctx context.Context) *gosnmp.GoSNMP {
	session := &gosnmp.GoSNMP{
		Target: c.host, Port: c.port, Transport: "udp", Context: ctx,
		Timeout: snmpTimeout, Retries: 1,
		MaxOids: gosnmp.MaxOids, MaxRepetitions: 25,
		// Every connection goes to the local network only.
		Control: lan.Control,
		Version: gosnmp.Version2c, Community: c.community,
	}
	if c.usm != nil {
		session.Version = gosnmp.Version3
		session.SecurityModel = gosnmp.UserSecurityModel
		session.MsgFlags = gosnmp.AuthPriv
		session.SecurityParameters = c.usm.Copy()
	}
	return session
}

// get reads the variables named by oids.
func (c *snmpClient) get(ctx context.Context, oids ...string) ([]varbind, error) {
	var binds []varbind
	err := c.do(ctx, func(session *gosnmp.GoSNMP) error {
		packet, err := session.Get(oids)
		if err != nil {
			return err
		}
		if packet.Error != gosnmp.NoError {
			return fmt.Errorf("the router answered SNMP error %d", packet.Error)
		}
		for _, pdu := range packet.Variables {
			binds = append(binds, toVarbind(pdu))
		}
		return nil
	})
	return binds, err
}

// walk reads every variable below root, such as a column of a table.
func (c *snmpClient) walk(ctx context.Context, root string) ([]varbind, error) {
	var binds []varbind
	err := c.do(ctx, func(session *gosnmp.GoSNMP) error {
		binds = nil
		err := session.BulkWalk(root, func(pdu gosnmp.SnmpPDU) error {
			if len(binds) == snmpMaxRows {
				return errTooManyRows
			}
			binds = append(binds, toVarbind(pdu))
			return nil
		})
		if errors.Is(err, errTooManyRows) {
			return nil
		}
		return err
	})
	return binds, err
}

// do runs a request on the open connection, opening it first where needed,
// and closes it again when the request fails.
func (c *snmpClient) do(ctx context.Context, request func(*gosnmp.GoSNMP) error) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.session == nil {
		session := c.newSession(ctx)
		if err := session.Connect(); err != nil {
			return fmt.Errorf("ask %s over SNMP: %w", c.address, err)
		}
		c.session = session
	}
	c.session.Context = ctx
	err := request(c.session)
	if err != nil {
		_ = c.session.Conn.Close()
		c.session = nil
		return c.explain(ctx, err)
	}
	return nil
}

// explain turns an error of an SNMP request into one that says what to do.
func (c *snmpClient) explain(ctx context.Context, err error) error {
	switch {
	case ctx.Err() != nil:
		return fmt.Errorf("ask %s over SNMP: %w", c.address, ctx.Err())
	case errors.Is(err, gosnmp.ErrUnknownUsername):
		return errors.New("the router does not know the SNMPv3 user")
	case errors.Is(err, gosnmp.ErrWrongDigest):
		return errors.New("the router refused the SNMPv3 password; check it, and that the user authenticates with SHA (SHA-1)")
	case errors.Is(err, gosnmp.ErrDecryption):
		return errors.New("the router could not decrypt the request; the SNMPv3 user must encrypt with AES (AES-128)")
	case errors.Is(err, gosnmp.ErrUnknownSecurityLevel):
		return errors.New("the SNMPv3 user must both authenticate (SHA) and encrypt (AES-128)")
	case errors.Is(err, gosnmp.ErrUnknownEngineID):
		return errors.New("the router's SNMP engine changed; it is asked again next time")
	case errors.Is(err, gosnmp.ErrMaxRetriesExceeded), errors.Is(err, syscall.ECONNREFUSED):
		return fmt.Errorf("the router %s does not answer SNMP; switch it on in its settings and check the community or user", c.address)
	case strings.Contains(err.Error(), "not authentic"):
		// A router answers a wrong password or an unknown user with a report
		// that is not signed, which the library does not tell apart from an
		// answer signed with another password.
		return errors.New("the router refused the SNMPv3 user or password, or its answer was not signed with them; check both, and that the user authenticates with SHA (SHA-1) and encrypts with AES (AES-128)")
	case strings.Contains(err.Error(), "OID not increasing"):
		return fmt.Errorf("the router %s answered an SNMP walk out of order", c.address)
	}
	return fmt.Errorf("ask %s over SNMP: %w", c.address, err)
}

// toVarbind turns a variable of gosnmp's into one of ours.
func toVarbind(pdu gosnmp.SnmpPDU) varbind {
	value := snmpValue{tag: byte(pdu.Type)}
	switch pdu.Type {
	case gosnmp.Integer:
		value.signed = gosnmp.ToBigInt(pdu.Value).Int64()
	case gosnmp.Counter32, gosnmp.Gauge32, gosnmp.TimeTicks, gosnmp.Counter64:
		number := gosnmp.ToBigInt(pdu.Value)
		if number.Sign() >= 0 && number.IsUint64() {
			value.number = number.Uint64()
		} else {
			value.number = math.MaxUint64
		}
	case gosnmp.OctetString:
		if b, ok := pdu.Value.([]byte); ok {
			value.text = string(b)
		}
	case gosnmp.ObjectIdentifier, gosnmp.IPAddress:
		if s, ok := pdu.Value.(string); ok {
			value.text = strings.TrimPrefix(s, ".")
		}
	case gosnmp.Null, gosnmp.NoSuchObject, gosnmp.NoSuchInstance, gosnmp.EndOfMibView:
		value.missing = true
	}
	return varbind{oid: strings.TrimPrefix(pdu.Name, "."), value: value}
}
