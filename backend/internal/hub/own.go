package hub

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"slices"
	"syscall"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/lan"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// errOwnAddress refuses to connect to an address of the hub itself.
var errOwnAddress = errors.New("the address is the hub's own")

// askNew asks a device about to be added for its usage once, as askOnce, with
// the hub's id and the pairing code, but refuses an address that is not
// addable, and a host name that resolves to one when it connects, at once
// and whatever the port. How long the answer took would otherwise tell which
// of the hub's own ports are open, including ones only it can reach. It
// returns the hub's own addresses it checked against, for start, which runs
// holding mu and so does not read them.
func (h *Hub) askNew(ctx context.Context, address, code string) ([]netip.Addr, error) {
	own := h.ownAddresses()
	// An IP address is checked before connecting, which may fail before the
	// check below, as with IPv6 on a machine without it.
	if host, _, err := net.SplitHostPort(address); err == nil {
		if ip, err := netip.ParseAddr(host); err == nil && !h.addable(ip, own) {
			return own, errOwnAddress
		}
	}
	agent := newAgent(address, h.refuseOwn(func() []netip.Addr { return own }))
	agent.hubID, agent.code = h.id, code
	_, err := askOnceWith(ctx, agent)
	return own, err
}

// refuseOwn returns the check of every address an agent of a device added on
// the page connects to: it refuses one that is not addable, with own listing
// more of the hub's addresses, besides lan.Control. A host name that
// resolves to the hub itself only after the device was added is refused
// too, so the hub does not tell which of its own ports are open.
func (h *Hub) refuseOwn(own func() []netip.Addr) func(network, address string, c syscall.RawConn) error {
	return func(network, address string, c syscall.RawConn) error {
		if addrPort, err := netip.ParseAddrPort(address); err == nil && !h.addable(addrPort.Addr(), own()) {
			return errOwnAddress
		}
		return lan.Control(network, address, c)
	}
}

// ownAddressesFor is how long the hub's own addresses are used again before
// they are read anew. A device added on the page is asked every few
// seconds, and each time its agent asks for them (see Agent.get), as does
// the check of each connection to it.
const ownAddressesFor = 5 * time.Second

// ownRetryAfter is how long after reading the hub's usage failed it is
// read again, so a usage that keeps failing does not hold up every request.
const ownRetryAfter = time.Second

// ownAddresses lists the hub's addresses besides those of its network
// interfaces: the host's in a container (see hostAddrs) and those of the
// network cards in its usage, which in a container are the machine's. Each
// part is read at most every ownAddressesFor; the usage sooner while it
// cannot be read, every ownRetryAfter, with the network cards read last
// kept meanwhile. The usage, which can take seconds, is read by one caller
// at a time without holding ownMu; the others go on with the network cards
// read last, or wait for the first reading when there are none yet; once
// that failed, they go on without them until they are read. When the list
// has an address it did not have before, ownGeneration counts up, so the
// agents of devices added on the page stop using the connections they kept
// open.
func (h *Hub) ownAddresses() []netip.Addr {
	h.ownMu.Lock()
	if h.hostRead.IsZero() || time.Since(h.hostRead) >= ownAddressesFor {
		if h.hostAddrs != nil {
			h.host = h.hostAddrs()
		} else {
			h.host = metrics.HostAddresses()
		}
		h.hostRead = time.Now()
	}
	read := false
	var wait chan struct{}
	if h.local != nil && (h.cardsRead.IsZero() || time.Since(h.cardsRead) >= ownAddressesFor) &&
		(h.cardsFailed.IsZero() || time.Since(h.cardsFailed) >= ownRetryAfter) {
		switch {
		case h.reading == nil:
			h.reading, read = make(chan struct{}), true
		case h.cardsRead.IsZero() && h.cardsFailed.IsZero():
			wait = h.reading
		}
	}
	h.ownMu.Unlock()
	switch {
	case read:
		snapshot, err := h.local.Collect(h.ctx)
		h.ownMu.Lock()
		if err == nil {
			h.cards, h.cardsRead, h.cardsFailed = NetworkAddresses(snapshot), time.Now(), time.Time{}
		} else {
			h.cardsFailed = time.Now()
		}
		close(h.reading)
		h.reading = nil
		h.ownMu.Unlock()
	case wait != nil:
		<-wait
	}

	h.ownMu.Lock()
	defer h.ownMu.Unlock()
	own := slices.Concat(h.host, h.cards)
	if h.owned && slices.ContainsFunc(own, func(addr netip.Addr) bool { return !slices.Contains(h.own, addr) }) {
		h.ownGeneration++
	}
	h.own, h.owned = own, true
	return own
}

// ownGenerationNow reads the hub's own addresses (see ownAddresses) and
// returns how often they gained one, which an agent of a device added on
// the page asks before each request, when it would use a connection kept
// open and when it opens one; see Agent.get.
func (h *Hub) ownGenerationNow() uint64 {
	h.ownAddresses()
	h.ownMu.Lock()
	defer h.ownMu.Unlock()
	return h.ownGeneration
}

// pageAgent returns the Agent of a device added on the page, which checks
// every address it connects to against the hub's own (see refuseOwn) and
// does not use a connection it kept open from before they gained one.
func (h *Hub) pageAgent(address string) *Agent {
	agent := newAgent(address, h.refuseOwn(h.ownAddresses))
	agent.checkOwnGeneration(h.ownGenerationNow)
	return agent
}

// NetworkAddresses lists the addresses of the network cards in a machine's
// usage. In a container, the machine's own addresses are not the
// container's, but its usage lists them.
func NetworkAddresses(snapshot metrics.Snapshot) []netip.Addr {
	var addresses []netip.Addr
	for _, network := range snapshot.Network {
		for _, address := range network.Addresses {
			if addr, err := netip.ParseAddr(address); err == nil {
				addresses = append(addresses, addr.Unmap())
			}
		}
	}
	return addresses
}

// addable reports whether a device can be added at addr: not one of the
// hub's own addresses (see suggester.isOwn; own lists the ones its network
// interfaces do not have, such as the host's in a container), nor a
// loopback or unspecified one, which is the hub itself, nor a link-local
// IPv6 one, which would need a zone to be reached. Other addresses on the
// local network can be added, link-local IPv4 ones too, as of a device
// cabled straight to the hub.
func (h *Hub) addable(addr netip.Addr, own []netip.Addr) bool {
	addr = addr.Unmap().WithZone("")
	if addr.IsLoopback() && h.allowLoopback {
		return true
	}
	return !addr.IsLoopback() && !addr.IsUnspecified() && (addr.Is4() || !addr.IsLinkLocalUnicast()) && !h.suggester.isOwn(addr, own)
}

// addableAddress reports whether a device can be added at address
// (host:port), as far as an IP address tells, with own listing more of the
// hub's addresses (see ownAddresses): a host name is checked only when it
// is connected to.
func (h *Hub) addableAddress(address string, own []netip.Addr) bool {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err != nil || h.addable(ip, own)
}
