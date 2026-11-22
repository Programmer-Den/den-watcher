package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/changelog"
)

// Backups makes copies of the database for POST /api/backup.
type Backups interface {
	// Backup writes a consistent copy of the database to a new file and
	// returns its path; the caller deletes it.
	Backup(ctx context.Context) (string, error)
}

// backupTimeout is how long making and sending a backup may take, longer
// than the server's WriteTimeout, as the database can be hundreds of
// megabytes.
const backupTimeout = 10 * time.Minute

// errBackup is a backup that could not be made; why is logged.
var errBackup = errors.New("could not make the backup")

type backupRequest struct {
	Password string `json:"password"`
}

// download is the result of a change that is sent as a file instead of as
// JSON.
type download interface {
	send(w http.ResponseWriter)
}

// backupFile is a copy of the database, sent as den-watcher-<date>.db.
type backupFile struct {
	path string
	made time.Time
}

// backup serves POST /api/backup: a copy of the database, once the password
// is right. The copy is deleted once it is sent, or could not be.
func (c *deviceChanges) backup(w http.ResponseWriter, r *http.Request) {
	// The ResponseWriter of the tests cannot change the deadline; the
	// server's can.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(backupTimeout))
	var request backupRequest
	if !readJSON(w, r, &request) {
		return
	}
	var made string
	defer func() {
		if made != "" {
			if err := os.Remove(made); err != nil {
				slog.Warn("could not delete the backup after sending it", "path", made, "error", err)
			}
		}
	}()
	c.change(w, r, request.Password, false, changelog.Entry{Action: changelog.ActionBackup}, func() (any, error) {
		c.backingUp.Lock()
		defer c.backingUp.Unlock()
		path, err := c.backups.Backup(r.Context())
		if err != nil {
			if r.Context().Err() != nil {
				return nil, context.Canceled
			}
			slog.Error("make a backup of the database", "error", err)
			return nil, errBackup
		}
		made = path
		return backupFile{path: path, made: time.Now()}, nil
	})
}

func (b backupFile) send(w http.ResponseWriter) {
	file, err := os.Open(b.path)
	if err != nil {
		slog.Error("open the backup", "error", err)
		http.Error(w, errBackup.Error(), http.StatusInternalServerError)
		return
	}
	defer func() { _ = file.Close() }()
	info, err := file.Stat()
	if err != nil {
		slog.Error("read the size of the backup", "error", err)
		http.Error(w, errBackup.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.sqlite3")
	w.Header().Set("Content-Disposition", `attachment; filename="den-watcher-`+b.made.Format(time.DateOnly)+`.db"`)
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, file); err != nil {
		slog.Warn("send the backup", "error", err)
	}
}
