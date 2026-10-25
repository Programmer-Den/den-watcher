package statuspage

import (
	"errors"
	"io"
	"net"
	"testing"
	"time"
)

func TestOneClientCannotHoldEveryConnection(t *testing.T) {
	inner, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	listener := newLimitListener(inner)
	t.Cleanup(func() { _ = listener.Close() })
	accepted := make(chan net.Conn, maxConnections)
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			accepted <- conn
		}
	}()

	var dialed []net.Conn
	for range maxClientConnections + 1 {
		conn, err := net.Dial("tcp", inner.Addr().String())
		if err != nil {
			t.Fatalf("dial: %v", err)
		}
		t.Cleanup(func() { _ = conn.Close() })
		dialed = append(dialed, conn)
	}
	var held []net.Conn
	for range maxClientConnections {
		select {
		case conn := <-accepted:
			held = append(held, conn)
		case <-time.After(5 * time.Second):
			t.Fatalf("%d connections of one client accepted, want %d", len(held), maxClientConnections)
		}
	}
	// The one past the limit is closed: reading from it ends at once.
	last := dialed[maxClientConnections]
	_ = last.SetReadDeadline(time.Now().Add(5 * time.Second))
	if _, err := last.Read(make([]byte, 1)); !errors.Is(err, io.EOF) {
		t.Errorf("read from connection %d of one client = %v, want EOF: closed", maxClientConnections+1, err)
	}

	// Once one closes, the client may open another.
	_ = held[0].Close()
	conn, err := net.Dial("tcp", inner.Addr().String())
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	select {
	case <-accepted:
	case <-time.After(5 * time.Second):
		t.Error("a connection after one of the client closed was not accepted")
	}
}
