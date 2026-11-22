package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/pairing"
)

// logPairingCode tells this device's pairing code, which a hub asks for when
// the device is added there.
func logPairingCode(p *pairing.Pairing) {
	slog.Info("to collect from this device, a hub asks for its pairing code, which den-watcher pairing-code prints too", "code", p.Code())
}

// healthcheckArgument makes the program check that the den-watcher running on
// this machine answers, for Docker's health check: the image has no shell or
// curl to ask it with.
const healthcheckArgument = "healthcheck"

// checkHealth asks the den-watcher running on this machine, at LISTEN_ADDR,
// whether it answers. It asks GET /api/hub, which both the website and
// DATA_ONLY serve and which reads nothing but memory. Any answer but a
// server error counts: with LISTEN_ADDR set to one address of the machine,
// the request comes from that address instead of localhost and is refused.
func checkHealth() error {
	url, err := localURL("/api/hub")
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("den-watcher on this machine does not answer: %w", err)
	}
	_ = response.Body.Close()
	if response.StatusCode >= http.StatusInternalServerError {
		return fmt.Errorf("den-watcher on this machine answered %s", response.Status)
	}
	return nil
}

// localURL is the address of path on the den-watcher running on this machine,
// at LISTEN_ADDR.
func localURL(path string) (string, error) {
	addr := cmp.Or(os.Getenv("LISTEN_ADDR"), ":9393")
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "", fmt.Errorf("LISTEN_ADDR is %q; set it to an address and port such as :9393", addr)
	}
	// A LISTEN_ADDR of one address, such as 192.168.1.5:9393, is not
	// answered on localhost.
	if ip := net.ParseIP(host); host == "" || ip != nil && ip.IsUnspecified() {
		host = "localhost"
	}
	return "http://" + net.JoinHostPort(host, port) + path, nil
}

// pairingCodeArgument makes the program print the pairing code of the
// den-watcher running on this machine, for a device without a website.
const pairingCodeArgument = "pairing-code"

// printPairingCode asks the den-watcher running on this machine, at
// LISTEN_ADDR, for its pairing code and writes it to out.
func printPairingCode(out io.Writer) error {
	url, err := localURL("/api/pairing")
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("ask den-watcher on this machine for its pairing code: %w; is it running, with LISTEN_ADDR as here?", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("ask den-watcher on this machine for its pairing code: it answered %s; it needs a version with pairing, and its database must be writable", response.Status)
	}
	var answer struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&answer); err != nil || answer.Code == "" {
		return fmt.Errorf("read the pairing code from %s: the answer is not one", url)
	}
	_, err = fmt.Fprintln(out, answer.Code)
	return err
}
