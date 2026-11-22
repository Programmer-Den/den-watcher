package router

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha1" //nolint:gosec // SNMPv3's HMAC-SHA-96 (RFC 3414), which routers speak
	"encoding/binary"
	"errors"
	"fmt"
	"time"
)

// The SNMPv3 side of the fake agent the tests ask: it is written apart from
// the library the reader uses, by the RFCs, so the tests check that the
// reader speaks SNMPv3 as a router expects.

// snmpMaxMessage is the largest SNMP message the fake agent reads.
const snmpMaxMessage = 65507

// The USM reports an agent answers a request it does not take with
// (RFC 3414).
const (
	usmUnknownUser   = "1.3.6.1.6.3.15.1.1.3.0"
	usmNotInTime     = "1.3.6.1.6.3.15.1.1.2.0"
	usmUnknownEngine = "1.3.6.1.6.3.15.1.1.4.0"
	usmWrongDigest   = "1.3.6.1.6.3.15.1.1.5.0"
)

// fakeEngine is the fake agent's SNMPv3 engine and the keys of its user.
type fakeEngine struct {
	user             string
	authKey, privKey []byte
	salt             uint64
	engineID         []byte
	boots            int64
	engineTime       int64
	timeAt           time.Time
}

// passwordToKey turns a password into a key as RFC 3414 A.2.2 does for
// SHA: the hash of the password repeated to one megabyte.
func passwordToKey(password string) []byte {
	if password == "" {
		return nil
	}
	hash := sha1.New() //nolint:gosec // RFC 3414's key
	block := make([]byte, 64)
	for i, done := 0, 0; done < 1<<20; done += 64 {
		for j := range block {
			block[j] = password[i%len(password)]
			i++
		}
		hash.Write(block)
	}
	return hash.Sum(nil)
}

// localizeKey ties a key to the router's engine (RFC 3414 A.2.2).
func localizeKey(key, engineID []byte) []byte {
	hash := sha1.New() //nolint:gosec // RFC 3414's key
	hash.Write(key)
	hash.Write(engineID)
	hash.Write(key)
	return hash.Sum(nil)
}

// v3Message is the parts of an SNMPv3 answer.
type v3Message struct {
	msgID      int64
	flags      byte
	engineID   []byte
	boots      int64
	engineTime int64
	user       string
	// authStart is where the 12 bytes of the authentication code are in
	// the whole message.
	authParams []byte
	authStart  int
	privParams []byte
	data       []byte // the scoped PDU, or encrypted
	dataTag    byte
	dataStart  int
}

func parseV3(message []byte) (v3Message, error) {
	var m v3Message
	outer := &berReader{data: message}
	content, start, err := outer.expect(tagSequence)
	if err != nil {
		return m, err
	}
	r := inside(content, start)
	if version, err := r.integer(); err != nil || version != 3 {
		return m, fmt.Errorf("%w: not an SNMPv3 answer", errBER)
	}
	global, globalStart, err := r.expect(tagSequence)
	if err != nil {
		return m, err
	}
	g := inside(global, globalStart)
	if m.msgID, err = g.integer(); err != nil {
		return m, err
	}
	if _, err := g.integer(); err != nil {
		return m, err
	}
	flags, _, err := g.expect(tagOctetString)
	if err != nil || len(flags) != 1 {
		return m, errBER
	}
	m.flags = flags[0]
	security, securityStart, err := r.expect(tagOctetString)
	if err != nil {
		return m, err
	}
	sOuter := inside(security, securityStart)
	params, paramsStart, err := sOuter.expect(tagSequence)
	if err != nil {
		return m, err
	}
	s := inside(params, paramsStart)
	if m.engineID, _, err = s.expect(tagOctetString); err != nil {
		return m, err
	}
	if m.boots, err = s.integer(); err != nil {
		return m, err
	}
	if m.engineTime, err = s.integer(); err != nil {
		return m, err
	}
	user, _, err := s.expect(tagOctetString)
	if err != nil {
		return m, err
	}
	m.user = string(user)
	if m.authParams, m.authStart, err = s.expect(tagOctetString); err != nil {
		return m, err
	}
	if m.privParams, _, err = s.expect(tagOctetString); err != nil {
		return m, err
	}
	m.dataTag, m.data, m.dataStart, err = r.next()
	return m, err
}

// encodeV3 wraps a PDU into an SNMPv3 message, encrypted and authenticated
// with the user's keys.
func (c *fakeEngine) encodeV3(pdu []byte, id int32) ([]byte, error) {
	boots, engineTime := c.boots, c.engineTime+int64(time.Since(c.timeAt)/time.Second)
	scoped := berSequence(tagSequence, berOctets(c.engineID), berOctets(nil), pdu)
	c.salt++
	salt := binary.BigEndian.AppendUint64(nil, c.salt)
	encrypted, err := aesCFB(c.privKey, boots, engineTime, salt, scoped, true)
	if err != nil {
		return nil, err
	}
	before := bytes.Join([][]byte{berOctets(c.engineID), berInteger(boots), berInteger(engineTime), berOctets([]byte(c.user))}, nil)
	params := bytes.Join([][]byte{before, berOctets(make([]byte, 12)), berOctets(salt)}, nil)
	security := berElement(tagSequence, params)
	// Where the 12 bytes of the authentication code start in security:
	// after its header, the parameters before them and their own header.
	within := len(security) - len(params) + len(before) + 2
	message := berSequence(tagSequence,
		berInteger(3),
		// Authenticated, encrypted and reportable.
		berSequence(tagSequence, berInteger(int64(id)), berInteger(snmpMaxMessage), berOctets([]byte{0x07}), berInteger(3)),
		berOctets(security),
		berOctets(encrypted),
	)
	at := bytes.Index(message, security)
	if at < 0 {
		return nil, errors.New("encode the SNMPv3 request")
	}
	copy(message[at+within:], authCode(c.authKey, message))
	return message, nil
}

// authCode is HMAC-SHA-96: the first 12 bytes of HMAC-SHA1.
func authCode(key, message []byte) []byte {
	mac := hmac.New(sha1.New, key)
	mac.Write(message)
	return mac.Sum(nil)[:12]
}

// aesCFB encrypts or decrypts with AES-128 in CFB mode as RFC 3826 does:
// the IV is the engine's boots and time and the 8 bytes of salt.
func aesCFB(key []byte, boots, engineTime int64, salt, data []byte, encrypt bool) ([]byte, error) {
	if len(salt) != 8 || len(key) < 16 {
		return nil, errors.New("the SNMPv3 encryption parameters are not valid")
	}
	block, err := aes.NewCipher(key[:16])
	if err != nil {
		return nil, err
	}
	iv := binary.BigEndian.AppendUint32(nil, uint32(boots))    //nolint:gosec // 32 bits by the RFC
	iv = binary.BigEndian.AppendUint32(iv, uint32(engineTime)) //nolint:gosec // 32 bits by the RFC
	iv = append(iv, salt...)
	out := make([]byte, len(data))
	if encrypt {
		cipher.NewCFBEncrypter(block, iv).XORKeyStream(out, data) //nolint:staticcheck // CFB is what RFC 3826 requires
	} else {
		cipher.NewCFBDecrypter(block, iv).XORKeyStream(out, data) //nolint:staticcheck // CFB is what RFC 3826 requires
	}
	return out, nil
}
