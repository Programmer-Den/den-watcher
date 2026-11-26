package hub

import (
	"context"
	"log/slog"
	"slices"
	"time"
)

// Forgetter deletes what is kept outside the hub about a device that is gone
// for good, such as its alerts and events, so a device added later under the
// same name does not take it over. The hub calls it whenever it forgets a
// device: one removed on the page without its history, one dropped from
// HUB_DEVICES, HUB_ROUTERS or HUB_CHECKS, and one removed with its history
// kept longer than the retention ago.
type Forgetter func(ctx context.Context, id string) error

// Remove stops collecting from a device added on the page and forgets it.
// Its history and availability are deleted too, unless keepHistory is set;
// adding a device with the same name later continues them.
//
// Only taking the device off the list waits for mu; its recorder is stopped
// and its data deleted afterwards, in the background, as deleting a long
// history takes a while and every page request needs mu. Adding a device
// with the same name waits until that is done.
func (h *Hub) Remove(ctx context.Context, id string, keepHistory bool) error {
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
		return &InputError{Problem: ProblemFixed, Message: "the device is set in HUB_DEVICES or HUB_ROUTERS; remove it there"}
	}
	return h.removeRemote(ctx, remote, keepHistory)
}

// DeleteRoute deletes a stretch of a phone's route as history.Store.DeleteRoute
// does, but only while the phone is still saved: Remove deletes it from
// hub_devices before its data, so a stretch is never remembered after its
// phone's data was deleted.
func (h *Hub) DeleteRoute(ctx context.Context, id string, from, to time.Time) (int64, error) {
	return h.store.DeleteRoute(ctx, id, from, to, func(ctx context.Context) (bool, error) {
		var saved bool
		err := h.store.DB().QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM hub_devices WHERE id = ?)`, id).Scan(&saved)
		return saved, err
	})
}

// removeRemote stops collecting from a device and forgets it, as Remove
// does, a fixed one too. The caller holds mu.
func (h *Hub) removeRemote(ctx context.Context, remote *Remote, keepHistory bool) error {
	id := remote.ID
	// Counted before the database is changed, so a shutdown that times out
	// meanwhile still waits for the rest of the removal.
	h.recording.Add(1)
	// Once the device is deleted from the database, the rest follows even
	// when the page that asked has gone away, so nothing is left half removed.
	var phoneCode string
	if remote.phone != nil {
		phoneCode = remote.Agent.pairingCode()
	}
	if err := h.unsave(context.WithoutCancel(ctx), id, keepHistory, phoneCode); err != nil {
		h.recording.Done()
		return err
	}
	h.remotes = slices.DeleteFunc(h.remotes, func(r *Remote) bool { return r == remote })
	remote.stop()
	removed := make(chan struct{})
	if h.removing == nil {
		h.removing = map[string]chan struct{}{}
	}
	h.removing[id] = removed
	go func() {
		defer h.recording.Done()
		defer func() {
			h.mu.Lock()
			delete(h.removing, id)
			h.mu.Unlock()
			close(removed)
		}()
		<-remote.recorded
		if remote.phone != nil {
			remote.phone.pushing.Lock()
			remote.phone.gone = true
			remote.phone.pushing.Unlock()
		}
		slog.Info("stopped collecting from another device", "name", remote.ShownName(), "historyKept", keepHistory)
		if !keepHistory {
			h.deleteData(remote)
		}
	}()
	return nil
}

// unsave deletes a removed device from the database. With keepHistory, it is
// noted in hub_kept, so its availability and kind outlast a restart. For a
// phone, with its pairing code phoneCode, the note that its key was given
// goes too, so the phone gets its key when it is added again: the code stays
// the same on the phone, and so does its key.
func (h *Hub) unsave(ctx context.Context, id string, keepHistory bool, phoneCode string) error {
	tx, err := h.store.DB().BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `DELETE FROM hub_devices WHERE id = ?`, id); err != nil {
		return err
	}
	if phoneCode != "" {
		if _, err := tx.ExecContext(ctx, `DELETE FROM hub_phone_keys_given WHERE key_hash = ?`, keyHash(phoneKey(h.phoneSecret, phoneCode))); err != nil {
			return err
		}
	}
	if keepHistory {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO hub_kept (device, removed) VALUES (?, ?)
			ON CONFLICT (device) DO UPDATE SET removed = excluded.removed`, id, time.Now().Unix())
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// forgetExpired forgets the devices removed with their history kept longer
// than the retention before now, as their history is gone by then too (a
// phone's route and Wi-Fi stay, unlinked from it: see unlink).
func (h *Hub) forgetExpired(ctx context.Context, now time.Time) error {
	forgotten, err := h.forgetExpiredDevices(ctx, now)
	// Without mu, as moving a phone's data takes a while and every page
	// request needs mu; adding one again waits until it is done (see taken).
	for _, device := range forgotten {
		if err := h.unlink(ctx, device); err != nil && ctx.Err() == nil {
			// Tried again by unlinkPending.
			slog.Error("keep a removed phone's route and Wi-Fi without its name; tried again later", "device", device, "error", err)
		}
	}
	return err
}

// forgetExpiredDevices forgets the devices forgetExpired forgets, but for
// unlinking a phone's data, and returns them.
func (h *Hub) forgetExpiredDevices(ctx context.Context, now time.Time) ([]string, error) {
	// Held so a device is not added again while it is forgotten. The
	// forgetters run under it too: they never wait for the hub.
	h.mu.Lock()
	defer h.mu.Unlock()
	expired, err := h.selectDevices(ctx, `SELECT device FROM hub_kept WHERE removed < ?`, now.Add(-h.retention).Unix())
	if err != nil {
		return nil, err
	}
	var forgotten []string
	for _, device := range expired {
		if h.find(device) != nil {
			// Collected from again; only the note that it was removed goes.
			if err := continueKept(ctx, h.store.DB(), device); err != nil {
				return forgotten, err
			}
			continue
		}
		if err := h.forgetDevice(ctx, device); err != nil {
			return forgotten, err
		}
		forgotten = append(forgotten, device)
		slog.Info("forgot a device removed longer than the retention ago", "device", device)
	}
	return forgotten, nil
}

// unlink moves a forgotten phone's route and Wi-Fi to an id of their own,
// as forgetDevice noted (see history.Store.UnlinkPhoneData).
func (h *Hub) unlink(ctx context.Context, device string) error {
	return h.store.UnlinkPhoneData(ctx, device)
}

// unlinkPending finishes the unlinks still noted: those a hub that stopped
// meanwhile left, those forgetting devices at the start noted, and those
// that failed. The hub runs it in the background, at the start and then with
// forgetExpired.
func (h *Hub) unlinkPending(ctx context.Context) {
	pending, err := h.store.PendingUnlinks(ctx)
	if err != nil {
		if ctx.Err() == nil {
			slog.Error("read which removed phones' route and Wi-Fi are still to be kept without their names", "error", err)
		}
		return
	}
	for _, device := range pending {
		if err := h.unlink(ctx, device); err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Error("keep a removed phone's route and Wi-Fi without its name; tried again later", "device", device, "error", err)
		}
	}
}

// selectDevices returns the ids of the devices query selects.
func (h *Hub) selectDevices(ctx context.Context, query string, args ...any) ([]string, error) {
	rows, err := h.store.DB().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var kept []string
	for rows.Next() {
		var device string
		if err := rows.Scan(&device); err != nil {
			return nil, err
		}
		kept = append(kept, device)
	}
	return kept, rows.Err()
}

// forgetDevice deletes what the forgetters keep about device and notes that
// a phone's route and Wi-Fi are to be unlinked from it (see unlink), then
// deletes its availability and kind.
// Those go last, so a device whose forgetting stopped halfway, as the program
// stopped, is forgotten again at the next start (see forgetOthers).
func (h *Hub) forgetDevice(ctx context.Context, device string) error {
	for _, forgetter := range h.forgetters {
		if err := forgetter(ctx, device); err != nil {
			return err
		}
	}
	// For any device: one that is no phone has nothing to unlink, and its
	// kind may be gone already. Only noted here, which is quick, as the hub
	// may hold mu; the caller unlinks (see unlink).
	if err := h.store.NoteUnlink(ctx, device); err != nil {
		return err
	}
	return forget(ctx, h.store.DB(), device)
}

// deleteData forgets a removed device and deletes its history. When the
// program stops meanwhile, what is left of its history ages out with the
// retention.
func (h *Hub) deleteData(remote *Remote) {
	if h.beforeDelete != nil {
		h.beforeDelete(remote.ID)
	}
	// Its history first, which goes at once; then a phone's route and Wi-Fi,
	// whose move a hub that stops meanwhile finishes at its next start.
	err := h.forgetDevice(h.ctx, remote.ID)
	if err == nil {
		err = h.store.DeleteDevice(h.ctx, remote.ID)
	}
	if err == nil {
		err = h.unlink(h.ctx, remote.ID)
	}
	switch {
	case err == nil:
		slog.Info("deleted the data of a removed device", "name", remote.ShownName())
	case h.ctx.Err() != nil:
		slog.Warn("stopped deleting the history of a removed device, as the program stops; the rest is deleted with the retention", "name", remote.ShownName())
	default:
		slog.Error("delete the data of a removed device; its history is deleted with the retention", "name", remote.ShownName(), "error", err)
	}
}

// removingWait is how long adding a device waits for one with the same
// name to be removed, before it is refused with ProblemRemoving.
const removingWait = 2 * time.Second

// waitRemoved waits until the data of a removed device with id is deleted,
// if one is being removed, for at most limit. It returns errRemoving when
// that takes longer, or ctx's error when ctx is done first.
func (h *Hub) waitRemoved(ctx context.Context, id string, limit time.Duration) error {
	h.mu.Lock()
	removed := h.removing[id]
	h.mu.Unlock()
	if removed == nil {
		return nil
	}
	timer := time.NewTimer(limit)
	defer timer.Stop()
	select {
	case <-removed:
		return nil
	case <-timer.C:
		return errRemoving
	case <-ctx.Done():
		return ctx.Err()
	}
}

// errRemoving refuses a device whose name a device still being removed has.
var errRemoving = &InputError{Problem: ProblemRemoving, Message: "a device with the same name is still being removed; try again in a moment"}
