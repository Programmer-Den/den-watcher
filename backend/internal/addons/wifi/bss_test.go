package wifi

import (
	"encoding/binary"
	"reflect"
	"testing"
	"time"
)

// put32 and put64 write a test's small numbers, or negative ones in two's
// complement, as Windows lays them out.
func put32(b []byte, v int) { binary.LittleEndian.PutUint32(b, uint32(v)) } //nolint:gosec // see above

func put64(b []byte, v int64) { binary.LittleEndian.PutUint64(b, uint64(v)) } //nolint:gosec // see above

// bssEntry returns a WLAN_BSS_ENTRY with ies after it, as WlanGetNetworkBssList
// lays them out, received at received.
func bssEntry(ssid string, bssid [6]byte, rssi int32, quality, kHz uint32, capability uint16, received time.Time, ies []byte) []byte {
	b := make([]byte, bssEntrySize, bssEntrySize+len(ies))
	put32(b[bssSSIDOffset:], len(ssid))
	copy(b[bssSSIDOffset+4:], ssid)
	copy(b[bssBSSIDOffset:], bssid[:])
	put32(b[bssRSSIOffset:], int(rssi))
	binary.LittleEndian.PutUint32(b[bssLinkQualityOffset:], quality)
	put64(b[bssHostTimestampOffset:], received.UnixNano()/100+116444736000000000)
	binary.LittleEndian.PutUint16(b[bssCapabilityOffset:], capability)
	binary.LittleEndian.PutUint32(b[bssFrequencyOffset:], kHz)
	if len(ies) > 0 {
		binary.LittleEndian.PutUint32(b[bssIEOffsetOffset:], bssEntrySize)
		put32(b[bssIESizeOffset:], len(ies))
	}
	return append(b, ies...)
}

func TestParseBSSList(t *testing.T) {
	now := time.Date(2026, 10, 25, 20, 0, 0, 0, time.UTC)
	// Windows puts the elements of all entries after the entries, each
	// entry's offset counted from its own start.
	home := bssEntry("Home", [6]byte{0xaa, 0, 0, 0, 0, 1}, -48, 100, 5180000, capabilityPrivacy, now.Add(-time.Minute), nil)
	stale := bssEntry("Gone", [6]byte{0xaa, 0, 0, 0, 0, 2}, -80, 20, 2412000, 0, now.Add(-time.Hour), nil)
	open := bssEntry("Café", [6]byte{0xaa, 0, 0, 0, 0, 3}, -70, 60, 2437000, 0, now, nil)
	ies := rsn(2)
	binary.LittleEndian.PutUint32(home[bssIEOffsetOffset:], 3*bssEntrySize)
	put32(home[bssIESizeOffset:], len(ies))
	list := make([]byte, bssListHeader)
	binary.LittleEndian.PutUint32(list[4:], 3)
	list = append(append(append(append(list, home...), stale...), open...), ies...)
	put32(list, len(list))

	got := parseBSSList(list, "aa:00:00:00:00:01", now)

	want := []AccessPoint{
		{
			SSID: "Home", BSSID: "aa:00:00:00:00:01", SignalPercent: 100, SignalDBm: -48, HasDBm: true, FrequencyMHz: 5180,
			Security: Security{Privacy: true, WPA2: true}, Connected: true,
		},
		{SSID: "Café", BSSID: "aa:00:00:00:00:03", SignalPercent: 60, SignalDBm: -70, HasDBm: true, FrequencyMHz: 2437},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseBSSList() = %+v, want %+v", got, want)
	}
	if got := parseBSSList(list[:bssListHeader+bssEntrySize-1], "", now); len(got) != 0 {
		t.Errorf("parseBSSList() of a list cut short = %+v, want nothing", got)
	}
}

func TestConnectedBSSID(t *testing.T) {
	b := make([]byte, signalQualityOffset+4)
	copy(b[bssidOffset:], []byte{0x02, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f})
	if got := connectedBSSID(b); got != "02:1b:2c:3d:4e:5f" {
		t.Errorf("connectedBSSID() = %q", got)
	}
	if got := connectedBSSID(b[:bssidOffset]); got != "" {
		t.Errorf("connectedBSSID() of too few bytes = %q, want none", got)
	}
}
