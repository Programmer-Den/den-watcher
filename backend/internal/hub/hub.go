package hub

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/netip"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// savedSchema keeps the devices added on the page. Devices from HUB_DEVICES
// are not stored; they come from the setting at every start. hub_kept lists
// the devices removed with their history kept, whose availability and kind
// stay too, for when a device with the same name is added again, until they
// were removed longer than the retention ago, when the history is gone too.
const savedSchema = `
CREATE TABLE IF NOT EXISTS hub_devices (
	id      TEXT    PRIMARY KEY,
	name    TEXT    NOT NULL,
	address TEXT    NOT NULL,
	added   INTEGER NOT NULL -- Unix time in seconds
);
CREATE TABLE IF NOT EXISTS hub_kept (
	device  TEXT    PRIMARY KEY,
	removed INTEGER NOT NULL -- Unix time in seconds
);
`

// Hub collects the usage of the other devices: the ones in HUB_DEVICES and
// the ones added on the page. Each has a recorder that keeps its history.
type Hub struct {
	store *history.Store
	// historyEntries is how many disks, sensors, network cards and GPUs each
	// the history keeps per device.
	historyEntries int
	// retention is how long the history is kept; older minutes of a device
	// are not fetched.
	retention time.Duration
	// phoneRetention is how long where the phones were and the Wi-Fi they
	// were connected to are kept; 0 keeps them for good.
	phoneRetention time.Duration
	// pagePort is the port the hub's page is reachable on, which every
	// device is told; see PagePortHeader.
	pagePort string
	// id is the hub's own id, which every device is told; see HubIDHeader.
	id string
	// phoneSecret is what each phone's key is made from; see phoneKey.
	phoneSecret []byte
	// suggester works out which device the page offers to add.
	suggester suggester
	// ctx ends every recorder when the program stops.
	ctx       context.Context
	recording sync.WaitGroup
	// unlinkSoon asks for unlinkPending to run now, as a device is refused
	// for an unlink still noted.
	unlinkSoon chan struct{}

	// beforeDelete, when set, is called before a removed device's data is
	// deleted, for tests.
	beforeDelete func(id string)
	// allowLoopback lets Add add a device at a loopback address, and the hub
	// collect from it, for tests, whose devices all run on the machine itself.
	allowLoopback bool
	// hostAddrs lists the host's addresses in a container, its virtual
	// interfaces' too, such as Docker's bridge gateway; metrics.HostAddresses
	// when nil, replaced in tests.
	hostAddrs func() []netip.Addr
	// local reads the usage of the machine the hub runs on, whose network
	// cards' addresses are the hub's own, also in a container; nil in tests.
	local Usage

	// ownMu guards the hub's own addresses besides its network interfaces'
	// (see ownAddresses): host, the host's, read at hostRead, and cards, the
	// network cards' in its usage, as last read at cardsRead. cardsFailed is
	// when reading the usage failed last, unless it was read since. reading
	// is set while the usage is read, and closed once it is. own is the list
	// given out last, and owned is set once one was; ownGeneration counts
	// how often the list gained an address since.
	ownMu         sync.Mutex
	host          []netip.Addr
	hostRead      time.Time
	cards         []netip.Addr
	cardsRead     time.Time
	cardsFailed   time.Time
	reading       chan struct{}
	own           []netip.Addr
	owned         bool
	ownGeneration uint64

	// forgetters delete what is kept elsewhere about a device that is gone;
	// see Forgetter.
	forgetters []Forgetter

	// mu guards remotes, hidden and removing.
	mu      sync.Mutex
	remotes []*Remote
	// hidden has the ids of the devices added on the page that are not
	// collected from at this start, as another device has their address
	// and port. They stay saved, for when the other one goes, so their
	// names stay taken.
	hidden map[string]bool
	// removing has a channel for each removed device whose recorder may still
	// run or whose data is still being deleted, closed once that is done.
	removing map[string]chan struct{}
}

// New starts collecting from the fixed devices and the ones added on the page
// earlier, until ctx is done. The history is kept in store, with the first
// historyEntries disks, sensors, network cards and GPUs each of a device, for
// retention. Every device is told pagePort, the port the hub's page is
// reachable on. local reads the hub's own usage: a device added on the page
// is not collected from at an address of its network cards either. The
// forgetters are called for every device the hub forgets, also for the ones
// it forgets while it starts. complete says fixed holds every device of the
// settings; when one of them was left out for an error, it is false and the
// devices missing from fixed are not forgotten at this start.
func New(ctx context.Context, store *history.Store, fixed []Device, complete bool, historyEntries int, retention, phoneRetention time.Duration, pagePort string, local Usage, forgetters ...Forgetter) (*Hub, error) {
	return newHub(ctx, store, fixed, complete, historyEntries, retention, phoneRetention, pagePort, local, false, forgetters...)
}

// newHub is New, with allowLoopback set before any device is collected from,
// for tests.
func newHub(ctx context.Context, store *history.Store, fixed []Device, complete bool, historyEntries int, retention, phoneRetention time.Duration, pagePort string, local Usage, allowLoopback bool, forgetters ...Forgetter) (*Hub, error) {
	h := &Hub{store: store, historyEntries: historyEntries, retention: retention, phoneRetention: phoneRetention, pagePort: pagePort, suggester: defaultSuggester(), ctx: ctx, local: local, allowLoopback: allowLoopback, forgetters: forgetters}
	for _, schema := range []string{savedSchema, availabilitySchema, kindSchema, idSchema, pairingSchema, meshSchema, phoneKeySchema} {
		if _, err := store.DB().ExecContext(ctx, schema); err != nil {
			return nil, err
		}
	}
	id, err := readID(ctx, store.DB())
	if err != nil {
		return nil, err
	}
	h.id = id
	if h.phoneSecret, err = readPhoneSecret(ctx, store.DB()); err != nil {
		return nil, err
	}
	saved, err := h.saved(ctx)
	if err != nil {
		return nil, err
	}
	// A device dropped from HUB_DEVICES without being added on the page is
	// gone for good: its availability is deleted, as when it is removed on the
	// page, while its history ages out with the retention.
	// A device removed with its history kept and now in HUB_DEVICES is
	// collected from again.
	// The nodes of a mesh are shown as the routers they are part of.
	nodes, err := meshDevices(ctx, store.DB(), fixed)
	if err != nil {
		return nil, err
	}
	for _, device := range slices.Concat(fixed, nodes) {
		if err := continueKept(ctx, store.DB(), device.ID); err != nil {
			return nil, err
		}
	}
	// The phones' data moves in the background (see unlinkPending).
	if _, err := h.forgetExpiredDevices(ctx, time.Now()); err != nil {
		return nil, err
	}
	kept, err := h.selectDevices(ctx, `SELECT device FROM hub_kept`)
	if err != nil {
		return nil, err
	}
	for _, device := range slices.Concat(fixed, nodes, saved) {
		kept = append(kept, device.ID)
	}
	if complete {
		if err := forgetMeshes(ctx, store.DB(), fixed); err != nil {
			return nil, err
		}
		if err := h.forgetOthers(ctx, kept); err != nil {
			return nil, err
		}
	} else {
		slog.Warn("a setting of the devices to collect from has an error, so no device missing from them is forgotten at this start")
	}
	for _, device := range fixed {
		h.start(device, true, nil)
		if device.Mesh != nil {
			h.recording.Go(func() { h.watchMesh(ctx, device) })
		}
	}
	for _, device := range nodes {
		if h.find(device.ID) != nil {
			// The node is forgotten, so that leaving the mesh does not remove
			// the other device, and comes back under a name of its own.
			slog.Warn("a node of a router's mesh has the same name as a device in HUB_DEVICES, HUB_ROUTERS or HUB_CHECKS; using that one", "name", device.Name)
			if _, err := store.DB().ExecContext(ctx, `DELETE FROM hub_mesh_nodes WHERE device = ?`, device.ID); err != nil {
				return nil, err
			}
			continue
		}
		h.start(device, true, nil)
	}
	var own []netip.Addr
	if len(saved) > 0 {
		own = h.ownAddresses()
	}
	for _, device := range saved {
		// Its id is that of the name it was added with; the name it was
		// renamed to may be another device's too.
		if h.find(device.ID) != nil || h.findName(IDOf(device.Name), nil) != nil {
			slog.Warn("a device added on the page has the same name as one in HUB_DEVICES, HUB_ROUTERS or HUB_CHECKS, or found in a router's mesh, or had it before it was renamed; using that one", "name", device.Name, "id", device.ID)
			continue
		}
		// Devices added before each address and port could be added only once.
		if other := h.findAddress(device.Address); other != nil {
			slog.Warn("a device added on the page has the same address and port as another; collecting from it only once", "name", device.Name, "other", other.Name, "address", device.Address)
			if h.hidden == nil {
				h.hidden = map[string]bool{}
			}
			h.hidden[device.ID] = true
			continue
		}
		h.start(device, false, own)
	}
	h.unlinkSoon = make(chan struct{}, 1)
	h.recording.Go(func() {
		h.unlinkPending(ctx)
		ticker := time.NewTicker(history.PruneInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				if err := h.forgetExpired(ctx, now); err != nil && ctx.Err() == nil {
					slog.Error("forget the availability of devices removed longer than the retention ago", "error", err)
				}
				h.unlinkPending(ctx)
			case <-h.unlinkSoon:
				h.unlinkPending(ctx)
			}
		}
	})
	return h, nil
}

// Remotes returns the devices the hub collects from, in the order they were added.
func (h *Hub) Remotes() []*Remote {
	h.mu.Lock()
	defer h.mu.Unlock()
	return slices.Clone(h.remotes)
}

// Add checks the device, asks it for its usage once to make sure a
// den-watcher answers at its address and takes the pairing code, keeps it in
// the database with its kind and code and starts collecting from it. An
// address of the hub itself is refused (see addable and ownAddresses), and
// again whenever the hub connects to the device. A device on a version
// without pairing takes any code. Problems with the device are InputErrors.
func (h *Hub) Add(ctx context.Context, name, address string, kind Kind, code string) (Device, error) {
	device, err := NewDevice(name, address)
	if err != nil {
		return Device{}, err
	}
	kind, err = ParseKind(string(kind))
	if err != nil {
		return Device{}, err
	}
	code, err = checkCode(code)
	if err != nil {
		return Device{}, err
	}
	// A device with the same name that was just removed may still have its
	// data deleted, which would delete this one's too. A short delete is
	// waited for; a long one is not, so the request does not time out.
	if err := h.waitRemoved(ctx, device.ID, removingWait); err != nil {
		return Device{}, err
	}
	// Checked before asking the device, so a device added already is refused
	// at once, and again below, in case another change came in meanwhile.
	h.mu.Lock()
	err = h.taken(device)
	h.mu.Unlock()
	if err != nil {
		return Device{}, err
	}

	// Asked before taking mu, so the page is not held up while the device answers.
	own, err := h.askNew(ctx, device.Address, code)
	if err != nil {
		if input := pairingInputError(err); input != nil {
			return Device{}, input
		}
		if errors.Is(err, errOwnAddress) {
			return Device{}, &InputError{Problem: ProblemAddressOwn, Message: "the address is the hub itself; give the device's address on the local network"}
		}
		// A den-watcher that does not know the name it was asked by
		// answers 421, which tells no more than that something answers
		// there. Otherwise only the log says why, so the answer does not
		// tell which ports of the hub's network are open.
		var status *statusError
		if errors.As(err, &status) && status.Code == http.StatusMisdirectedRequest {
			slog.Info("could not add a device, as it does not answer to the name it was asked by", "name", device.Name, "address", device.Address, "error", err)
			return Device{}, &InputError{Problem: ProblemHostUnknown, Message: "the device does not answer to the name in " + device.Address + "; give its IP address or its .local name, or add the name to ALLOWED_HOSTS on the device"}
		}
		slog.Info("could not add a device, as no den-watcher answers at its address", "name", device.Name, "address", device.Address, "error", err)
		return Device{}, &InputError{Problem: ProblemUnreachable, Message: "no den-watcher answers at " + device.Address}
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.stopping(); err != nil {
		return Device{}, err
	}
	if err := h.taken(device); err != nil {
		return Device{}, err
	}
	// The device and its kind are saved together, and even when the page that
	// asked has gone away, so a device is never saved without being collected.
	if err := h.save(context.WithoutCancel(ctx), device, kind, code); err != nil {
		return Device{}, err
	}
	h.start(device, false, own)
	return device, nil
}

// save keeps an added device, its kind and its pairing code in the database,
// all or none.
func (h *Hub) save(ctx context.Context, device Device, kind Kind, code string) error {
	tx, err := h.store.DB().BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	_, err = tx.ExecContext(ctx, `INSERT INTO hub_devices (id, name, address, added) VALUES (?, ?, ?, ?)`,
		device.ID, device.Name, device.Address, time.Now().Unix())
	if err != nil {
		return err
	}
	if err := continueKept(ctx, tx, device.ID); err != nil {
		return err
	}
	if err := storeKind(ctx, tx, device.ID, kind); err != nil {
		return err
	}
	if err := storeCode(ctx, tx, device.ID, code); err != nil {
		return err
	}
	return tx.Commit()
}

// continueKept lets a device removed with its history kept, if device is
// one, continue its availability, as it is collected from again. The time it
// was removed was not watched, so since moves on by that much, and the share
// of time it answered counts only the time it was watched.
func continueKept(ctx context.Context, db execer, device string) error {
	_, err := db.ExecContext(ctx, `
		UPDATE hub_watched SET since = since + MAX(0, ?2 - (SELECT removed FROM hub_kept WHERE device = ?1))
		WHERE device = ?1 AND EXISTS (SELECT 1 FROM hub_kept WHERE device = ?1)`, device, time.Now().Unix())
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `DELETE FROM hub_kept WHERE device = ?`, device)
	return err
}

// SetKind changes what a device is used as, a device from HUB_DEVICES too.
// The times it did not answer stay as they are; only what they mean changes.
func (h *Hub) SetKind(ctx context.Context, id string, kind Kind) error {
	kind, err := ParseKind(string(kind))
	if err != nil {
		return err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	remote := h.find(id)
	if remote == nil {
		return &InputError{Problem: ProblemNotFound, Message: "there is no device with this id"}
	}
	if remote.Phone {
		return &InputError{Problem: ProblemKind, Message: "a phone stays a phone; remove it and add it again as another device"}
	}
	if err := storeKind(ctx, h.store.DB(), id, kind); err != nil {
		return err
	}
	remote.mu.Lock()
	remote.kind = kind
	remote.mu.Unlock()
	slog.Info("changed the kind of another device", "name", remote.ShownName(), "kind", kind)
	return nil
}

// Rename gives a device added on the page another name. Its id stays, and
// with it its history, kind and pairing code; only the name shown changes.
// A name another device has, or had before it was renamed, is refused, as
// is one of a device that is not collected from for having the address of
// another (see taken).
func (h *Hub) Rename(ctx context.Context, id, name string) error {
	name = strings.TrimSpace(name)
	newID, err := checkName(name)
	if err != nil {
		return err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if err := h.stopping(); err != nil {
		return err
	}
	remote := h.find(id)
	if remote == nil {
		return &InputError{Problem: ProblemNotFound, Message: "there is no device with this id"}
	}
	if remote.Fixed {
		return &InputError{Problem: ProblemFixed, Message: "the device is set in HUB_DEVICES, HUB_ROUTERS or HUB_CHECKS, or found in a router's mesh; rename it there"}
	}
	old := remote.ShownName()
	if name == old {
		return nil
	}
	if other := h.find(newID); (other != nil && other != remote) || h.findName(newID, remote) != nil {
		return &InputError{Problem: ProblemNameTaken, Message: "another device has the same name, or had it before it was renamed; give each device its own name"}
	}
	if h.hidden[newID] {
		return &InputError{Problem: ProblemNameTaken, Message: "a device added earlier has the same name; it is not collected from, as another device has its address and port, but it stays saved; give each device its own name"}
	}
	// Saved even when the page that asked has gone away, so the name shown
	// is the one saved.
	if _, err := h.store.DB().ExecContext(context.WithoutCancel(ctx), `UPDATE hub_devices SET name = ? WHERE id = ?`, name, id); err != nil {
		return err
	}
	remote.mu.Lock()
	remote.name = name
	remote.mu.Unlock()
	slog.Info("renamed another device", "from", old, "to", name)
	return nil
}

// ErrStopping refuses changes once the program stops, so no recorder starts
// while the others are waited for and the database is closed. It is no
// error of the hub's: the change can be made again once it runs.
var ErrStopping = errors.New("the hub is stopping")

// stopping returns ErrStopping once the ctx given to New is done. The caller
// holds mu.
func (h *Hub) stopping() error {
	if h.ctx.Err() != nil {
		return ErrStopping
	}
	return nil
}

// Wait waits until every recorder has stopped after the ctx given to New is done.
func (h *Hub) Wait() {
	h.recording.Wait()
}

// start begins collecting from a device. The caller holds mu, or New runs.
// own lists more of the hub's addresses (see ownAddresses), read by the
// caller before taking mu, as reading them can take seconds; it is unused
// for a fixed device.
func (h *Hub) start(device Device, fixed bool, own []netip.Addr) {
	kind, err := readKind(h.ctx, h.store.DB(), device.ID)
	if err != nil {
		slog.Error("read the kind of a device; taking it for a server", "name", device.Name, "error", err)
		kind = KindServer
	}
	// A phone's agent reads what the phone sent last, as a router's reads
	// the router; its code tells its pushes apart.
	var pushed *phone
	switch {
	case kind == KindPhone && device.Address == "":
		pushed = &phone{minutes: &fetcher{store: h.store, device: device.ID, maxEntries: h.historyEntries, retention: h.retention}, retention: h.phoneRetention}
		device.Phone, device.Source = true, pushed
	case kind == KindPhone:
		// Kept from a phone removed with its history, whose name a device
		// with an address took over.
		kind = KindServer
	}
	// A device from HUB_DEVICES is collected from at whatever address it is
	// set to, as the hub's owner chose it, such as a VM behind port
	// forwarding on the hub itself. One added on the page is not, even when
	// its host name resolves to the hub only later.
	var agent *Agent
	switch {
	case device.ReadByHub():
		agent = newReaderAgent(device.Source)
	case fixed:
		agent = NewAgent(device.Address)
	default:
		agent = h.pageAgent(device.Address)
	}
	agent.pagePort = h.pagePort
	agent.hubID = h.id
	agent.maxEntries = h.historyEntries
	if !device.ReadByHub() || device.Phone {
		code, err := readCode(h.ctx, h.store.DB(), device.ID)
		if err != nil {
			slog.Error("read the pairing code of a device; sending none", "name", device.Name, "error", err)
		}
		agent.code = code
	}
	if err := watch(h.ctx, h.store.DB(), device.ID, time.Now()); err != nil {
		slog.Error("store when the hub started collecting from a device", "name", device.Name, "error", err)
	}
	recent := &history.Recent{}
	watched := &watchedAgent{agent: agent, db: h.store.DB(), device: device.ID}
	// A device added on the page before the hub's own addresses were
	// refused, at one of them, such as a VM behind port forwarding on the
	// hub, shows as not answering. The log says so here, by name, and not
	// again when the hub refuses to connect.
	if !fixed && !h.addableAddress(device.Address, own) {
		slog.Warn("a device added on the page is at an address of the hub itself, which the hub no longer connects to; remove it on the page with its history kept and list it in HUB_DEVICES under the same name", "name", device.Name, "address", device.Address)
		watched.refusedLogged = true
	}
	ctx, stop := context.WithCancel(h.ctx)
	remote := &Remote{
		Device:   device,
		Fixed:    fixed,
		Agent:    agent,
		Reader:   history.Reader{Store: h.store, Recent: recent, Device: device.ID, Retention: h.retention},
		db:       h.store.DB(),
		watched:  watched,
		stop:     stop,
		recorded: make(chan struct{}),
		kind:     kind,
		name:     device.Name,
		phone:    pushed,
	}
	recorder := &history.Recorder{Store: h.store, Recent: recent, Device: device.ID, Collector: watched, MaxEntries: h.historyEntries, WiFi: h.store}
	// A router or check keeps no minutes to fetch; the hub stores the
	// average of its own readings.
	switch {
	case device.Phone:
		recorder.Fetch = phoneFetch
	case !device.ReadByHub():
		fetcher := &fetcher{agent: agent, store: h.store, device: device.ID, maxEntries: h.historyEntries, retention: h.retention}
		recorder.Fetch = fetcher.fetch
	}
	h.recording.Go(func() {
		defer close(remote.recorded)
		recorder.Run(ctx)
		watched.stop(ctx)
	})
	h.remotes = append(h.remotes, remote)
	if device.Phone {
		slog.Info("taking the pushes of a phone", "name", device.Name)
		return
	}
	slog.Info("collecting from another device", "name", device.Name, "address", device.Address)
}

// taken refuses a device whose name or whose address and port another
// device has, a hidden one's name too. The caller holds mu.
func (h *Hub) taken(device Device) error {
	if h.find(device.ID) != nil || h.findName(device.ID, nil) != nil {
		return &InputError{Problem: ProblemNameTaken, Message: "another device has the same name, or had it before it was renamed; give each device its own name"}
	}
	if h.hidden[device.ID] {
		return &InputError{Problem: ProblemNameTaken, Message: "a device added earlier has the same name; it is not collected from, as another device has its address and port, but it stays saved; give each device its own name"}
	}
	if h.removing[device.ID] != nil {
		return errRemoving
	}
	// A removed phone whose route and Wi-Fi are still being unlinked from its
	// id, which the new device would take over.
	unlinking, err := h.store.Unlinking(context.WithoutCancel(h.ctx), device.ID)
	if err != nil {
		return err
	}
	if unlinking {
		// One that failed is tried again now, so trying again in a moment
		// can work.
		select {
		case h.unlinkSoon <- struct{}{}:
		default:
		}
		return errRemoving
	}
	if other := h.findAddress(device.Address); other != nil {
		return &InputError{Problem: ProblemAddressTaken, Message: fmt.Sprintf("%s is already collected from at this address and port", other.ShownName())}
	}
	return nil
}

// findAddress returns the device at the same address and port. The caller
// holds mu.
func (h *Hub) findAddress(address string) *Remote {
	// A phone has no address, which no other device has either.
	if address == "" {
		return nil
	}
	for _, r := range h.remotes {
		if SameAddress(r.Address, address) {
			return r
		}
	}
	return nil
}

// findName returns the device other than except whose shown name has the
// id; after a rename, that is no longer the device's own id. The caller
// holds mu.
func (h *Hub) findName(id string, except *Remote) *Remote {
	for _, r := range h.remotes {
		if r != except && IDOf(r.ShownName()) == id {
			return r
		}
	}
	return nil
}

func (h *Hub) find(id string) *Remote {
	for _, r := range h.remotes {
		if r.ID == id {
			return r
		}
	}
	return nil
}

func (h *Hub) saved(ctx context.Context) ([]Device, error) {
	rows, err := h.store.DB().QueryContext(ctx, `SELECT id, name, address FROM hub_devices ORDER BY added, id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var devices []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.Name, &d.Address); err != nil {
			return nil, err
		}
		devices = append(devices, d)
	}
	return devices, rows.Err()
}
