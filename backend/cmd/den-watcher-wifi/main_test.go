package main

import (
	"testing"
	"time"
)

func TestScanInterval(t *testing.T) {
	for value, want := range map[string]time.Duration{
		"":    scanEvery,
		" ":   scanEvery,
		"1":   scanEvery,
		"0":   0,
		" 0 ": 0,
		"no":  scanEvery,
	} {
		if got := scanInterval(value); got != want {
			t.Errorf("scanInterval(%q) = %v, want %v", value, got, want)
		}
	}
}
