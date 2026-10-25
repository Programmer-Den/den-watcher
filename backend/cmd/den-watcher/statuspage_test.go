package main

import (
	"reflect"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/server"
	"github.com/Programmer-Den/den-watcher/backend/internal/statuspage"
)

func TestStatusPageSettings(t *testing.T) {
	tests := []struct {
		addr, public       string
		wantAddr, wantPort string
	}{
		{"", "", "", ""},
		{"", "8443", "", ""},
		{":9443", "", ":9443", "9443"},
		{" 0.0.0.0:9443 ", "8443", "0.0.0.0:9443", "8443"},
	}
	for _, tt := range tests {
		t.Setenv("STATUS_ADDR", tt.addr)
		t.Setenv("STATUS_PUBLIC_PORT", tt.public)
		addr, port, err := statusPageSettings()
		if err != nil || addr != tt.wantAddr || port != tt.wantPort {
			t.Errorf("STATUS_ADDR=%q STATUS_PUBLIC_PORT=%q: %q, %q, %v; want %q, %q", tt.addr, tt.public, addr, port, err, tt.wantAddr, tt.wantPort)
		}
	}
}

func TestStatusPageSettingsRefuseInvalidValues(t *testing.T) {
	for _, tt := range []struct{ addr, public string }{
		{"9443", ""},
		{":0", ""},
		{":https", ""},
		{":9443", "70000"},
	} {
		t.Setenv("STATUS_ADDR", tt.addr)
		t.Setenv("STATUS_PUBLIC_PORT", tt.public)
		if _, _, err := statusPageSettings(); err == nil {
			t.Errorf("STATUS_ADDR=%q STATUS_PUBLIC_PORT=%q: no error", tt.addr, tt.public)
		}
	}
}

func TestStatusDevicesShowOnlyStateAndAlertCount(t *testing.T) {
	since := time.Now()
	devices := []server.Device{
		{ID: hub.LocalID, Name: "Pi", Alerts: []alerts.Alert{{}, {}}},
		{ID: "nas", Name: "NAS", Address: "192.168.1.10:9393", Kind: hub.KindServer, Unreachable: true, UnreachableSince: &since},
		{ID: "pc", Name: "PC", Address: "192.168.1.30:9393", Kind: hub.KindPC, Unreachable: true},
		{ID: "phone", Name: "Phone", Kind: hub.KindPhone, Unreachable: true},
		{ID: "new", Name: "New", Address: "192.168.1.40:9393", Kind: hub.KindServer, Unreachable: true, Pairing: "needed", Alerts: []alerts.Alert{{}}},
	}
	want := []statuspage.Device{
		{Name: "Pi", State: statuspage.Online, Alerts: 2},
		{Name: "NAS", State: statuspage.Offline},
		{Name: "PC", State: statuspage.Off},
		{Name: "Phone", State: statuspage.Off},
		{Name: "New", State: statuspage.Online, Alerts: 1},
	}
	if got := statusDevices(devices); !reflect.DeepEqual(got, want) {
		t.Errorf("statusDevices() = %+v, want %+v", got, want)
	}
}
