package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

func TestAddAPhone(t *testing.T) {
	devices := &fakeHub{}
	handler := newChangeHandler(devices, &fakePassword{password: "correct horse"})

	add := send(handler, http.MethodPost, "/api/phones", `{"name":"Pixel","code":"7kqm-x2rp","password":"correct horse"}`)
	wrong := send(handler, http.MethodPost, "/api/phones", `{"name":"Pixel","code":"7KQM-X2RP","password":"wrong"}`)

	if add.Code != http.StatusCreated {
		t.Fatalf("add = %d, want 201: %s", add.Code, add.Body)
	}
	if body := add.Body.String(); !strings.Contains(body, `"kind":"phone","removable":true`) || strings.Contains(body, `"address"`) {
		t.Errorf("body = %s, want a phone without an address", body)
	}
	if wrong.Code != http.StatusForbidden {
		t.Errorf("add with a wrong password = %d, want 403", wrong.Code)
	}
	if len(devices.codes) != 1 || devices.codes[0] != "pixel=7kqm-x2rp" {
		t.Errorf("codes = %q, want the one phone added with its code as given", devices.codes)
	}

	devices.err = &hub.InputError{Problem: hub.ProblemPairingTaken, Message: "taken"}
	if taken := send(handler, http.MethodPost, "/api/phones", `{"name":"Galaxy","code":"7KQM-X2RP","password":"correct horse"}`); taken.Code != http.StatusConflict {
		t.Errorf("add with a code another phone has = %d, want 409", taken.Code)
	}
}

func push(handler http.Handler, code, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, hub.PhoneMinutesPath, strings.NewReader(body))
	req.RemoteAddr = "192.168.1.40:5000"
	req.Host = "192.168.1.9:9393"
	req.Header.Set("Content-Type", "application/json")
	if code != "" {
		req.Header.Set(pairing.CodeHeader, code)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestAPhonePushesWithItsCode(t *testing.T) {
	delay := wrongCodeDelay
	wrongCodeDelay = 0
	t.Cleanup(func() { wrongCodeDelay = delay })
	devices := &fakeHub{phoneCode: "7KQMX2RP"}
	handler := newChangeHandler(devices, &fakePassword{password: "correct horse"})

	// Sent by the app as shown, with the dash and in small letters, without
	// a password: the code is what lets it in.
	ok := push(handler, "7kqm-x2rp", `{"now":1800000000,"snapshot":{"cpu":{"usagePercent":3}},"minutes":[{"time":1799999940,"values":{"memory":40}}],"newerField":true}`)
	if ok.Code != http.StatusOK || strings.TrimSpace(ok.Body.String()) != `{"after":1800000000}` {
		t.Fatalf("push = %d %s, want 200 with the newest minute the hub has", ok.Code, ok.Body)
	}
	if len(devices.pushes) != 1 || len(devices.pushes[0].Minutes) != 1 || devices.pushes[0].Snapshot == nil {
		t.Errorf("pushes = %+v, want the one push with its minute and reading", devices.pushes)
	}

	for name, rec := range map[string]*httptest.ResponseRecorder{
		"wrong code": push(handler, "AAAA-BBBB", `{"now":1800000000,"minutes":[]}`),
		"no code":    push(handler, "", `{"now":1800000000,"minutes":[]}`),
	} {
		if rec.Code != http.StatusForbidden || rec.Header().Get(pairing.ProblemHeader) != "wrong" {
			t.Errorf("%s = %d, %s header %q; want 403 and wrong", name, rec.Code, pairing.ProblemHeader, rec.Header().Get(pairing.ProblemHeader))
		}
	}
	if rec := push(handler, "7KQM-X2RP", `{"now":`); rec.Code != http.StatusBadRequest {
		t.Errorf("push that is no JSON = %d, want 400", rec.Code)
	}
	devices.err = hub.ErrPushTooLarge
	if rec := push(handler, "7KQM-X2RP", `{"now":1800000000,"minutes":[]}`); rec.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("push with too many minutes = %d, want 413", rec.Code)
	}
}
