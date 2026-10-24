package server

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/password"
)

type fakeStatusPage struct{ password string }

func (f *fakeStatusPage) PasswordSet(context.Context) (bool, error) { return f.password != "", nil }

func (f *fakeStatusPage) ChangePassword(_ context.Context, given string) error {
	if err := password.CheckNew(given); err != nil {
		return err
	}
	f.password = given
	return nil
}

func (f *fakeStatusPage) Port() string        { return "9443" }
func (f *fakeStatusPage) Fingerprint() string { return "AB:CD" }

func newStatusPageHandler(p Password, page StatusPage) http.Handler {
	return New(Site{Devices: DeviceList(device(fakeCollector{}, nil)), Hub: &fakeHub{}, Password: p, Files: site, StatusPage: page})
}

func TestTheStatusPageTellsWhereItIs(t *testing.T) {
	handler := newStatusPageHandler(&fakePassword{password: "hub password"}, &fakeStatusPage{})
	rec := send(handler, http.MethodGet, "/api/status-page", "")
	var got statusPageResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("GET /api/status-page = %d %s, %v", rec.Code, rec.Body, err)
	}
	want := statusPageResponse{Enabled: true, Port: "9443", Fingerprint: "AB:CD"}
	if got != want {
		t.Errorf("GET /api/status-page = %+v, want %+v", got, want)
	}
}

func TestWithoutTheStatusPageItIsOff(t *testing.T) {
	handler := newStatusPageHandler(&fakePassword{password: "hub password"}, nil)
	rec := send(handler, http.MethodGet, "/api/status-page", "")
	if rec.Code != http.StatusOK || rec.Body.String() != `{"enabled":false,"passwordSet":false}`+"\n" {
		t.Errorf("GET /api/status-page = %d %s, want it off", rec.Code, rec.Body)
	}
	if rec := send(handler, http.MethodPost, "/api/status-page/password", `{"password":"hub password","newPassword":"remote password"}`); rec.Code != http.StatusNotFound && rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /api/status-page/password without the page = %d, want it not served", rec.Code)
	}
}

func TestTheStatusPasswordNeedsTheHubPassword(t *testing.T) {
	page := &fakeStatusPage{}
	handler := newStatusPageHandler(&fakePassword{password: "hub password"}, page)

	rec := send(handler, http.MethodPost, "/api/status-page/password", `{"password":"wrong","newPassword":"remote password"}`)
	if rec.Code != http.StatusForbidden || page.password != "" {
		t.Fatalf("with a wrong hub password = %d, status password %q; want 403 and none set", rec.Code, page.password)
	}
	rec = send(handler, http.MethodPost, "/api/status-page/password", `{"password":"hub password","newPassword":"short"}`)
	if rec.Code != http.StatusBadRequest || page.password != "" {
		t.Fatalf("with a short new password = %d, status password %q; want 400 and none set", rec.Code, page.password)
	}
	rec = send(handler, http.MethodPost, "/api/status-page/password", `{"password":"hub password","newPassword":"remote password"}`)
	if rec.Code != http.StatusNoContent || page.password != "remote password" {
		t.Fatalf("with the hub password = %d, status password %q; want 204 and it set", rec.Code, page.password)
	}
	rec = send(handler, http.MethodPost, "/api/status-page/password", `{"password":"hub password","newPassword":"another password"}`)
	if rec.Code != http.StatusNoContent || page.password != "another password" {
		t.Errorf("changing it = %d, status password %q; want 204 and it changed", rec.Code, page.password)
	}
}

func TestTheFirstStatusPasswordCanChooseTheHubPassword(t *testing.T) {
	hubPassword := &fakePassword{}
	page := &fakeStatusPage{}
	handler := newStatusPageHandler(hubPassword, page)
	rec := send(handler, http.MethodPost, "/api/status-page/password", `{"password":"hub password","newPassword":"remote password"}`)
	if rec.Code != http.StatusNoContent || hubPassword.password != "hub password" || page.password != "remote password" {
		t.Errorf("= %d, hub %q, status %q; want both chosen", rec.Code, hubPassword.password, page.password)
	}
}
