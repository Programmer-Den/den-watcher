//go:build !linux && !windows

package wifi

import (
	"context"
	"time"
)

// NewNetworksReader returns what reads the nearby access points, which only
// Linux and Windows offer: elsewhere it reads nothing.
func NewNetworksReader(time.Duration) func(context.Context) []AccessPoint {
	return func(context.Context) []AccessPoint { return nil }
}
