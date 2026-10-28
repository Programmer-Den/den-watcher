package wifi

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/godbus/dbus/v5"
	"golang.org/x/sys/unix"
)

// callTimeout is how long NetworkManager may take to answer, well within a
// read's interval.
const callTimeout = 2 * time.Second

// NewNetworksReader returns what reads the nearby access points: from
// NetworkManager over the system D-Bus (at DBUS_SYSTEM_BUS_ADDRESS, or where
// the system keeps it), which lists those its own scans found. It starts no
// scan, so it ignores scanEvery: NetworkManager leaves who may ask for one
// to polkit, which usually refuses a service's user such as the add-on's.
// Where NetworkManager cannot be asked, as on a system without it or
// without D-Bus, it reads nothing; why is logged once, and again when it
// changes.
//
// It keeps one D-Bus connection open, opened at the first read and again
// after it failed.
func NewNetworksReader(time.Duration) func(ctx context.Context) []AccessPoint {
	var conn *dbus.Conn
	var logged string
	return func(ctx context.Context) []AccessPoint {
		aps, err := askNetworkManager(ctx, &conn)
		problem := ""
		if err != nil {
			problem = err.Error()
		}
		if problem != logged {
			if problem != "" {
				slog.Info("NetworkManager cannot be asked for the nearby Wi-Fi networks, so they are left out", "error", err)
			} else {
				slog.Info("NetworkManager answers again, so the nearby Wi-Fi networks are shown again")
			}
			logged = problem
		}
		return aps
	}
}

// askNetworkManager asks NetworkManager for its objects through *conn,
// connecting first when *conn is nil and closing it when the call fails, so
// the next read connects again.
func askNetworkManager(ctx context.Context, conn **dbus.Conn) ([]AccessPoint, error) {
	if *conn == nil {
		c, err := dbus.ConnectSystemBus(dbus.WithContext(ctx))
		if err != nil {
			return nil, err
		}
		*conn = c
	}
	callCtx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	var objects managedObjects
	err := (*conn).Object("org.freedesktop.NetworkManager", "/org/freedesktop").
		CallWithContext(callCtx, "org.freedesktop.DBus.ObjectManager.GetManagedObjects", 0).
		Store(&objects)
	if err != nil {
		var dbusErr dbus.Error
		// An error NetworkManager or the bus answered with leaves the
		// connection usable; any other one may not.
		if !errors.As(err, &dbusErr) {
			_ = (*conn).Close()
			*conn = nil
		}
		return nil, err
	}
	return accessPointsOf(objects, bootTime()), nil
}

// bootTime returns the time since boot, CLOCK_BOOTTIME, which
// NetworkManager's LastSeen counts in; containers share the host's.
func bootTime() time.Duration {
	var ts unix.Timespec
	if err := unix.ClockGettime(unix.CLOCK_BOOTTIME, &ts); err != nil {
		return 0
	}
	return time.Duration(ts.Nano())
}
