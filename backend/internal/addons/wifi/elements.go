package wifi

import "encoding/binary"

// The information elements an access point sends in its beacons, as
// IEEE 802.11 numbers them: what tells how it is secured, which Wi-Fi
// generation it offers and how wide its channel is.
const (
	elementHTCapabilities  = 45
	elementRSN             = 48
	elementHTOperation     = 61
	elementVHTCapabilities = 191
	elementVHTOperation    = 192
	elementVendor          = 221
	elementExtension       = 255

	// Elements of the extension element, by their extension id.
	extensionHECapabilities  = 35
	extensionEHTCapabilities = 108
)

// readElements fills in what the access point's information elements ies
// tell: how it is secured, with privacy the capability bit that says it is
// encrypted, its newest Wi-Fi generation and its channel's width.
func readElements(ap *AccessPoint, ies []byte, privacy bool) {
	ap.Security = Security{Privacy: privacy}
	htWidth, vhtWidth := 0, 0
	for len(ies) >= 2 {
		id, size := ies[0], int(ies[1])
		if 2+size > len(ies) {
			break
		}
		data := ies[2 : 2+size]
		ies = ies[2+size:]
		switch id {
		case elementRSN:
			readRSN(&ap.Security, data)
		case elementVendor:
			// Microsoft's WPA element: 00:50:F2, type 1.
			if len(data) >= 4 && data[0] == 0x00 && data[1] == 0x50 && data[2] == 0xf2 && data[3] == 1 {
				ap.Security.WPA = true
			}
		case elementHTCapabilities:
			ap.Generation = max(ap.Generation, 4)
		case elementVHTCapabilities:
			ap.Generation = max(ap.Generation, 5)
		case elementHTOperation:
			// The secondary channel's offset, above (1) or below (3).
			htWidth = 20
			if len(data) >= 2 && data[1]&0x3 != 0 && data[1]&0x4 != 0 {
				htWidth = 40
			}
		case elementVHTOperation:
			vhtWidth = vhtChannelWidth(data)
		case elementExtension:
			if len(data) == 0 {
				continue
			}
			switch data[0] {
			case extensionHECapabilities:
				ap.Generation = max(ap.Generation, 6)
			case extensionEHTCapabilities:
				ap.Generation = max(ap.Generation, 7)
			}
		}
	}
	ap.WidthMHz = max(htWidth, vhtWidth)
}

// vhtChannelWidth reads the width from a VHT Operation element: 0 for 20 or
// 40 MHz, which the HT Operation element tells, 1 for 80 MHz or, with a
// second centre frequency 8 channels off the first, 160 MHz, and 2 and 3
// for the older ways of telling 160 and 80+80 MHz.
func vhtChannelWidth(data []byte) int {
	if len(data) < 3 {
		return 0
	}
	switch data[0] {
	case 1:
		if seg0, seg1 := int(data[1]), int(data[2]); seg1 != 0 && (seg1-seg0 == 8 || seg0-seg1 == 8) {
			return 160
		}
		return 80
	case 2, 3:
		return 160
	}
	return 0
}

// readRSN reads the ways to log in (AKM suites) an RSN element offers into
// s: its version, the group cipher, the pairwise ciphers and then the AKM
// suites, each a 4-byte suite after a 2-byte count.
func readRSN(s *Security, data []byte) {
	const pairwiseCount = 2 + 4
	if len(data) < pairwiseCount+2 {
		return
	}
	pairwise := int(binary.LittleEndian.Uint16(data[pairwiseCount:]))
	akmCount := pairwiseCount + 2 + 4*pairwise
	if len(data) < akmCount+2 {
		return
	}
	count := int(binary.LittleEndian.Uint16(data[akmCount:]))
	for i := range count {
		suite := data[akmCount+2+4*i:]
		if len(suite) < 4 {
			break
		}
		// The suites IEEE 802.11 defines, under its OUI 00:0F:AC.
		if suite[0] != 0x00 || suite[1] != 0x0f || suite[2] != 0xac {
			continue
		}
		switch suite[3] {
		case 1, 3, 5, 13: // 802.1X, with FT, SHA-256 or SHA-384
			s.WPA2, s.Enterprise = true, true
		case 2, 4, 6: // a pre-shared key, with FT or SHA-256
			s.WPA2 = true
		case 8, 9, 24, 25: // SAE, with FT or its longer keys
			s.WPA3 = true
		case 11, 12: // Suite B
			s.WPA3, s.Enterprise = true, true
		case 18: // OWE
			s.OWE = true
		}
	}
}
