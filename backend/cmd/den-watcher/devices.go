package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/events"
	"github.com/Programmer-Den/den-watcher/backend/internal/hub"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
	"github.com/Programmer-Den/den-watcher/backend/internal/reach"
	"github.com/Programmer-Den/den-watcher/backend/internal/router"
	"github.com/Programmer-Den/den-watcher/backend/internal/server"
)

// hubDevices lists this device and the devices the hub collects from, each
// with its active alerts.
type hubDevices struct {
	local  server.Device
	hub    *hub.Hub
	alerts *alerts.Watcher
}

func (d hubDevices) List() []server.Device {
	local := d.local
	local.Alerts = d.alerts.Active(local.ID)
	devices := []server.Device{local}
	for _, remote := range d.hub.Remotes() {
		since, unreachable := remote.Unreachable()
		var unreachableSince *time.Time
		if unreachable && !since.IsZero() {
			unreachableSince = &since
		}
		var releasedUntil *time.Time
		if until := remote.ReleasedUntil(); !until.IsZero() {
			releasedUntil = &until
		}
		devices = append(devices, server.Device{
			ID:               remote.ID,
			Name:             remote.ShownName(),
			Address:          remote.Address,
			Kind:             remote.Kind(),
			Removable:        !remote.Fixed,
			Unreachable:      unreachable,
			UnreachableSince: unreachableSince,
			Refused:          remote.Refused(),
			Pairing:          remote.Pairing(),
			ReleasedUntil:    releasedUntil,
			Router:           remote.Router(),
			Checked:          remote.Checked,
			Alerts:           d.alerts.Active(remote.ID),
			Metrics:          remote.Agent.Latest(),
			History:          remote.Reader,
			Availability:     remote,
		})
	}
	return devices
}

// alertTargets lists this device, read by local, and the devices the hub
// collects from, for the alerts watcher.
func alertTargets(localName string, local metrics.Source, others *hub.Hub) []alerts.Target {
	targets := []alerts.Target{{ID: hub.LocalID, Name: localName, Usage: local}}
	for _, remote := range others.Remotes() {
		since, unreachable := remote.Unreachable()
		targets = append(targets, alerts.Target{
			ID:               remote.ID,
			Name:             remote.ShownName(),
			PC:               remote.Kind() == hub.KindPC || remote.Kind() == hub.KindPhone,
			Unreachable:      unreachable,
			UnreachableSince: since,
			Usage:            remote.Agent.Latest(),
		})
	}
	return targets
}

// eventTargets lists this device, read by local, and the devices the hub
// collects from, for the events log.
func eventTargets(local metrics.Source, others *hub.Hub) []events.Target {
	targets := []events.Target{{ID: hub.LocalID, Usage: local}}
	for _, remote := range others.Remotes() {
		targets = append(targets, events.Target{ID: remote.ID, Usage: remote.Agent.Latest()})
	}
	return targets
}

// routerDevices returns the routers in HUB_ROUTERS as devices, each with
// the password it needs: from the passwords file (see router.PasswordsPath),
// or else the one the Windows installer stored next to the database at
// databasePath (see router.StoredPasswords).
func routerDevices(databasePath string) ([]hub.Device, error) {
	configs, err := router.ParseConfigs(os.Getenv("HUB_ROUTERS"))
	if err != nil {
		return nil, fmt.Errorf("check HUB_ROUTERS: %w", err)
	}
	needsSecret, needsLogin := "", ""
	for _, config := range configs {
		if config.Protocol.HasSecret() && needsSecret == "" {
			needsSecret = config.Name
		}
		if config.Protocol.NeedsLogin() && needsLogin == "" {
			needsLogin = config.Name
		}
	}
	var passwords map[string]string
	source := router.PasswordsPath()
	if needsSecret != "" {
		switch {
		case source != "":
			passwords, err = router.ReadPasswords(source, hub.IDOf)
			// SNMPv2c with the community public needs no file.
			if err != nil && (!errors.Is(err, fs.ErrNotExist) || needsLogin != "") {
				return nil, fmt.Errorf("read the router passwords: %w", err)
			}
		default:
			var stored bool
			passwords, stored, err = router.StoredPasswords(filepath.Dir(databasePath), hub.IDOf)
			if err != nil {
				return nil, fmt.Errorf("read the router passwords the installer stored: %w", err)
			}
			source = "the installer"
			if !stored && needsLogin != "" {
				return nil, fmt.Errorf("the router %q needs a password; run the installer again to enter it, or set ROUTER_PASSWORDS_FILE to a file with a line %s=<password>", needsLogin, needsLogin)
			}
		}
	}
	var devices []hub.Device
	for _, config := range configs {
		device, err := hub.NewRouter(config.Name, config.Address, nil)
		if err != nil {
			return nil, fmt.Errorf("check HUB_ROUTERS: %w", err)
		}
		password, ok := passwords[device.ID]
		if config.Protocol.NeedsLogin() && !ok {
			return nil, fmt.Errorf("the router %q needs a password, but %s has none for it; run the installer again to enter it", config.Name, source)
		}
		if config.Protocol == router.SNMPv3 && len(password) < 8 {
			// SNMPv3 makes its keys from at least 8 characters (RFC 3414).
			return nil, fmt.Errorf("the SNMPv3 password of the router %q is shorter than 8 characters; run the installer again to enter it", config.Name)
		}
		reader := router.New(config, password)
		device.Source = reader
		if asus := router.MeshOf(reader); asus != nil {
			device.Mesh = asusMesh{asus}
		}
		devices = append(devices, device)
	}
	return devices, nil
}

// asusMesh shows the nodes of an ASUS router's AiMesh as devices of the hub.
type asusMesh struct {
	reader *router.ASUSReader
}

// meshFresh is how old the list of nodes may be for the hub to act on it.
const meshFresh = 2 * time.Minute

func (m asusMesh) MeshNodes() ([]hub.MeshNode, bool) {
	nodes, at := m.reader.MeshNodes()
	list := make([]hub.MeshNode, 0, len(nodes))
	for _, node := range nodes {
		list = append(list, hub.MeshNode{Key: node.MAC, Name: node.Name, Address: node.IP, Radios: node.Radios})
	}
	return list, !at.IsZero() && time.Since(at) < meshFresh
}

func (m asusMesh) Node(key string) hub.Usage {
	return m.reader.Node(key)
}

func (m asusMesh) Radios() []string {
	return m.reader.Radios()
}

// checkDevices returns the things in HUB_CHECKS as devices, each checked
// for whether it answers.
func checkDevices() ([]hub.Device, error) {
	configs, err := reach.ParseConfigs(os.Getenv("HUB_CHECKS"))
	if err != nil {
		return nil, fmt.Errorf("check HUB_CHECKS: %w", err)
	}
	var devices []hub.Device
	for _, config := range configs {
		device, err := hub.NewCheck(config.Name, config.Address(), reach.New(config))
		if err != nil {
			return nil, fmt.Errorf("check HUB_CHECKS: %w", err)
		}
		devices = append(devices, device)
	}
	return devices, nil
}
