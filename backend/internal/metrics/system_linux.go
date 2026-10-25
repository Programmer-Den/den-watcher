package metrics

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/sysfile"
)

// readOS reads the operating system from os-release. In a container, where
// HOST_PROC is set, /etc is the container's own, so it is read from the
// host's /etc mounted at HOST_ETC, and left out when that is not set.
func readOS(context.Context) string {
	files := []string{"/etc/os-release", "/usr/lib/os-release"}
	if os.Getenv("HOST_PROC") != "" {
		etc := os.Getenv("HOST_ETC")
		if etc == "" {
			return ""
		}
		files = []string{filepath.Join(etc, "os-release")}
	}
	for _, file := range files {
		if text, err := sysfile.Read(file); err == nil {
			return parseOSRelease(string(text))
		}
	}
	return ""
}

// parseOSRelease returns the name and version an os-release file gives:
// PRETTY_NAME, else NAME with VERSION.
func parseOSRelease(text string) string {
	fields := map[string]string{}
	for line := range strings.Lines(text) {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok || strings.HasPrefix(key, "#") {
			continue
		}
		if unquoted, err := strconv.Unquote(value); err == nil {
			value = unquoted
		} else {
			value = strings.Trim(value, `'"`)
		}
		fields[key] = value
	}
	if fields["PRETTY_NAME"] != "" {
		return fields["PRETTY_NAME"]
	}
	return strings.TrimSpace(fields["NAME"] + " " + fields["VERSION"])
}

// readBoard reads the board's model from the device tree, as on a Raspberry
// Pi, or else the PC's maker and model from its firmware (DMI). Both are
// files every user may read; the serial number next to them is not read.
func readBoard() (maker, model string) {
	sysDir := sysfile.HostSys()
	if model := firmwareText(sysfile.Text(filepath.Join(sysDir, "firmware", "devicetree", "base", "model"))); model != "" {
		return "", model
	}
	dmi := filepath.Join(sysDir, "class", "dmi", "id")
	return firmwareText(sysfile.Text(filepath.Join(dmi, "sys_vendor"))),
		firmwareText(sysfile.Text(filepath.Join(dmi, "product_name")))
}
