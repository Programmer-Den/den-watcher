package server

import (
	"context"
	"net"
	"net/http"
	"net/netip"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// Pairing tells whether a hub may collect from this machine; see the pairing
// package.
type Pairing interface {
	Allow(ctx context.Context, hub, code string) pairing.Answer
	Code() string
}

// wrongCodeDelay is how long a hub that sent a wrong code is answered late,
// so codes cannot be tried quickly over the network; a variable for the
// tests.
var wrongCodeDelay = time.Second

// pairedOnly refuses a request from a hub, one that sends a hub id, until the
// hub is paired: it sent this machine's pairing code once, or was paired
// without it while this machine was updated (see pairing.Open). A request
// without a hub id is not from a hub. With page, as on a machine with a
// website whose page reads the same usage, it passes. Without, as on a
// device without a website, only one from this machine passes, such as a
// check of the install, so leaving out the hub id does not get around the
// code. Without p, as when the database could not be opened, every request
// passes, as before pairing.
func pairedOnly(p Pairing, page bool, next http.HandlerFunc) http.HandlerFunc {
	if p == nil {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		id := hubAsking(r)
		if id == "" && (page || fromThisMachine(r)) {
			next(w, r)
			return
		}
		switch p.Allow(r.Context(), id, r.Header.Get(pairing.CodeHeader)) {
		case pairing.Paired:
			next(w, r)
		case pairing.Wrong:
			select {
			case <-time.After(wrongCodeDelay):
			case <-r.Context().Done():
				return
			}
			w.Header().Set(pairing.ProblemHeader, "wrong")
			http.Error(w, "the pairing code is wrong; give the code this device shows in the hub's Devices dialog", http.StatusForbidden)
		default:
			w.Header().Set(pairing.ProblemHeader, "needed")
			http.Error(w, "this device asks for its pairing code; give the code it shows in the hub's Devices dialog", http.StatusForbidden)
		}
	}
}

// pairingResponse is the body of GET /api/pairing.
type pairingResponse struct {
	// Code is this machine's pairing code, such as 7KQM-X2RP.
	Code string `json:"code"`
}

// pairingHandler serves GET /api/pairing: this machine's pairing code. With
// localOnly, as on a device without a website, it answers only programs on
// this machine, such as the tray icon and den-watcher pairing-code.
func pairingHandler(p Pairing, localOnly bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if localOnly {
			if !fromThisMachine(r) {
				http.Error(w, "only answered on this machine", http.StatusForbidden)
				return
			}
		}
		writeJSON(w, http.StatusOK, pairingResponse{Code: p.Code()})
	}
}

// fromThisMachine tells whether r comes from this machine: from a loopback
// address, or from the address it was sent to, as when LISTEN_ADDR is one
// address such as 192.168.1.5:9393.
func fromThisMachine(r *http.Request) bool {
	sender, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	if sender.Addr().IsLoopback() {
		return true
	}
	local, ok := r.Context().Value(http.LocalAddrContextKey).(net.Addr)
	if !ok {
		return false
	}
	to, err := netip.ParseAddrPort(local.String())
	return err == nil && to.Addr().Unmap() == sender.Addr().Unmap()
}
