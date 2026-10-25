package statuspage

import (
	"net/netip"
	"strconv"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/password"
)

const (
	// requestsPerMinute is how many requests each client may send a minute.
	requestsPerMinute = 60
	// maxWrong is how many wrong passwords a client may send before it may
	// guess no more for lockout.
	maxWrong = 5
	// lockout is how long a client that sent maxWrong wrong passwords waits.
	lockout = 15 * time.Minute
	// maxWrongAll is how many wrong passwords all clients together may send
	// within allWindow, so many addresses guessing together get no more
	// guesses. Once it is reached, only a known browser, one that signed in
	// before, can sign in until the window ends, so guessing cannot keep the
	// owner out; visitors who are signed in already keep seeing the page.
	maxWrongAll = 50
	allWindow   = time.Hour
	// maxClients is how many clients are kept track of. Past it, new
	// clients may still ask, but not guess.
	maxClients = 10_000
	// sweepEvery is how often a full table of clients is swept of those
	// that need not be kept any more, so a client that is new while it is
	// full does not walk the whole table each time.
	sweepEvery = time.Minute
)

// limiter keeps track of how often each client asks and guesses.
type limiter struct {
	mu      sync.Mutex
	clients map[netip.Addr]*clientLimits
	// allStart is when the window of the wrong passwords of all clients
	// started, and allWrong how many were sent since.
	allStart time.Time
	allWrong int
	// swept is when the full table of clients was last swept.
	swept time.Time
}

type clientLimits struct {
	// minute is when the client's current minute of requests started, and
	// requests how many it sent since.
	minute   time.Time
	requests int
	// wrong is how many wrong passwords the client sent in a row, the last
	// one at lastWrong.
	wrong     int
	lastWrong time.Time
}

func newLimiter() *limiter {
	return &limiter{clients: map[netip.Addr]*clientLimits{}}
}

// allow reports whether the client at addr may send another request at now,
// and counts it.
func (l *limiter) allow(addr netip.Addr, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	c := l.client(addr, now)
	if c == nil {
		return true
	}
	if now.Sub(c.minute) >= time.Minute {
		c.minute, c.requests = now, 0
	}
	c.requests++
	return c.requests <= requestsPerMinute
}

// guess reports whether the client at addr may send a password at now, and
// counts it as wrong until refund or succeeded says otherwise. Counting it
// before it is checked keeps a client that sends many passwords at once from
// getting more guesses than maxWrong, as each is counted before the next
// asks. A known browser, one that signed in before, is not held up by the
// wrong passwords of all clients together, so they cannot keep its owner
// out, but still by its own.
func (l *limiter) guess(addr netip.Addr, now time.Time, known bool) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if now.Sub(l.allStart) >= allWindow {
		l.allStart, l.allWrong = now, 0
	}
	if l.allWrong >= maxWrongAll && !known {
		return false
	}
	c := l.client(addr, now)
	if c == nil {
		return false
	}
	if c.wrong >= maxWrong && now.Sub(c.lastWrong) >= lockout {
		c.wrong = 0
	}
	if c.wrong >= maxWrong {
		return false
	}
	c.wrong++
	c.lastWrong = now
	l.allWrong++
	return true
}

// refund takes back a guess of the client at addr that was not checked, as
// no password is set or the check failed.
func (l *limiter) refund(addr netip.Addr) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.allWrong = max(l.allWrong-1, 0)
	if c := l.clients[password.Client(addr)]; c != nil {
		c.wrong = max(c.wrong-1, 0)
	}
}

// succeeded takes back the right guess of the client at addr, and forgets
// its wrong ones.
func (l *limiter) succeeded(addr netip.Addr) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.allWrong = max(l.allWrong-1, 0)
	if c := l.clients[password.Client(addr)]; c != nil {
		c.wrong = 0
	}
}

// client returns what is kept of the client at addr, keeping track of it
// from now on; nil when too many clients are kept track of already.
func (l *limiter) client(addr netip.Addr, now time.Time) *clientLimits {
	key := password.Client(addr)
	if c := l.clients[key]; c != nil {
		return c
	}
	if len(l.clients) >= maxClients && now.Sub(l.swept) >= sweepEvery {
		l.swept = now
		for k, c := range l.clients {
			if now.Sub(c.minute) >= time.Minute && now.Sub(c.lastWrong) >= lockout {
				delete(l.clients, k)
			}
		}
	}
	if len(l.clients) >= maxClients {
		return nil
	}
	c := &clientLimits{minute: now}
	l.clients[key] = c
	return c
}

// retryAfter is d as the seconds of a Retry-After header.
func retryAfter(d time.Duration) string {
	return strconv.Itoa(int(d / time.Second))
}
