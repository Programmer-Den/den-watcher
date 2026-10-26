package hub

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net"
	"strings"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// MeshNode is a router that a main router reports as part of its mesh,
// such as a node of an ASUS AiMesh, which the hub shows as a device of its
// own.
type MeshNode struct {
	// Key tells the node apart within its mesh, such as its hardware
	// address.
	Key string
	// Name is what the node is called in the main router's settings.
	Name string
	// Address is the node's IP address, shown with the device.
	Address string
	// Radios are the hardware addresses of the node's access points.
	Radios []string
}

// Mesh is a main router that reports the other routers of its mesh.
type Mesh interface {
	// MeshNodes returns the nodes as last read, and whether that was
	// lately; an old list is not acted on.
	MeshNodes() (nodes []MeshNode, fresh bool)
	// Node returns the reader of the node with key, which fails while the
	// main router does not report it online.
	Node(key string) Usage
	// Radios returns the hardware addresses of the main router's own access
	// points.
	Radios() []string
}

// meshSchema keeps the nodes of each mesh the hub shows as devices, so they
// keep their device, name and history across restarts, also while the main
// router does not answer.
const meshSchema = `
CREATE TABLE IF NOT EXISTS hub_mesh_nodes (
	router  TEXT NOT NULL, -- the device id of the main router
	node    TEXT NOT NULL, -- the node's key within its mesh
	device  TEXT NOT NULL UNIQUE,
	name    TEXT NOT NULL,
	address TEXT NOT NULL,
	PRIMARY KEY (router, node)
);
`

const (
	// meshInterval is how often the hub looks for nodes that joined or left
	// a mesh.
	meshInterval = time.Minute
	// meshGone is how long a node may be missing from its main router's
	// list before the hub stops showing it, with its history kept, so a
	// node that was taken out of the mesh does not stay an outage.
	meshGone = time.Hour
)

// meshDevices returns the nodes stored for the fixed routers that report a
// mesh, each as a device read through its main router.
func meshDevices(ctx context.Context, db *sql.DB, fixed []Device) ([]Device, error) {
	var devices []Device
	for _, router := range fixed {
		if router.Mesh == nil {
			continue
		}
		rows, err := db.QueryContext(ctx, `SELECT node, device, name, address FROM hub_mesh_nodes WHERE router = ? ORDER BY rowid`, router.ID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var key string
			var d Device
			if err := rows.Scan(&key, &d.ID, &d.Name, &d.Address); err != nil {
				_ = rows.Close()
				return nil, err
			}
			d.Source = router.Mesh.Node(key)
			devices = append(devices, d)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	return devices, nil
}

// forgetMeshes deletes the nodes stored for routers that are no longer
// fixed routers with a mesh; their devices are forgotten with the others.
func forgetMeshes(ctx context.Context, db *sql.DB, fixed []Device) error {
	rows, err := db.QueryContext(ctx, `SELECT DISTINCT router FROM hub_mesh_nodes`)
	if err != nil {
		return err
	}
	var gone []string
	for rows.Next() {
		var router string
		if err := rows.Scan(&router); err != nil {
			_ = rows.Close()
			return err
		}
		kept := false
		for _, d := range fixed {
			kept = kept || (d.ID == router && d.Mesh != nil)
		}
		if !kept {
			gone = append(gone, router)
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, router := range gone {
		if _, err := db.ExecContext(ctx, `DELETE FROM hub_mesh_nodes WHERE router = ?`, router); err != nil {
			return err
		}
	}
	return nil
}

// watchMesh adds the nodes that join the mesh of router as devices, and
// stops showing the ones that left it, until ctx is done.
func (h *Hub) watchMesh(ctx context.Context, router Device) {
	ticker := time.NewTicker(meshInterval)
	defer ticker.Stop()
	missing := map[string]time.Time{}
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			if err := h.syncMesh(ctx, router, missing, now); err != nil && ctx.Err() == nil {
				slog.Error("update the nodes of a router's mesh", "router", router.Name, "error", err)
			}
		}
	}
}

// syncMesh starts a device for each node of router's mesh that has none,
// and stops the device of each node missing from the list since meshGone
// before now; missing has since when each node's device is missing.
func (h *Hub) syncMesh(ctx context.Context, router Device, missing map[string]time.Time, now time.Time) error {
	nodes, fresh := router.Mesh.MeshNodes()
	if !fresh {
		return nil
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.ctx.Err() != nil {
		return nil
	}
	stored := map[string]string{}
	addresses := map[string]string{}
	rows, err := h.store.DB().QueryContext(ctx, `SELECT node, device, address FROM hub_mesh_nodes WHERE router = ?`, router.ID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var key, device, address string
		if err := rows.Scan(&key, &device, &address); err != nil {
			_ = rows.Close()
			return err
		}
		stored[key], addresses[key] = device, address
	}
	if err := rows.Close(); err != nil {
		return err
	}
	listed := map[string]bool{}
	for _, node := range nodes {
		listed[node.Key] = true
		if device, ok := stored[node.Key]; ok {
			delete(missing, device)
			// A node that got another address keeps it from the next start;
			// its name stays, as the device's id and history go with it.
			if node.Address != "" && node.Address != addresses[node.Key] {
				if _, err := h.store.DB().ExecContext(ctx, `UPDATE hub_mesh_nodes SET address = ? WHERE router = ? AND node = ?`,
					node.Address, router.ID, node.Key); err != nil {
					return err
				}
			}
			continue
		}
		device, ok := h.nodeDevice(router, node)
		if !ok {
			continue
		}
		if _, err := h.store.DB().ExecContext(ctx, `INSERT INTO hub_mesh_nodes (router, node, device, name, address) VALUES (?, ?, ?, ?, ?)`,
			router.ID, node.Key, device.ID, device.Name, device.Address); err != nil {
			return err
		}
		if err := continueKept(ctx, h.store.DB(), device.ID); err != nil {
			return err
		}
		h.start(device, true, nil)
		slog.Info("a node joined the mesh of a router; showing it as a device", "router", router.Name, "name", device.Name)
	}
	for key, device := range stored {
		if listed[key] {
			continue
		}
		since, ok := missing[device]
		if !ok {
			missing[device] = now
			continue
		}
		if now.Sub(since) < meshGone {
			continue
		}
		delete(missing, device)
		if remote := h.find(device); remote != nil {
			if err := h.removeRemote(ctx, remote, true); err != nil {
				return err
			}
		}
		if _, err := h.store.DB().ExecContext(ctx, `DELETE FROM hub_mesh_nodes WHERE router = ? AND node = ?`, router.ID, key); err != nil {
			return err
		}
		slog.Info("a node left the mesh of a router; no longer showing it, with its history kept", "router", router.Name, "device", device)
	}
	return nil
}

// nodeDevice returns a new device for a node of router's mesh, named as in
// the main router's settings, or with " (AiMesh)" and then the end of its
// key added where another device has that name. The caller holds mu.
func (h *Hub) nodeDevice(router Device, node MeshNode) (Device, bool) {
	name := strings.TrimSpace(node.Name)
	key := strings.NewReplacer(":", "", "-", "").Replace(node.Key)
	if len(key) > 4 {
		key = key[len(key)-4:]
	}
	for _, candidate := range []string{name, name + " (AiMesh)", name + " (AiMesh " + key + ")"} {
		device, err := NewRouter(candidate, node.Address, router.Mesh.Node(node.Key))
		if err != nil {
			continue
		}
		if h.find(device.ID) == nil && !h.hidden[device.ID] && h.removing[device.ID] == nil && !h.nodeTaken(device.ID) {
			return device, true
		}
	}
	slog.Warn("a node of a router's mesh has a name no device can have; it is not shown", "router", router.Name, "name", node.Name)
	return Device{}, false
}

// nodeTaken reports whether a node of any mesh or a device added on the
// page, shown or not, has the id.
func (h *Hub) nodeTaken(id string) bool {
	var taken bool
	err := h.store.DB().QueryRowContext(h.ctx, `SELECT EXISTS (SELECT 1 FROM hub_mesh_nodes WHERE device = ?1) OR EXISTS (SELECT 1 FROM hub_devices WHERE id = ?1)`, id).Scan(&taken)
	return err != nil || taken
}

// RouterBoxes maps the box of each access point of the meshes (see
// metrics.AccessPointID) to the device it is part of: the main router's
// own to the main router, and a node's to the node's device, so the page
// can name the access points of the home network after them.
func (h *Hub) RouterBoxes(ctx context.Context) (map[string]string, error) {
	boxes := map[string]string{}
	add := func(device string, radios []string) {
		for _, radio := range radios {
			if address, err := net.ParseMAC(radio); err == nil {
				if box := metrics.AccessPointID(address, true); box != "" {
					boxes[box] = device
				}
			}
		}
	}
	for _, router := range h.Remotes() {
		if router.Mesh == nil {
			continue
		}
		add(router.ID, router.Mesh.Radios())
		nodes, _ := router.Mesh.MeshNodes()
		for _, node := range nodes {
			var device string
			err := h.store.DB().QueryRowContext(ctx, `SELECT device FROM hub_mesh_nodes WHERE router = ? AND node = ?`, router.ID, node.Key).Scan(&device)
			if errors.Is(err, sql.ErrNoRows) {
				continue
			}
			if err != nil {
				return nil, err
			}
			add(device, node.Radios)
		}
	}
	return boxes, nil
}
