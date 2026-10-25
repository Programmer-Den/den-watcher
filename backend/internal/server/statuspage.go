package server

import (
	"context"
	"log/slog"
	"net/http"
)

// StatusPage is the remote status page, a minimal page on a port of its own
// for outside the local network, whose password is set on this page.
type StatusPage interface {
	PasswordSet(ctx context.Context) (bool, error)
	// ChangePassword sets the password and signs out every visitor; a
	// password too short or too long is password.ErrLength.
	ChangePassword(ctx context.Context, password string) error
	// Port is the port the page is reachable on.
	Port() string
	// Fingerprint is the SHA-256 of its self-signed certificate.
	Fingerprint() string
}

// statusPageResponse is the body of GET /api/status-page.
type statusPageResponse struct {
	// Enabled is false when STATUS_ADDR is not set; the rest is left out then.
	Enabled     bool   `json:"enabled"`
	Port        string `json:"port,omitempty"`
	Fingerprint string `json:"fingerprint,omitempty"`
	PasswordSet bool   `json:"passwordSet"`
}

// statusPageHandler serves GET /api/status-page: whether the remote status
// page is on, where and with which certificate, and whether its password
// is set.
func statusPageHandler(page StatusPage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if page == nil {
			writeJSON(w, http.StatusOK, statusPageResponse{})
			return
		}
		set, err := page.PasswordSet(r.Context())
		if err != nil {
			slog.Error("read whether the status page password is set", "error", err)
			http.Error(w, "could not read the settings", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, statusPageResponse{
			Enabled:     true,
			Port:        page.Port(),
			Fingerprint: page.Fingerprint(),
			PasswordSet: set,
		})
	}
}

type statusPasswordRequest struct {
	// Password is the one for changing devices, which guards this change.
	Password    string `json:"password"`
	NewPassword string `json:"newPassword"`
}

// setStatusPassword serves POST /api/status-page/password: sets or changes
// the password of the remote status page, once the password for changing
// devices is right.
func (c *deviceChanges) setStatusPassword(page StatusPage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var request statusPasswordRequest
		if !readJSON(w, r, &request) {
			return
		}
		c.change(w, r, request.Password, true, func() (any, error) {
			// ChangePassword checks the new password's length.
			if err := page.ChangePassword(r.Context(), request.NewPassword); err != nil {
				return nil, err
			}
			slog.Info("the password of the remote status page has been changed")
			return nil, nil
		})
	}
}
