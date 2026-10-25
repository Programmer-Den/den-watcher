package bluetooth

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

func TestClassKind(t *testing.T) {
	for class, want := range map[uint32]Kind{
		0x240404: KindHeadphones,     // wearable headset
		0x240418: KindHeadphones,     // headphones
		0x240414: KindSpeaker,        // loudspeaker
		0x002540: KindKeyboard,       // keyboard
		0x002580: KindMouse,          // mouse
		0x0025c0: KindKeyboard,       // keyboard and mouse in one
		0x002508: KindGameController, // gamepad
		0x5a020c: KindPhone,          // smartphone
		0x3c010c: KindComputer,       // laptop
		0x000000: KindOther,
		0x240420: KindOther, // car audio
	} {
		if got := classKind(class); got != want {
			t.Errorf("classKind(%#06x) = %v, want %v", class, got, want)
		}
	}
}

func TestAppearanceKind(t *testing.T) {
	for appearance, want := range map[uint16]Kind{
		0x03c4: KindGameController, // gamepad, as an Xbox controller gives
		0x03c3: KindGameController, // joystick
		0x03c1: KindKeyboard,
		0x03c2: KindMouse,
		0x03c0: KindOther,      // a human interface device of no named sort
		0x0941: KindHeadphones, // earbud
		0x0841: KindSpeaker,
		0x0040: KindPhone,
		0x0080: KindComputer,
		0x0000: KindOther,
	} {
		if got := appearanceKind(appearance); got != want {
			t.Errorf("appearanceKind(%#06x) = %v, want %v", appearance, got, want)
		}
	}
}

func TestExtrasWithoutBluetoothShowNothing(t *testing.T) {
	if got := Extras(nil); got != nil {
		t.Errorf("Extras(nil) = %+v, want nothing", got)
	}
}

func TestExtrasCountOnly(t *testing.T) {
	got := Extras(&Reading{Connected: 0})

	if len(got) != 1 || got[0].ID != "bluetooth" || len(got[0].Items) != 1 {
		t.Fatalf("Extras() = %+v, want one group with the count", got)
	}
	item := got[0].Items[0]
	if item.ID != "connected" || !item.History || *item.Value != 0 || item.Labels["de"] != "Verbundene Geräte" {
		t.Errorf("count = %+v, want 0 connected devices with history", item)
	}
}

func TestExtrasNameEachDevice(t *testing.T) {
	reading := &Reading{Connected: 3, Devices: []Device{
		{Key: "AA:BB:CC:DD:EE:01", Name: "MX Keys", Kind: KindKeyboard},
		{Key: "AA:BB:CC:DD:EE:02", Name: "anna's buds", Kind: KindHeadphones, Battery: 80, HasBattery: true},
		{Key: "AA:BB:CC:DD:EE:03", Kind: KindMouse},
	}}

	got := metrics.CleanExtras(Extras(reading), 64)

	if len(got) != 1 {
		t.Fatalf("Extras() = %+v, want one group", got)
	}
	var rows []string
	for _, item := range got[0].Items[1:] {
		if item.Unit != metrics.UnitText || item.History {
			t.Errorf("row %s = %+v, want text without history", item.ID, item)
		}
		rows = append(rows, item.Label+": "+item.Text+" / "+item.Texts["de"])
	}
	want := []string{
		"anna's buds: Battery 80% / Akku 80 %",
		"Mouse: connected / verbunden",
		"MX Keys: Keyboard / Tastatur",
	}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("rows = %q, want %q", rows, want)
	}
	if unnamed := got[0].Items[2]; unnamed.Label != "Mouse" || unnamed.Labels["fr"] != "Souris" {
		t.Errorf("the device without a name = %+v, want it named by its kind", unnamed)
	}
	data, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(strings.ToUpper(string(data)), "AA:BB") {
		t.Errorf("the extras carry an address: %s", data)
	}
	if got[0].Items[1].ID == got[0].Items[2].ID || !metrics.ValidID(got[0].Items[1].ID) {
		t.Errorf("ids = %q and %q, want valid and apart", got[0].Items[1].ID, got[0].Items[2].ID)
	}
}
