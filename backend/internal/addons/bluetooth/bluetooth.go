// Package bluetooth reads the Bluetooth devices connected to the machine,
// for the Bluetooth add-on. On Linux it asks BlueZ, the Bluetooth service,
// over the system D-Bus for the name, kind and battery of each connected
// device (see bluez.go), and where BlueZ cannot be asked, counts the
// connections the kernel lists in /sys/class/bluetooth (see sysfs.go). On
// Windows it asks the Bluetooth API for the connected classic devices and the
// device query for the connected Bluetooth Low Energy ones (see
// reader_windows.go and le_windows.go). Other systems report nothing.
//
// It only reads; nothing in here changes the machine or its Bluetooth: it
// starts no scan and connects or disconnects nothing.
package bluetooth

import (
	"cmp"
	"fmt"
	"hash/crc32"
	"slices"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// Reading is what the machine's Bluetooth reports at one read.
type Reading struct {
	// Connected is how many devices are connected.
	Connected int
	// Devices are the connected devices, when the system tells which they
	// are: the kernel's connections only tell how many there are.
	Devices []Device
}

// Device is one connected device.
type Device struct {
	// Key tells the device apart from every other one: its address, which
	// is never shown.
	Key string
	// Name is the name the device gives itself, or the one its owner gave
	// it; empty when it has none.
	Name string
	Kind Kind
	// Battery is the device's battery level in percent, when HasBattery is
	// true.
	Battery    int
	HasBattery bool
}

// WithoutNames returns the reading with every device's name left out, so
// each is shown by its kind: names often carry their owner's name, such as
// "Anna's AirPods". A nil reading stays nil.
func (r *Reading) WithoutNames() *Reading {
	if r == nil {
		return nil
	}
	devices := slices.Clone(r.Devices)
	for i := range devices {
		devices[i].Name = ""
	}
	return &Reading{Connected: r.Connected, Devices: devices}
}

// Kind is what sort of device a device is.
type Kind int

// The kinds of device told apart. A device of another kind, or one that does
// not say, is KindOther.
const (
	KindOther Kind = iota
	KindHeadphones
	KindSpeaker
	KindKeyboard
	KindMouse
	KindGameController
	KindPhone
	KindComputer
)

// kindNames names each kind, in English and in the other languages.
var kindNames = [...]struct{ en, de, fr, es string }{
	KindOther:          {"Device", "Gerät", "Appareil", "Dispositivo"}, //nolint:misspell // French
	KindHeadphones:     {"Headphones", "Kopfhörer", "Casque", "Auriculares"},
	KindSpeaker:        {"Speaker", "Lautsprecher", "Haut-parleur", "Altavoz"},
	KindKeyboard:       {"Keyboard", "Tastatur", "Clavier", "Teclado"},
	KindMouse:          {"Mouse", "Maus", "Souris", "Ratón"},
	KindGameController: {"Game controller", "Gamecontroller", "Manette de jeu", "Mando de juego"},
	KindPhone:          {"Phone", "Telefon", "Téléphone", "Teléfono"},
	KindComputer:       {"Computer", "Computer", "Ordinateur", "Ordenador"},
}

// classKind returns the kind of a classic Bluetooth device from its class of
// device, as the Bluetooth specification's assigned numbers define it: the
// major class in bits 8 to 12, and a minor class below it.
func classKind(class uint32) Kind {
	minor := class >> 2 & 0x3f
	switch class >> 8 & 0x1f {
	case 1:
		return KindComputer
	case 2:
		return KindPhone
	case 4: // audio and video
		switch minor {
		case 1, 2, 6: // headset, hands-free, headphones
			return KindHeadphones
		case 5: // loudspeaker
			return KindSpeaker
		}
	case 5: // peripheral: keyboard and pointing device in bits 6 and 7
		switch minor >> 4 {
		case 1, 3:
			return KindKeyboard
		case 2:
			return KindMouse
		}
		if minor&0xf == 1 || minor&0xf == 2 { // joystick, gamepad
			return KindGameController
		}
	}
	return KindOther
}

// appearanceKind returns the kind of a Bluetooth Low Energy device from the
// appearance it gives, as the Bluetooth specification's assigned numbers
// define it: the category in bits 6 to 15, and a subcategory below it.
func appearanceKind(appearance uint16) Kind {
	switch appearance >> 6 {
	case 0x001:
		return KindPhone
	case 0x002:
		return KindComputer
	case 0x00f: // human interface device
		switch appearance & 0x3f {
		case 1:
			return KindKeyboard
		case 2:
			return KindMouse
		case 3, 4: // joystick, gamepad
			return KindGameController
		}
	case 0x021: // audio sink
		return KindSpeaker
	case 0x025: // wearable audio device: earbud, headset, headphones
		return KindHeadphones
	}
	return KindOther
}

// Extras returns the reading as the group of extras the collector shows: how
// many devices are connected, with its history, and a row per connected
// device the system tells, ordered by what the row is called: the device's
// name, or its kind where it has none. Beside it the row shows the device's
// battery level where it tells one, else its kind, or that it is connected. A machine without Bluetooth
// (reading is nil) shows nothing.
func Extras(reading *Reading) []metrics.Extra {
	if reading == nil {
		return nil
	}
	group := metrics.Extra{
		ID:          "bluetooth",
		Title:       "Bluetooth",
		Description: "The Bluetooth devices connected to the machine, each with its battery level or its kind.",
		Descriptions: map[string]string{
			"de": "Die mit dem Gerät verbundenen Bluetooth-Geräte, jeweils mit Akkustand oder Geräteart.",
			"fr": "Les appareils Bluetooth connectés à la machine, chacun avec son niveau de batterie ou son type.",
			"es": "Los dispositivos Bluetooth conectados al equipo, cada uno con su nivel de batería o su tipo.",
		},
		Items: []metrics.ExtraItem{{
			ID:    "connected",
			Label: "Connected devices",
			Labels: map[string]string{
				"de": "Verbundene Geräte",
				"fr": "Appareils connectés",
				"es": "Dispositivos conectados",
			},
			Unit:    metrics.UnitNumber,
			Value:   new(float64(reading.Connected)),
			History: true,
		}},
	}
	var items []metrics.ExtraItem
	for _, d := range reading.Devices {
		kind := kindNames[KindOther]
		if int(d.Kind) < len(kindNames) {
			kind = kindNames[d.Kind]
		}
		item := metrics.ExtraItem{
			ID:    idOf(d.Key),
			Label: d.Name,
			Unit:  metrics.UnitText,
			Text:  kind.en,
			Texts: map[string]string{"de": kind.de, "fr": kind.fr, "es": kind.es},
		}
		if d.Name == "" {
			// Without a name, the kind names the device, and the row says
			// only that it is connected.
			item.Label = kind.en
			item.Labels = map[string]string{"de": kind.de, "fr": kind.fr, "es": kind.es}
			item.Text = "connected"
			item.Texts = map[string]string{"de": "verbunden", "fr": "connecté", "es": "conectado"}
		}
		if d.HasBattery {
			// The battery takes the kind's place, as the row has room for
			// one short text beside the name, and the name mostly tells the
			// kind anyway.
			item.Text = fmt.Sprintf("Battery %d%%", d.Battery)
			item.Texts = map[string]string{
				"de": fmt.Sprintf("Akku %d %%", d.Battery),
				"fr": fmt.Sprintf("Batterie %d %%", d.Battery),
				"es": fmt.Sprintf("Batería %d %%", d.Battery),
			}
		}
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b metrics.ExtraItem) int {
		return cmp.Or(cmp.Compare(strings.ToLower(a.Label), strings.ToLower(b.Label)), cmp.Compare(a.ID, b.ID))
	})
	group.Items = append(group.Items, items...)
	return []metrics.Extra{group}
}

// idOf turns a device's address into the id of its row: "device-" and a
// checksum of the address, so the page and the history never carry the
// address itself.
func idOf(key string) string {
	return fmt.Sprintf("device-%08x", crc32.ChecksumIEEE([]byte(strings.ToUpper(key))))
}
