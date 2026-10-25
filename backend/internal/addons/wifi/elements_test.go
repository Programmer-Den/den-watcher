package wifi

import "testing"

// element returns an information element with id and data.
func element(id byte, data ...byte) []byte {
	return append([]byte{id, byte(len(data))}, data...)
}

// rsn returns an RSN element with CCMP and the AKM suites akms.
func rsn(akms ...byte) []byte {
	data := []byte{1, 0, 0x00, 0x0f, 0xac, 4, 1, 0, 0x00, 0x0f, 0xac, 4, byte(len(akms)), 0}
	for _, akm := range akms {
		data = append(data, 0x00, 0x0f, 0xac, akm)
	}
	return element(elementRSN, data...)
}

func TestReadElements(t *testing.T) {
	join := func(parts ...[]byte) []byte {
		var all []byte
		for _, p := range parts {
			all = append(all, p...)
		}
		return all
	}
	for _, c := range []struct {
		name       string
		ies        []byte
		privacy    bool
		want       Security
		generation int
		width      int
	}{
		{"open", join(element(0, 'x'), element(elementHTCapabilities, 0, 0)), false, Security{}, 4, 0},
		{"WEP", nil, true, Security{Privacy: true}, 0, 0},
		{
			"WPA2 and WPA3 on Wi-Fi 6 at 80 MHz",
			join(rsn(2, 8), element(elementHTOperation, 36, 0x05), element(elementVHTOperation, 1, 42, 0), element(elementExtension, extensionHECapabilities, 0)),
			true,
			Security{Privacy: true, WPA2: true, WPA3: true},
			6, 80,
		},
		{
			"WPA and WPA2 at 40 MHz",
			join(element(elementVendor, 0x00, 0x50, 0xf2, 1, 1, 0), rsn(2), element(elementHTOperation, 1, 0x07)),
			true,
			Security{Privacy: true, WPA: true, WPA2: true},
			0, 40,
		},
		{
			"WPA2 Enterprise at 160 MHz",
			join(rsn(1, 5), element(elementVHTCapabilities, 0), element(elementVHTOperation, 1, 42, 50)),
			true,
			Security{Privacy: true, WPA2: true, Enterprise: true},
			5, 160,
		},
		{"OWE on Wi-Fi 7", join(rsn(18), element(elementExtension, extensionEHTCapabilities)), true, Security{Privacy: true, OWE: true}, 7, 0},
		{"cut short", append(rsn(2), elementRSN, 40, 1), true, Security{Privacy: true, WPA2: true}, 0, 0},
	} {
		var ap AccessPoint
		readElements(&ap, c.ies, c.privacy)
		if ap.Security != c.want || ap.Generation != c.generation || ap.WidthMHz != c.width {
			t.Errorf("%s: %+v, generation %d, width %d; want %+v, %d, %d", c.name, ap.Security, ap.Generation, ap.WidthMHz, c.want, c.generation, c.width)
		}
	}
}
