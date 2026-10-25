package wifi

import (
	"encoding/binary"
	"fmt"
	"math"
	"time"
)

// What WlanGetNetworkBssList of Windows' Native Wifi API returns, read from
// its memory as bytes so it can be tested on any system;
// networks_windows.go calls it.

const (
	// A WLAN_BSS_LIST is its size and its number of entries, two DWORDs,
	// followed by a WLAN_BSS_ENTRY per access point.
	bssListHeader = 8
	bssEntrySize  = 360

	// Where a WLAN_BSS_ENTRY keeps what is read of it: the SSID (a ULONG
	// length and 32 bytes), the PHY id, the BSSID (padded to 8 bytes), the
	// BSS type, the PHY type, the RSSI in dBm, the link quality (0 to 100),
	// whether it is in the regulatory domain, the beacon period, the
	// timestamp, the host's timestamp of when it was last received (a
	// FILETIME), the capability information, the centre frequency in kHz,
	// the rate set (a ULONG and 126 USHORTs), and where its information
	// elements are and how long they are, from the entry's start.
	bssSSIDOffset          = 0
	bssBSSIDOffset         = 40
	bssRSSIOffset          = 56
	bssLinkQualityOffset   = 60
	bssHostTimestampOffset = 80
	bssCapabilityOffset    = 88
	bssFrequencyOffset     = 92
	bssIEOffsetOffset      = 352
	bssIESizeOffset        = 356

	// capabilityPrivacy is the bit of the capability information that says
	// the network is encrypted.
	capabilityPrivacy = 0x0010

	// bssidOffset is where WLAN_CONNECTION_ATTRIBUTES keeps the BSSID of the
	// access point connected to: after the state, the connection mode, the
	// profile name and, in WLAN_ASSOCIATION_ATTRIBUTES, the SSID and the
	// BSS type (see signalQualityOffset).
	bssidOffset = 4 + 4 + 2*descriptionChars + 36 + 4
)

// parseBSSList reads the access points of a WLAN_BSS_LIST, leaving out those
// last received longer than staleAfter before now and what lies beyond b.
// connected is the BSSID of the access point the interface is connected to,
// or "".
func parseBSSList(b []byte, connected string, now time.Time) []AccessPoint {
	if len(b) < bssListHeader {
		return nil
	}
	count := int(binary.LittleEndian.Uint32(b[4:]))
	aps := []AccessPoint{}
	for i := range count {
		start := bssListHeader + i*bssEntrySize
		if start+bssEntrySize > len(b) {
			break
		}
		entry := b[start:]
		if received := fileTime(binary.LittleEndian.Uint64(entry[bssHostTimestampOffset:])); !received.IsZero() && now.Sub(received) > staleAfter {
			continue
		}
		length := min(int(binary.LittleEndian.Uint32(entry[bssSSIDOffset:])), 32)
		ap := AccessPoint{
			SSID:          string(entry[bssSSIDOffset+4 : bssSSIDOffset+4+length]),
			BSSID:         macString(entry[bssBSSIDOffset : bssBSSIDOffset+6]),
			SignalPercent: float64(min(binary.LittleEndian.Uint32(entry[bssLinkQualityOffset:]), 100)),
			SignalDBm:     float64(signed(binary.LittleEndian.Uint32(entry[bssRSSIOffset:]))),
			FrequencyMHz:  int(binary.LittleEndian.Uint32(entry[bssFrequencyOffset:]) / 1000),
		}
		ap.HasDBm = ap.SignalDBm < 0
		ap.Connected = connected != "" && ap.BSSID == connected
		privacy := binary.LittleEndian.Uint16(entry[bssCapabilityOffset:])&capabilityPrivacy != 0
		ieStart := int(binary.LittleEndian.Uint32(entry[bssIEOffsetOffset:]))
		ieSize := int(binary.LittleEndian.Uint32(entry[bssIESizeOffset:]))
		var ies []byte
		if ieStart >= bssEntrySize && ieSize > 0 && ieStart+ieSize <= len(entry) {
			ies = entry[ieStart : ieStart+ieSize]
		}
		readElements(&ap, ies, privacy)
		aps = append(aps, ap)
	}
	return aps
}

// connectedBSSID reads the BSSID from a WLAN_CONNECTION_ATTRIBUTES, or
// returns "" when b is too short to hold it.
func connectedBSSID(b []byte) string {
	if len(b) < bssidOffset+6 {
		return ""
	}
	return macString(b[bssidOffset : bssidOffset+6])
}

// macString writes a hardware address as Linux does, such as
// "aa:bb:cc:dd:ee:ff".
func macString(b []byte) string {
	return fmt.Sprintf("%02x:%02x:%02x:%02x:%02x:%02x", b[0], b[1], b[2], b[3], b[4], b[5])
}

// fileTime turns a FILETIME, 100-nanosecond intervals since 1601, into a
// time, or the zero time for 0.
func fileTime(ft uint64) time.Time {
	if ft == 0 {
		return time.Time{}
	}
	// 1601 to 1970, in 100-nanosecond intervals.
	const epoch = 116444736000000000
	if ft < epoch || ft-epoch > math.MaxInt64/100 {
		return time.Time{}
	}
	return time.Unix(0, 0).Add(time.Duration(ft-epoch) * 100)
}

// signed reads a LONG, such as the RSSI, from the bits of a DWORD.
func signed(v uint32) int64 {
	if v >= 1<<31 {
		return int64(v) - 1<<32
	}
	return int64(v)
}
