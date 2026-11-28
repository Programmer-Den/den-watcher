package program

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/password"
	"github.com/Programmer-Den/den-watcher/backend/internal/server"
	"github.com/Programmer-Den/den-watcher/backend/internal/statuspage"
)

// statusPageSettings reads STATUS_ADDR, the address of the remote status
// page, empty when it is off, and the port it is reachable on: from
// STATUS_PUBLIC_PORT, or the port of STATUS_ADDR.
func statusPageSettings() (addr, port string, err error) {
	addr = strings.TrimSpace(os.Getenv("STATUS_ADDR"))
	if addr == "" {
		return "", "", nil
	}
	_, port, err = net.SplitHostPort(addr)
	if n, convErr := strconv.Atoi(port); err != nil || convErr != nil || n < 1 || n > 65535 {
		return "", "", fmt.Errorf("STATUS_ADDR is %q; set it to an address and port such as :9443, or leave it empty for no status page", addr)
	}
	if public := strings.TrimSpace(os.Getenv("STATUS_PUBLIC_PORT")); public != "" {
		if n, err := strconv.Atoi(public); err != nil || n < 1 || n > 65535 {
			return "", "", fmt.Errorf("STATUS_PUBLIC_PORT is %q; set it to a port from 1 to 65535", public)
		}
		port = public
	}
	return addr, port, nil
}

// openStatusPage returns the remote status page for devices, with its
// password and self-signed certificate kept in store.
func openStatusPage(ctx context.Context, store *history.Store, devices server.Devices) (*statuspage.Page, *statuspage.Certificates, error) {
	statusPassword, err := password.OpenTable(ctx, store.DB(), password.StatusTable)
	if err != nil {
		return nil, nil, err
	}
	certs, err := statuspage.OpenCertificates(ctx, store.DB())
	if err != nil {
		return nil, nil, err
	}
	slog.Info("the status page's certificate; check that a browser shows the same before trusting it", "sha256", certs.Fingerprint())
	return statuspage.New(func() []statuspage.Device { return statusDevices(devices.List()) }, statusPassword), certs, nil
}

// statusDevices is what the remote status page shows of devices: each one's
// name, whether it answers and how many alerts it has. A PC or phone that
// does not answer is switched off rather than offline, and a device waiting
// for its pairing code answers all the same.
func statusDevices(devices []server.Device) []statuspage.Device {
	shown := make([]statuspage.Device, 0, len(devices))
	for _, d := range devices {
		state := statuspage.Online
		if d.Unreachable && d.Pairing == "" {
			state = statuspage.Offline
			if d.Kind == hub.KindPC || d.Kind == hub.KindPhone {
				state = statuspage.Off
			}
		}
		shown = append(shown, statuspage.Device{Name: d.Name, State: state, Alerts: len(d.Alerts)})
	}
	return shown
}

// remoteStatus is the status page as the website sets its password and
// tells where it is.
type remoteStatus struct {
	*statuspage.Page
	certs *statuspage.Certificates
	port  string
}

func (s remoteStatus) Port() string        { return s.port }
func (s remoteStatus) Fingerprint() string { return s.certs.Fingerprint() }
