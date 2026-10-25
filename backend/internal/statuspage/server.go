package statuspage

import (
	"crypto/tls"
	"io"
	"log"
	"net"
	"net/http"
	"net/netip"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/password"
)

const (
	// maxConnections is how many connections the page holds open at once;
	// more are closed right away.
	maxConnections = 64
	// maxClientConnections is how many of them one client may hold, so one
	// client cannot take them all and keep everyone else out. A browser
	// opens up to 6 to a site.
	maxClientConnections = 8
)

// Listen listens on addr for the page, over TLS with certs, with at most
// maxConnections connections open at once, and maxClientConnections of
// one client.
func Listen(addr string, certs *Certificates) (net.Listener, error) {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}
	config := &tls.Config{
		MinVersion:     tls.VersionTLS12,
		GetCertificate: certs.GetCertificate,
	}
	return tls.NewListener(newLimitListener(listener), config), nil
}

// NewServer returns the server for the page, with short time limits, as
// anyone on the internet can connect. The errors of connections that fail,
// such as from scanners that do not speak TLS, are not logged: they would
// fill the log.
func NewServer(page *Page) *http.Server {
	return &http.Server{
		Handler:           page.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       10 * time.Second,
		MaxHeaderBytes:    8 << 10,
		ErrorLog:          log.New(io.Discard, "", 0),
	}
}

// limitListener closes a new connection right away while maxConnections
// are open, or maxClientConnections of the client it comes from, so a flood
// of connections cannot hold up the program, and one client cannot hold
// every connection.
type limitListener struct {
	net.Listener

	mu sync.Mutex
	// open counts the open connections, and clients those of each client.
	open    int
	clients map[netip.Addr]int
}

func newLimitListener(listener net.Listener) *limitListener {
	return &limitListener{Listener: listener, clients: map[netip.Addr]int{}}
}

func (l *limitListener) Accept() (net.Conn, error) {
	for {
		conn, err := l.Listener.Accept()
		if err != nil {
			return nil, err
		}
		client := connClient(conn)
		if !l.take(client) {
			_ = conn.Close()
			continue
		}
		return &limitConn{Conn: conn, release: func() { l.release(client) }}, nil
	}
}

// take counts a new connection of client, and reports false, counting
// nothing, when it may not be open.
func (l *limitListener) take(client netip.Addr) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.open >= maxConnections || l.clients[client] >= maxClientConnections {
		return false
	}
	l.open++
	l.clients[client]++
	return true
}

func (l *limitListener) release(client netip.Addr) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.open--
	if l.clients[client]--; l.clients[client] <= 0 {
		delete(l.clients, client)
	}
}

// connClient is the client a connection comes from, as password.Client
// counts them; the zero address when it cannot be told.
func connClient(conn net.Conn) netip.Addr {
	addrPort, err := netip.ParseAddrPort(conn.RemoteAddr().String())
	if err != nil {
		return netip.Addr{}
	}
	return password.Client(addrPort.Addr())
}

type limitConn struct {
	net.Conn
	once    sync.Once
	release func()
}

func (c *limitConn) Close() error {
	err := c.Conn.Close()
	c.once.Do(c.release)
	return err
}
