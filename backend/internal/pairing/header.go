package pairing

import (
	"net/http"
	"strings"
)

// oldHeaderPrefix starts the names the headers had up to 4.0.0, before they
// were named after den-watcher: Usage-Control-Pairing-Code and so on.
// Devices, hubs and phone apps from then still send and expect only those,
// so Set sends each header under both names and Header reads either, until
// a later release drops the old ones.
const oldHeaderPrefix = "Usage-Control-"

// oldName is the name a header starting with Den-Watcher- had up to 4.0.0.
func oldName(name string) string {
	return oldHeaderPrefix + strings.TrimPrefix(name, "Den-Watcher-")
}

// Header returns the value of the header name, or of its name up to 4.0.0.
func Header(h http.Header, name string) string {
	if value := h.Get(name); value != "" {
		return value
	}
	return h.Get(oldName(name))
}

// SetHeader sets the header name to value, also under its name up to 4.0.0.
func SetHeader(h http.Header, name, value string) {
	h.Set(name, value)
	h.Set(oldName(name), value)
}
