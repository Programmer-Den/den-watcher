package pairing

import (
	"net/http"
	"testing"
)

func TestHeadersKeepTheirNamesUpTo400(t *testing.T) {
	h := http.Header{}
	SetHeader(h, CodeHeader, "ABCD")
	if h.Get("Den-Watcher-Pairing-Code") != "ABCD" || h.Get("Usage-Control-Pairing-Code") != "ABCD" {
		t.Errorf("headers = %v, want the code under both names", h)
	}
	old := http.Header{}
	old.Set("Usage-Control-Pairing-Code", "EFGH")
	if got := Header(old, CodeHeader); got != "EFGH" {
		t.Errorf("Header from an app up to 4.0.0 = %q, want EFGH", got)
	}
	both := http.Header{}
	both.Set("Den-Watcher-Pairing-Code", "NEW")
	both.Set("Usage-Control-Pairing-Code", "OLD")
	if got := Header(both, CodeHeader); got != "NEW" {
		t.Errorf("Header = %q, want the new name first", got)
	}
}
