//go:build !linux && !windows

package wifi

import "context"

// NewNetworksReader returns what reads the nearby access points, which only
// Linux and Windows offer: elsewhere it reads nothing.
func NewNetworksReader() func(context.Context) []AccessPoint {
	return func(context.Context) []AccessPoint { return nil }
}
