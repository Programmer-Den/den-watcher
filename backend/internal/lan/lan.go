// Package lan tells which addresses belong to the local network, so the
// website only answers it and the hub only talks to it.
package lan

import (
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// prefixesRefresh is how long the machine's own IPv6 subnets are kept before
// the network interfaces are read again; a provider may hand out a new prefix
// every day.
const prefixesRefresh = time.Minute

// systemAddrs lists the machine's addresses as the system tells them; tests
// replace it.
var systemAddrs = net.InterfaceAddrs

// told are the machine's addresses as SetAddresses was told them; nil
// before.
var told atomic.Pointer[[]net.Addr]

// SetAddresses tells the machine's addresses, each with its subnet, for a
// system that does not let the program list them itself: Android 11 and
// later refuse that to apps, so the Android hub app passes what Android
// tells it, again whenever they may have changed. See InterfaceAddrs.
func SetAddresses(addrs []net.Addr) {
	told.Store(&addrs)
}

// InterfaceAddrs lists the machine's addresses as net.InterfaceAddrs does.
// Where the system refuses that, it lists the ones SetAddresses was told
// last, if it was told any.
func InterfaceAddrs() ([]net.Addr, error) {
	addrs, err := systemAddrs()
	if err != nil {
		if list := told.Load(); list != nil {
			return *list, nil
		}
	}
	return addrs, err
}

// Checker decides whether an address is on the local network. Loopback,
// private (RFC 1918 and IPv6 unique local) and link-local addresses always
// are. A global IPv6 address is too when it lies in the subnet of one of the
// machine's own addresses: devices on a home network with IPv6 from the
// provider carry such global addresses, not private ones.
type Checker struct {
	// Interfaces lists the machine's addresses; InterfaceAddrs when nil.
	Interfaces func() ([]net.Addr, error)

	mu        sync.Mutex
	prefixes  []netip.Prefix
	refreshed time.Time
}

// Default checks against the machine's own network interfaces.
var Default = &Checker{}

// Local reports whether addr is on the local network.
func (c *Checker) Local(addr netip.Addr) bool {
	addr = addr.Unmap()
	if addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast() {
		return true
	}
	if !addr.Is6() || !addr.IsGlobalUnicast() {
		return false
	}
	for _, prefix := range c.ownPrefixes() {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

// LocalAddrPort reports whether the address of a connection, as host:port, is
// on the local network. An address that cannot be read is not.
func (c *Checker) LocalAddrPort(address string) bool {
	addrPort, err := netip.ParseAddrPort(address)
	if err != nil {
		return false
	}
	return c.Local(addrPort.Addr())
}

// Control is a net.Dialer's Control that refuses to connect to an address
// outside the local network, even when a host name resolves to one, so the
// hub only ever talks to its own network, as the website only answers it.
func Control(_, address string, _ syscall.RawConn) error {
	if !Default.LocalAddrPort(address) {
		return fmt.Errorf("%s is not on the local network", address)
	}
	return nil
}

// ownPrefixes returns the subnets of the machine's global IPv6 addresses,
// reading the interfaces at most once per prefixesRefresh.
func (c *Checker) ownPrefixes() []netip.Prefix {
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.refreshed) < prefixesRefresh {
		return c.prefixes
	}
	list := c.Interfaces
	if list == nil {
		list = InterfaceAddrs
	}
	addrs, err := list()
	if err != nil {
		// Keep what is known; the next check reads the interfaces again.
		return c.prefixes
	}
	c.prefixes = globalPrefixes(addrs)
	c.refreshed = time.Now()
	return c.prefixes
}

// globalPrefixes returns the subnets of the global IPv6 addresses among addrs.
func globalPrefixes(addrs []net.Addr) []netip.Prefix {
	var prefixes []netip.Prefix
	for _, a := range addrs {
		ipNet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		addr, ok := netip.AddrFromSlice(ipNet.IP)
		if !ok {
			continue
		}
		addr = addr.Unmap()
		bits, _ := ipNet.Mask.Size()
		if !addr.Is6() || !addr.IsGlobalUnicast() || bits == 0 {
			continue
		}
		prefixes = append(prefixes, netip.PrefixFrom(addr, bits).Masked())
	}
	return prefixes
}

// NewClient returns an HTTP client for a device on the local network, with
// control checking each address it connects to: no proxy, and no redirect,
// which could lead off the local network.
func NewClient(control func(network, address string, c syscall.RawConn) error, timeout time.Duration) *http.Client {
	dialer := &net.Dialer{Timeout: timeout, Control: control}
	return &http.Client{
		Timeout:       timeout,
		Transport:     &http.Transport{DialContext: dialer.DialContext, MaxIdleConnsPerHost: 1},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}
