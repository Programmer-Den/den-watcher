// Package statuspage serves the remote status page: a minimal page, on a
// port of its own, that tells whether each device is online and how many
// alerts it has, and nothing else. It is meant to be reachable from the
// internet, so it answers only over HTTPS, shows the devices only after the
// password is given, and limits how often each client may ask and guess.
package statuspage

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"log/slog"
	"net/http"
	"net/netip"
	"net/url"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/password"
)

// State tells whether a device answers.
type State string

const (
	// Online is a device that answers, and the hub itself.
	Online State = "online"
	// Offline is a server that does not answer: an outage.
	Offline State = "offline"
	// Off is a PC or phone that does not answer, as it is switched off,
	// asleep or away: not in use, no outage.
	Off State = "off"
)

// Device is what the page shows of a device: its name, whether it answers
// and how many alerts it has, and nothing more.
type Device struct {
	Name   string
	State  State
	Alerts int
}

// Password guards the page. It is set and changed on the hub's own page.
type Password interface {
	IsSet(ctx context.Context) (bool, error)
	// Check checks the password sent from the client at from; each client
	// checks one at a time, and a wrong one is answered late.
	Check(ctx context.Context, from netip.Addr, password string) error
	Change(ctx context.Context, password string) error
}

const (
	// sessionCookie names the cookie that keeps a visitor signed in.
	sessionCookie = "status_session"
	// sessionLife is how long a visitor stays signed in.
	sessionLife = 30 * 24 * time.Hour
	// maxSessions is how many visitors may be signed in at once; signing in
	// past it ends the session that would end first.
	maxSessions = 100
	// maxFormBytes is the largest sign-in form.
	maxFormBytes = 4096
)

// Page is the remote status page.
type Page struct {
	devices  func() []Device
	password Password
	limits   *limiter
	// now is time.Now, but for the tests.
	now func() time.Time

	// mu guards sessions.
	mu sync.Mutex
	// sessions are the signed-in visitors: when each session ends, by the
	// SHA-256 of its cookie, so the cookies themselves are not kept.
	sessions map[[sha256.Size]byte]time.Time
}

// New returns the page, which shows devices once password is given.
func New(devices func() []Device, password Password) *Page {
	return &Page{
		devices:  devices,
		password: password,
		limits:   newLimiter(),
		now:      time.Now,
		sessions: map[[sha256.Size]byte]time.Time{},
	}
}

// PasswordSet reports whether the password has been chosen; until it is, the
// page shows no devices.
func (p *Page) PasswordSet(ctx context.Context) (bool, error) {
	return p.password.IsSet(ctx)
}

// ChangePassword sets the password, and signs out every visitor, so only
// the new one opens the page.
func (p *Page) ChangePassword(ctx context.Context, newPassword string) error {
	if err := p.password.Change(ctx, newPassword); err != nil {
		return err
	}
	p.mu.Lock()
	clear(p.sessions)
	p.mu.Unlock()
	return nil
}

// Handler returns the page's handler: GET / shows the devices to a signed-in
// visitor and asks everyone else for the password, POST /login signs in and
// POST /logout signs out. Every other path is not found.
func (p *Page) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", p.show)
	mux.HandleFunc("POST /login", p.login)
	mux.HandleFunc("POST /logout", p.logout)
	return withHeaders(p.limited(mux))
}

// limited answers 429 Too Many Requests to a client that asks too often.
func (p *Page) limited(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !p.limits.allow(clientOf(r), p.now()) {
			w.Header().Set("Retry-After", "60")
			http.Error(w, "too many requests; try again in a minute", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// show serves GET /: the devices, or the sign-in form.
func (p *Page) show(w http.ResponseWriter, r *http.Request) {
	text := messagesFor(r.Header.Get("Accept-Language"))
	if p.signedIn(r) {
		p.render(w, http.StatusOK, statusView(text, p.devices()))
		return
	}
	set, err := p.password.IsSet(r.Context())
	if err != nil {
		slog.Error("read whether the status page password is set", "error", err)
		p.render(w, http.StatusInternalServerError, loginView(text, text.Failed, false))
		return
	}
	if !set {
		p.render(w, http.StatusOK, loginView(text, text.NotSet, false))
		return
	}
	p.render(w, http.StatusOK, loginView(text, "", true))
}

// login serves POST /login: signs in with the password from the form.
func (p *Page) login(w http.ResponseWriter, r *http.Request) {
	text := messagesFor(r.Header.Get("Accept-Language"))
	if !sameOrigin(r) {
		http.Error(w, "sign in from the status page itself", http.StatusForbidden)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxFormBytes)
	if err := r.ParseForm(); err != nil {
		p.render(w, http.StatusBadRequest, loginView(text, text.Failed, true))
		return
	}
	client := clientOf(r)
	now := p.now()
	if !p.limits.guess(client, now) {
		w.Header().Set("Retry-After", retryAfter(lockout))
		p.render(w, http.StatusTooManyRequests, loginView(text, text.TooMany, true))
		return
	}
	err := p.password.Check(r.Context(), client, r.PostForm.Get("password"))
	switch {
	case errors.Is(err, password.ErrNotSet):
		p.limits.refund(client)
		p.render(w, http.StatusForbidden, loginView(text, text.NotSet, false))
		return
	case errors.Is(err, password.ErrWrong):
		p.render(w, http.StatusUnauthorized, loginView(text, text.Wrong, true))
		return
	case err != nil:
		p.limits.refund(client)
		slog.Error("check the status page password", "error", err)
		p.render(w, http.StatusInternalServerError, loginView(text, text.Failed, true))
		return
	}
	p.limits.succeeded(client)

	token, err := p.startSession(now)
	if err != nil {
		slog.Error("start a session on the status page", "error", err)
		p.render(w, http.StatusInternalServerError, loginView(text, text.Failed, true))
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionLife / time.Second),
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// logout serves POST /logout: ends the visitor's session.
func (p *Page) logout(w http.ResponseWriter, r *http.Request) {
	if !sameOrigin(r) {
		http.Error(w, "sign out from the status page itself", http.StatusForbidden)
		return
	}
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		p.mu.Lock()
		delete(p.sessions, sha256.Sum256([]byte(cookie.Value)))
		p.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// startSession returns the cookie of a new session that ends sessionLife
// after now.
func (p *Page) startSession(now time.Time) (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(random)

	p.mu.Lock()
	defer p.mu.Unlock()
	for key, ends := range p.sessions {
		if !now.Before(ends) {
			delete(p.sessions, key)
		}
	}
	if len(p.sessions) >= maxSessions {
		var first [sha256.Size]byte
		var firstEnds time.Time
		for key, ends := range p.sessions {
			if firstEnds.IsZero() || ends.Before(firstEnds) {
				first, firstEnds = key, ends
			}
		}
		delete(p.sessions, first)
	}
	p.sessions[sha256.Sum256([]byte(token))] = now.Add(sessionLife)
	return token, nil
}

// signedIn reports whether the request carries the cookie of a session that
// has not ended.
func (p *Page) signedIn(r *http.Request) bool {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return false
	}
	key := sha256.Sum256([]byte(cookie.Value))
	p.mu.Lock()
	defer p.mu.Unlock()
	ends, ok := p.sessions[key]
	if ok && !p.now().Before(ends) {
		delete(p.sessions, key)
		return false
	}
	return ok
}

// render writes the page from view.
func (p *Page) render(w http.ResponseWriter, status int, v view) {
	var body bytes.Buffer
	if err := pageTemplate.Execute(&body, v); err != nil {
		slog.Error("render the status page", "error", err)
		http.Error(w, "could not show the page", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(body.Bytes())
}

// sameOrigin reports whether a form was sent from this page rather than from
// another site. Browsers tell where a form was sent from in Sec-Fetch-Site,
// and older ones in Origin; a request with neither, from a program, has no
// cookie of a visitor to misuse.
func sameOrigin(r *http.Request) bool {
	if site := r.Header.Get("Sec-Fetch-Site"); site != "" {
		return site == "same-origin"
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && u.Host == r.Host
}

// clientOf returns the address of the TCP connection the request came on,
// not one from a header a client could fake.
func clientOf(r *http.Request) netip.Addr {
	addrPort, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return netip.Addr{}
	}
	return addrPort.Addr().Unmap()
}

// withHeaders adds the headers every answer carries. The page loads nothing
// but its own style, is never shown in a frame, never kept in a cache, never
// listed by a search engine and never tells another site where a visitor
// came from. Within the page, browsers still name it as the origin of its
// forms, which sameOrigin checks.
func withHeaders(next http.Handler) http.Handler {
	policy := "default-src 'none'; style-src '" + styleHash + "'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", policy)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("X-Robots-Tag", "noindex, nofollow")
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
