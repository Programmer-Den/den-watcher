package hub

import (
	"context"
	"net"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// fakeMesh is a main router that reports the nodes it is given, each of
// which answers.
type fakeMesh struct {
	mu     sync.Mutex
	nodes  []MeshNode
	radios []string
	fresh  bool
}

func (f *fakeMesh) MeshNodes() ([]MeshNode, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]MeshNode(nil), f.nodes...), f.fresh
}

func (f *fakeMesh) Node(key string) Usage {
	return nodeUsage(key)
}

func (f *fakeMesh) Radios() []string {
	return f.radios
}

// nodeUsage reads a node, which tells its key.
type nodeUsage string

func (n nodeUsage) Collect(context.Context) (metrics.Snapshot, error) {
	return metrics.Snapshot{Extras: []metrics.Extra{{ID: "aimesh-node", Title: string(n)}}}, nil
}

func meshRouter(t *testing.T, mesh *fakeMesh) Device {
	t.Helper()
	source := &fakeRouter{}
	source.up.Store(true)
	router, err := NewRouter("Main router", "192.168.1.1", source)
	if err != nil {
		t.Fatal(err)
	}
	router.Mesh = mesh
	return router
}

func names(h *Hub) []string {
	var list []string
	for _, r := range h.Remotes() {
		list = append(list, r.Name)
	}
	return list
}

func TestTheNodesOfAMeshAreDevices(t *testing.T) {
	ctx := context.Background()
	mesh := &fakeMesh{fresh: true, nodes: []MeshNode{
		{Key: "AA:00:00:00:00:02", Name: "Living room", Address: "192.168.1.2"},
		// A node named like another device gets a name of its own.
		{Key: "AA:00:00:00:00:03", Name: "Main router", Address: "192.168.1.3"},
	}}
	store := openTestStore(t)
	router := meshRouter(t, mesh)
	h := openTestHub(t, store, []Device{router})
	missing := map[string]time.Time{}
	now := time.Now()
	if err := h.syncMesh(ctx, router, missing, now); err != nil {
		t.Fatal(err)
	}
	if got, want := names(h), []string{"Main router", "Living room", "Main router (AiMesh)"}; !slices.Equal(got, want) {
		t.Fatalf("devices %q, want %q", got, want)
	}
	node := h.find("living-room")
	if !node.Fixed || !node.Router() || node.Address != "192.168.1.2" {
		t.Errorf("node %+v", node.Device)
	}
	if err := h.Remove(ctx, node.ID, false); problemOf(err) != ProblemFixed {
		t.Errorf("Remove() = %v, want a node to stay with its router", err)
	}

	// A node missing from the list goes once it is missing for meshGone,
	// with its history kept.
	mesh.mu.Lock()
	mesh.nodes = mesh.nodes[:1]
	mesh.mu.Unlock()
	if err := h.syncMesh(ctx, router, missing, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if len(h.Remotes()) != 3 {
		t.Fatalf("a node went at once: %q", names(h))
	}
	if err := h.syncMesh(ctx, router, missing, now.Add(time.Minute+meshGone)); err != nil {
		t.Fatal(err)
	}
	if got, want := names(h), []string{"Main router", "Living room"}; !slices.Equal(got, want) {
		t.Fatalf("devices %q, want %q", got, want)
	}
	var kept int
	if err := store.DB().QueryRowContext(ctx, `SELECT COUNT(*) FROM hub_kept WHERE device = 'main-router-aimesh'`).Scan(&kept); err != nil || kept != 1 {
		t.Errorf("the node that left is kept %d times, %v", kept, err)
	}
}

func TestTheAccessPointsOfAMeshAreNamedAfterItsDevices(t *testing.T) {
	ctx := context.Background()
	mesh := &fakeMesh{fresh: true, radios: []string{"AA:00:00:00:00:21", "not an address"}, nodes: []MeshNode{
		{Key: "AA:00:00:00:00:02", Name: "Living room", Radios: []string{"AA:11:22:33:44:12", "AA:11:22:33:44:15"}},
	}}
	router := meshRouter(t, mesh)
	h := openTestHub(t, openTestStore(t), []Device{router})
	// A node without a device yet has no access points named after it.
	boxes, err := h.RouterBoxes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	own, _ := net.ParseMAC("AA:00:00:00:00:21")
	if len(boxes) != 1 || boxes[metrics.AccessPointID(own, true)] != router.ID {
		t.Errorf("boxes before the node is a device %v", boxes)
	}
	if err := h.syncMesh(ctx, router, map[string]time.Time{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if boxes, err = h.RouterBoxes(ctx); err != nil {
		t.Fatal(err)
	}
	// Both radios of the node are one box.
	node, _ := net.ParseMAC("AA:11:22:33:44:15")
	if len(boxes) != 2 || boxes[metrics.AccessPointID(node, true)] != "living-room" {
		t.Errorf("boxes %v", boxes)
	}
}

// stoppedHub opens a hub on store, as openTestHub does, and returns a
// function that stops it, so another can open the same store after it.
func stoppedHub(t *testing.T, store *history.Store, fixed []Device) (*Hub, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	h, err := newHub(ctx, store, fixed, true, history.DefaultMaxEntries, 30*24*time.Hour, "9393", nil, true)
	if err != nil {
		t.Fatal(err)
	}
	stop := func() {
		cancel()
		h.Wait()
	}
	t.Cleanup(stop)
	return h, stop
}

func TestTheNodesOfAMeshStayAcrossARestart(t *testing.T) {
	store := openTestStore(t)
	mesh := &fakeMesh{fresh: true, nodes: []MeshNode{{Key: "AA:00:00:00:00:02", Name: "Living room", Address: "192.168.1.2"}}}
	router := meshRouter(t, mesh)
	h, stop := stoppedHub(t, store, []Device{router})
	if err := h.syncMesh(context.Background(), router, map[string]time.Time{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	stop()

	// The nodes are shown at once, before the main router is read.
	h2, _ := stoppedHub(t, store, []Device{meshRouter(t, &fakeMesh{})})
	if got, want := names(h2), []string{"Main router", "Living room"}; !slices.Equal(got, want) {
		t.Fatalf("after a restart %q, want %q", got, want)
	}
	if node := h2.find("living-room"); node.Address != "192.168.1.2" || node.Source == nil {
		t.Errorf("node %+v", node.Device)
	}
}

func TestAStaleListOfNodesIsNotActedOn(t *testing.T) {
	mesh := &fakeMesh{nodes: []MeshNode{{Key: "AA:00:00:00:00:02", Name: "Living room"}}}
	router := meshRouter(t, mesh)
	h := openTestHub(t, openTestStore(t), []Device{router})
	if err := h.syncMesh(context.Background(), router, map[string]time.Time{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if got := names(h); len(got) != 1 {
		t.Errorf("devices %q, want only the router", got)
	}
}

func TestTheNodesOfARouterDroppedFromTheSettingsAreForgotten(t *testing.T) {
	ctx := context.Background()
	store := openTestStore(t)
	mesh := &fakeMesh{fresh: true, nodes: []MeshNode{{Key: "AA:00:00:00:00:02", Name: "Living room"}}}
	router := meshRouter(t, mesh)
	h, stop := stoppedHub(t, store, []Device{router})
	if err := h.syncMesh(ctx, router, map[string]time.Time{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	stop()
	h2, _ := stoppedHub(t, store, nil)
	if got := names(h2); len(got) != 0 {
		t.Errorf("devices %q, want none", got)
	}
	var nodes int
	if err := store.DB().QueryRowContext(ctx, `SELECT COUNT(*) FROM hub_mesh_nodes`).Scan(&nodes); err != nil || nodes != 0 {
		t.Errorf("%d nodes kept, %v", nodes, err)
	}
}
