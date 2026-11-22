package main

import (
	"fmt"
	"log/slog"
	"net"
	"os"
	"runtime"
	"slices"
	"strconv"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/server"
)

// ownName returns what this device calls itself, which a hub offers as the
// name when it is added there: DEVICE_NAME, or else the machine's hostname.
// In a container, where HOST_PROC is set, the hostname is the container's,
// so there it is only DEVICE_NAME.
func ownName() string {
	if name := strings.TrimSpace(os.Getenv("DEVICE_NAME")); name != "" {
		return name
	}
	if os.Getenv("HOST_PROC") != "" {
		return ""
	}
	hostname, _ := os.Hostname()
	return hostname
}

// boolSettingOr reads a setting that is true or false, with a default for
// when it is not set.
func boolSettingOr(name string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	on, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s is %q; set it to true or false", name, value)
	}
	return on, nil
}

// diskPathsHint tells how to fix a path in DISK_PATHS that cannot be read on
// goos, in a container or not.
func diskPathsHint(goos string, container bool) string {
	switch {
	case goos == "windows":
		return `list drives or folders that exist, such as C:\,D:\`
	case container:
		return "mount each path read-only in compose.yaml"
	default:
		return "list folders that exist, such as /,/mnt/usb"
	}
}

// allowedHosts returns the entries of ALLOWED_HOSTS that are names or IP
// addresses. Each other one, such as http://pi.lan, is left out with a
// warning instead of stopping the start, so an install that has one keeps
// running after an update rather than restarting over and over in Docker or
// failing to start as a Windows service.
func allowedHosts() []string {
	valid, invalid := server.SplitAllowedHosts(listSetting("ALLOWED_HOSTS"))
	for _, entry := range invalid {
		slog.Warn("an entry of ALLOWED_HOSTS is not a name or IP address and is left out; give the name alone, such as pi.lan, without http:// or a path, and a name with letters such as ü in the xn-- form the browser sends, such as xn--kche-0ra.lan for küche.lan", "entry", entry)
	}
	return valid
}

// diskPaths returns the paths from DISK_PATHS, each once, or the system disk
// when it is not set.
func diskPaths() []string {
	var paths []string
	for _, path := range listSetting("DISK_PATHS") {
		if !slices.Contains(paths, path) {
			paths = append(paths, path)
		}
	}
	if len(paths) == 0 {
		return []string{systemDisk()}
	}
	return paths
}

// listSetting reads a comma-separated setting, without blank entries.
func listSetting(name string) []string {
	var values []string
	for _, value := range strings.Split(os.Getenv(name), ",") {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	return values
}

// systemDisk returns the root of the disk the operating system is installed
// on: / on Linux and macOS, and the system drive, usually C:\, on Windows.
func systemDisk() string {
	if runtime.GOOS == "windows" {
		return os.Getenv("SystemDrive") + `\`
	}
	return "/"
}

// pagePort returns the port the page is reachable on from the network, which
// a hub tells the devices it collects from: PUBLIC_PORT, or the port of
// LISTEN_ADDR. They differ in Docker, where the host's port is mapped to the
// container's 9393.
func pagePort(listenAddr string) (string, error) {
	value := strings.TrimSpace(os.Getenv("PUBLIC_PORT"))
	if value == "" {
		_, port, err := net.SplitHostPort(listenAddr)
		if err != nil {
			return "", fmt.Errorf("LISTEN_ADDR is %q; set it to an address and port such as :9393", listenAddr)
		}
		return port, nil
	}
	if port, err := strconv.Atoi(value); err != nil || port < 1 || port > 65535 {
		return "", fmt.Errorf("PUBLIC_PORT is %q; set it to a port from 1 to 65535", value)
	}
	return value, nil
}

// intSettingOr reads a setting that is a whole number from 1 to most, with a
// default for when it is not set; unit, such as " of days", names what it counts.
func intSettingOr(name string, fallback, most int, unit string) (int, error) {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 || n > most {
		return 0, fmt.Errorf("%s is %q; set it to a whole number%s from 1 to %d", name, value, unit, most)
	}
	return n, nil
}
