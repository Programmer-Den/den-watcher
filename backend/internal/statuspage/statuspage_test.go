package statuspage

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/password"
)

// fakePassword answers at once, without the wait of the real one.
type fakePassword struct {
	mu   sync.Mutex
	word string
	// wrongDelay is how late a wrong password is answered, as the real one
	// does.
	wrongDelay time.Duration
}

func (f *fakePassword) IsSet(context.Context) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.word != "", nil
}

func (f *fakePassword) Check(_ context.Context, _ netip.Addr, given string) error {
	f.mu.Lock()
	word, delay := f.word, f.wrongDelay
	f.mu.Unlock()
	switch {
	case word == "":
		return password.ErrNotSet
	case given != word:
		time.Sleep(delay)
		return password.ErrWrong
	}
	return nil
}

func (f *fakePassword) Change(_ context.Context, word string) error {
	if err := password.CheckNew(word); err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.word = word
	return nil
}

var testDevices = []Device{
	{Name: "", State: Online, Alerts: 0},
	{Name: "NAS <b>", State: Offline, Alerts: 2},
	{Name: "Office PC", State: Off, Alerts: 1},
}

func newTestPage(t *testing.T, word string) (*Page, http.Handler) {
	t.Helper()
	page := New(func() []Device { return testDevices }, &fakePassword{word: word})
	return page, page.Handler()
}

// send sends a request from the client at from, with the cookie when it is
// not empty.
func send(h http.Handler, method, target, from, cookie string, form url.Values) *httptest.ResponseRecorder {
	var body *strings.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	} else {
		body = strings.NewReader("")
	}
	r := httptest.NewRequest(method, target, body)
	r.RemoteAddr = from + ":40000"
	if form != nil {
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if cookie != "" {
		r.AddCookie(&http.Cookie{Name: sessionCookie, Value: cookie}) //nolint:gosec // a cookie the test sends, not one set
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func signIn(t *testing.T, h http.Handler, from, word string) string {
	t.Helper()
	w := send(h, http.MethodPost, "https://status.example/login", from, "", url.Values{"password": {word}})
	if w.Code != http.StatusSeeOther {
		t.Fatalf("POST /login = %d, want 303; body %s", w.Code, w.Body)
	}
	for _, c := range w.Result().Cookies() {
		if c.Name == sessionCookie {
			if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteStrictMode {
				t.Errorf("session cookie %+v, want Secure, HttpOnly and SameSite=Strict", c)
			}
			return c.Value
		}
	}
	t.Fatal("POST /login set no session cookie")
	return ""
}

func TestTheDevicesShowOnlyAfterSigningIn(t *testing.T) {
	_, h := newTestPage(t, "correct horse")

	w := send(h, http.MethodGet, "/", "203.0.113.5", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `name="password"`) {
		t.Fatalf("GET / signed out = %d, want the sign-in form; body %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "Office PC") {
		t.Fatal("GET / signed out shows a device")
	}

	w = send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {"wrong one"}})
	if w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "The password is wrong.") {
		t.Errorf("POST /login with a wrong password = %d, want 401 saying so; body %s", w.Code, w.Body)
	}

	cookie := signIn(t, h, "203.0.113.5", "correct horse")
	body := send(h, http.MethodGet, "/", "203.0.113.5", cookie, nil).Body.String()
	for _, want := range []string{"Host Hub", "NAS &lt;b&gt;", "Office PC", "1 of 3 online", "Offline", "Switched off", "2 alerts", "1 alert", "No alerts", `http-equiv="refresh"`} {
		if !strings.Contains(body, want) {
			t.Errorf("signed-in page lacks %q; body %s", want, body)
		}
	}

	if w := send(h, http.MethodPost, "/logout", "203.0.113.5", cookie, url.Values{}); w.Code != http.StatusSeeOther {
		t.Fatalf("POST /logout = %d, want 303", w.Code)
	}
	if body := send(h, http.MethodGet, "/", "203.0.113.5", cookie, nil).Body.String(); strings.Contains(body, "Office PC") {
		t.Error("the page still shows the devices after signing out")
	}
}

func TestWithoutAPasswordNobodyCanSignIn(t *testing.T) {
	_, h := newTestPage(t, "")
	w := send(h, http.MethodGet, "/", "203.0.113.5", "", nil)
	if strings.Contains(w.Body.String(), `name="password"`) || !strings.Contains(w.Body.String(), "No password is set yet") {
		t.Errorf("GET / without a password: body %s, want no form and why", w.Body)
	}
	w = send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {""}})
	if w.Code != http.StatusForbidden {
		t.Errorf("POST /login without a password = %d, want 403", w.Code)
	}
}

func TestChangingThePasswordSignsEveryoneOut(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	cookie := signIn(t, h, "203.0.113.5", "correct horse")

	if err := page.ChangePassword(context.Background(), "battery staple"); err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
	if body := send(h, http.MethodGet, "/", "203.0.113.5", cookie, nil).Body.String(); strings.Contains(body, "Office PC") {
		t.Error("an old session still shows the devices after the password changed")
	}
	signIn(t, h, "203.0.113.5", "battery staple")
}

func TestASessionEnds(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	page.now = func() time.Time { return now }
	cookie := signIn(t, h, "203.0.113.5", "correct horse")

	now = now.Add(sessionLife)
	if body := send(h, http.MethodGet, "/", "203.0.113.5", cookie, nil).Body.String(); strings.Contains(body, "Office PC") {
		t.Error("a session still shows the devices once it ended")
	}
}

func TestWrongPasswordsLockAClientOut(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	page.now = func() time.Time { return now }

	for range maxWrong {
		send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {"guess"}})
	}
	w := send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {"correct horse"}})
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("POST /login after %d wrong passwords = %d, want 429", maxWrong, w.Code)
	}
	// Another client is not held up.
	signIn(t, h, "198.51.100.7", "correct horse")

	now = now.Add(lockout)
	signIn(t, h, "203.0.113.5", "correct horse")
}

func TestGuessesSentAtOnceCountBeforeTheyAreAnswered(t *testing.T) {
	page := New(func() []Device { return testDevices }, &fakePassword{word: "correct horse", wrongDelay: 50 * time.Millisecond})
	h := page.Handler()

	const sent = 20
	codes := make(chan int, sent)
	var wg sync.WaitGroup
	for range sent {
		wg.Go(func() {
			codes <- send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {"guess"}}).Code
		})
	}
	wg.Wait()
	close(codes)
	checked := 0
	for code := range codes {
		if code == http.StatusUnauthorized {
			checked++
		}
	}
	if checked != maxWrong {
		t.Errorf("%d of %d guesses sent at once were checked, want %d", checked, sent, maxWrong)
	}
}

func TestARightPasswordOrNoneDoesNotUseUpGuesses(t *testing.T) {
	page, h := newTestPage(t, "")
	for range maxWrong + 1 {
		send(h, http.MethodPost, "/login", "203.0.113.5", "", url.Values{"password": {"guess"}})
	}
	if err := page.ChangePassword(context.Background(), "correct horse"); err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}
	for range maxWrongAll + 1 {
		signIn(t, h, "198.51.100.7", "correct horse")
	}
	signIn(t, h, "203.0.113.5", "correct horse")
}

func TestWrongPasswordsFromManyClientsStopAllGuesses(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	page.now = func() time.Time { return now }

	for i := range maxWrongAll {
		from := netip.AddrFrom4([4]byte{203, 0, 113, byte(i)}).String()
		send(h, http.MethodPost, "/login", from, "", url.Values{"password": {"guess"}})
	}
	if w := send(h, http.MethodPost, "/login", "198.51.100.7", "", url.Values{"password": {"correct horse"}}); w.Code != http.StatusTooManyRequests {
		t.Fatalf("POST /login after %d wrong passwords from many clients = %d, want 429", maxWrongAll, w.Code)
	}
	now = now.Add(allWindow)
	signIn(t, h, "198.51.100.7", "correct horse")
}

func TestAClientThatAsksTooOftenWaits(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	page.now = func() time.Time { return now }

	for i := range requestsPerMinute {
		if w := send(h, http.MethodGet, "/", "2001:db8::1", "", nil); w.Code != http.StatusOK {
			t.Fatalf("request %d = %d, want 200", i+1, w.Code)
		}
	}
	if w := send(h, http.MethodGet, "/", "2001:db8::2", "", nil); w.Code != http.StatusTooManyRequests {
		t.Errorf("request %d from the same /64 = %d, want 429", requestsPerMinute+1, w.Code)
	}
	now = now.Add(time.Minute)
	if w := send(h, http.MethodGet, "/", "2001:db8::1", "", nil); w.Code != http.StatusOK {
		t.Errorf("request a minute later = %d, want 200", w.Code)
	}
}

func TestOnlyThePageIsServed(t *testing.T) {
	_, h := newTestPage(t, "correct horse")
	for _, target := range []string{"/api/devices", "/index.html", "/login", "/favicon.ico"} {
		if w := send(h, http.MethodGet, target, "203.0.113.5", "", nil); w.Code != http.StatusNotFound && w.Code != http.StatusMethodNotAllowed {
			t.Errorf("GET %s = %d, want 404 or 405", target, w.Code)
		}
	}
}

func TestAFormFromAnotherSiteIsRefused(t *testing.T) {
	_, h := newTestPage(t, "correct horse")
	for _, tt := range []struct {
		headers map[string]string
		want    int
	}{
		{map[string]string{"Origin": "https://evil.example"}, http.StatusForbidden},
		{map[string]string{"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}, http.StatusForbidden},
		{map[string]string{"Sec-Fetch-Site": "same-site"}, http.StatusForbidden},
		{map[string]string{"Origin": "https://status.example"}, http.StatusSeeOther},
		// Browsers send Origin: null with a strict Referrer-Policy.
		{map[string]string{"Sec-Fetch-Site": "same-origin", "Origin": "null"}, http.StatusSeeOther},
	} {
		r := httptest.NewRequest(http.MethodPost, "https://status.example/login", strings.NewReader("password=correct+horse"))
		r.RemoteAddr = "203.0.113.5:40000"
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		for name, value := range tt.headers {
			r.Header.Set(name, value)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tt.want {
			t.Errorf("POST /login with %v = %d, want %d", tt.headers, w.Code, tt.want)
		}
	}
}

func TestTheHeadersAllowOnlyThePagesOwnStyle(t *testing.T) {
	_, h := newTestPage(t, "correct horse")
	w := send(h, http.MethodGet, "/", "203.0.113.5", "", nil)
	for name, want := range map[string]string{
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "same-origin",
		"X-Robots-Tag":    "noindex, nofollow",
		"Cache-Control":   "no-store",
	} {
		if got := w.Header().Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	match := regexp.MustCompile(`(?s)<style>(.*)</style>`).FindStringSubmatch(w.Body.String())
	if match == nil {
		t.Fatal("the page has no style")
	}
	sum := sha256.Sum256([]byte(match[1]))
	want := "style-src 'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
	if policy := w.Header().Get("Content-Security-Policy"); !strings.Contains(policy, want) || !strings.Contains(policy, "default-src 'none'") {
		t.Errorf("Content-Security-Policy = %q, want default-src 'none' and %s", policy, want)
	}
}

func TestTheBrowsersLanguageIsPicked(t *testing.T) {
	for header, want := range map[string]string{
		"":                        "en",
		"de-DE,de;q=0.9,en;q=0.8": "de",
		"nl,fr;q=0.5,es;q=0.7":    "es",
		"es;q=0,fr-CA":            "fr",
		"en-US,en;q=0.9":          "en",
		"zh-CN, x;q=bad":          "en",
	} {
		if got := messagesFor(header).Lang; got != want {
			t.Errorf("messagesFor(%q) = %s, want %s", header, got, want)
		}
	}
}

func TestAKnownBrowserSignsInWhileManyClientsGuess(t *testing.T) {
	page, h := newTestPage(t, "correct horse")
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	page.now = func() time.Time { return now }

	w := send(h, http.MethodPost, "https://status.example/login", "198.51.100.7", "", url.Values{"password": {"correct horse"}})
	var known string
	for _, c := range w.Result().Cookies() {
		if c.Name == knownCookie {
			if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteStrictMode {
				t.Errorf("known cookie %+v, want Secure, HttpOnly and SameSite=Strict", c)
			}
			known = c.Value
		}
	}
	if known == "" {
		t.Fatal("POST /login set no known cookie")
	}

	for i := range maxWrongAll {
		from := netip.AddrFrom4([4]byte{203, 0, 113, byte(i)}).String()
		send(h, http.MethodPost, "/login", from, "", url.Values{"password": {"guess"}})
	}
	// From another network, as a phone away from home.
	login := func(cookie string) int {
		r := httptest.NewRequest(http.MethodPost, "https://status.example/login", strings.NewReader(url.Values{"password": {"correct horse"}}.Encode()))
		r.RemoteAddr = "192.0.2.44:40000"
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		if cookie != "" {
			r.AddCookie(&http.Cookie{Name: knownCookie, Value: cookie}) //nolint:gosec // a cookie the test sends, not one set
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	if code := login(""); code != http.StatusTooManyRequests {
		t.Errorf("POST /login of an unknown browser after %d wrong passwords from many clients = %d, want 429", maxWrongAll, code)
	}
	if code := login("made-up"); code != http.StatusTooManyRequests {
		t.Errorf("POST /login with a made-up known cookie = %d, want 429", code)
	}
	if code := login(known); code != http.StatusSeeOther {
		t.Errorf("POST /login of the known browser = %d, want 303", code)
	}
}

func TestAFullTableOfClientsIsSweptNowAndThen(t *testing.T) {
	l := newLimiter()
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	for i := range maxClients {
		l.allow(netip.AddrFrom4([4]byte{10, byte(i >> 16), byte(i >> 8), byte(i)}), now)
	}
	newcomer := netip.MustParseAddr("198.51.100.7")
	if l.guess(newcomer, now, false) {
		t.Fatal("guess() of a new client while the table is full = true, want false")
	}
	// The table was swept a moment ago, so it is not swept again yet, even
	// though its clients need not be kept any more.
	now = now.Add(lockout)
	l.swept = now.Add(-sweepEvery / 2)
	if l.guess(newcomer, now, false) {
		t.Fatal("guess() right after a sweep = true, want false")
	}
	now = now.Add(sweepEvery)
	if !l.guess(newcomer, now, false) {
		t.Fatal("guess() once the table may be swept again = false, want true")
	}
}
