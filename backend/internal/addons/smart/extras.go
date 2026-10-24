package smart

import (
	"log/slog"
	"sync/atomic"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// value is one kind of value of a disk, with what it is called.
type value struct {
	id     string
	label  string
	labels map[string]string
	unit   metrics.Unit
	get    func(Disk) *float64
}

var values = []value{
	{
		id: "temperature", label: "Temperature", unit: metrics.UnitCelsius,
		labels: map[string]string{"de": "Temperatur", "fr": "Température", "es": "Temperatura"},
		get:    func(d Disk) *float64 { return d.Celsius },
	},
	{
		id: "power-on-hours", label: "Power-on hours", unit: metrics.UnitNumber,
		labels: map[string]string{"de": "Betriebsstunden", "fr": "Heures de fonctionnement", "es": "Horas de funcionamiento"},
		get:    func(d Disk) *float64 { return d.PowerOnHours },
	},
	{
		id: "reallocated", label: "Reallocated sectors", unit: metrics.UnitNumber,
		labels: map[string]string{"de": "Ersetzte Sektoren", "fr": "Secteurs réalloués", "es": "Sectores reasignados"},
		get:    func(d Disk) *float64 { return d.ReallocatedSectors },
	},
	{
		id: "media-errors", label: "Media errors", unit: metrics.UnitNumber,
		labels: map[string]string{"de": "Medienfehler", "fr": "Erreurs de support", "es": "Errores de medio"},
		get:    func(d Disk) *float64 { return d.MediaErrors },
	},
	{
		id: "used", label: "Wear", unit: metrics.UnitPercent,
		labels: map[string]string{"de": "Verschleiß", "fr": "Usure", "es": "Desgaste"},
		get:    func(d Disk) *float64 { return d.PercentageUsed },
	},
}

// The translations of the disk's own check, of a disk that cannot be read,
// and of one with SMART switched off. Only labels have translations, so the label tells whether it passed
// and the text is a mark that needs none.
var (
	passedLabels     = map[string]string{"de": "SMART-Prüfung bestanden", "fr": "Contrôle SMART réussi", "es": "Comprobación SMART superada"}
	failedLabels     = map[string]string{"de": "SMART-Prüfung NICHT BESTANDEN", "fr": "Contrôle SMART ÉCHOUÉ", "es": "Comprobación SMART FALLIDA"}
	unreadableLabels = map[string]string{"de": "Kann nicht gelesen werden", "fr": "Ne peut pas être lu", "es": "No se puede leer"}
	smartOffLabels   = map[string]string{"de": "SMART aus", "fr": "SMART désactivé", "es": "SMART desactivado"}
)

// defaultMaxEntries is how many values of a group den-watcher keeps unless
// HISTORY_MAX_ENTRIES is set higher.
const defaultMaxEntries = 64

// warnedTooMany is whether Extras has logged that the disks report more
// values than defaultMaxEntries.
var warnedTooMany atomic.Bool

// Extras returns the disks as the groups of extras the collector shows: the
// disks' own checks, each labelled with the disk, such as "Samsung SSD 980
// (nvme0): SMART check passed", or for a disk that cannot be read any more or
// has SMART switched off only that, in place of its check; and the numbers
// the disks report, labelled the same way. Each value has its disk as its
// section, so the page shows a disk's values under it. The checks are a group of their
// own, so they are never among what den-watcher leaves out of a group with
// too many values: past defaultMaxEntries values, which about 21 SATA or 16
// NVMe disks reach, it keeps those whose ids come first unless HISTORY_MAX_ENTRIES is
// set higher, which is logged once. The values' group id is part of the name
// their history is kept under.
func Extras(disks []Disk) []metrics.Extra {
	checks := metrics.Extra{
		ID:          "smart-checks",
		Title:       "SMART checks",
		Titles:      map[string]string{"de": "SMART-Prüfungen", "fr": "Contrôles SMART", "es": "Comprobaciones SMART"},
		Description: "Whether each disk passes its own SMART self-assessment. A failed check means the disk expects to fail soon.",
		Descriptions: map[string]string{
			"de": "Ob jedes Laufwerk seine eigene SMART-Prüfung besteht. Eine nicht bestandene Prüfung heißt, dass das Laufwerk bald auszufallen droht.",
			"fr": "Si chaque disque réussit son propre contrôle SMART. Un contrôle échoué signifie que le disque risque de tomber en panne bientôt.",
			"es": "Si cada disco supera su propia comprobación SMART. Una comprobación fallida significa que el disco podría fallar pronto.",
		},
	}
	group := metrics.Extra{
		ID:          "smart",
		Title:       "Disk health",
		Titles:      map[string]string{"de": "Laufwerkszustand", "fr": "Santé des disques", "es": "Salud de los discos"},
		Description: "What each disk reports about itself: its temperature, hours in use, replaced sectors, media errors and how worn an SSD is. Rising error counts are an early warning.",
		Descriptions: map[string]string{
			"de": "Was jedes Laufwerk über sich meldet: Temperatur, Betriebsstunden, ersetzte Sektoren, Medienfehler und den Verschleiß einer SSD. Steigende Fehlerzahlen sind eine frühe Warnung.",
			"fr": "Ce que chaque disque indique sur lui-même : sa température, ses heures de fonctionnement, ses secteurs réalloués, ses erreurs de support et l'usure d'un SSD. Des erreurs en hausse sont un signe avant-coureur.",
			"es": "Lo que cada disco informa de sí mismo: su temperatura, horas de funcionamiento, sectores reasignados, errores de medio y el desgaste de un SSD. Si los errores aumentan, es una señal de alerta.",
		},
	}
	used := map[string]bool{}
	for _, disk := range disks {
		id := diskID(disk, used)
		used[id] = true
		prefix := disk.Name
		if disk.Model != "" {
			prefix = disk.Model + " (" + disk.Name + ")"
		}
		if disk.Passed != nil || disk.Unreadable || disk.SMARTOff {
			label, labels, text := "SMART check passed", passedLabels, "✓"
			switch {
			case disk.Unreadable:
				label, labels, text = "Cannot be read", unreadableLabels, "✗"
			case disk.SMARTOff:
				label, labels, text = "SMART off", smartOffLabels, "–"
			case !*disk.Passed:
				label, labels, text = "SMART check FAILED", failedLabels, "✗"
			}
			checks.Items = append(checks.Items, metrics.ExtraItem{
				ID:      id + "-health",
				Label:   prefix + ": " + label,
				Labels:  labelled(prefix, labels),
				Section: prefix,
				Unit:    metrics.UnitText,
				Text:    text,
			})
		}
		for _, v := range values {
			number := v.get(disk)
			if number == nil {
				continue
			}
			group.Items = append(group.Items, metrics.ExtraItem{
				ID:      id + "-" + v.id,
				Label:   prefix + ": " + v.label,
				Labels:  labelled(prefix, v.labels),
				Section: prefix,
				Unit:    v.unit,
				Value:   new(*number),
				History: true,
			})
		}
	}
	if len(group.Items) > defaultMaxEntries && !warnedTooMany.Swap(true) {
		slog.Warn("the disks report more values than den-watcher keeps by default, so some of them are left out; set HISTORY_MAX_ENTRIES higher on this device and its hub to keep them",
			"values", len(group.Items), "kept", defaultMaxEntries)
	}
	var extras []metrics.Extra
	for _, g := range []metrics.Extra{checks, group} {
		if len(g.Items) > 0 {
			extras = append(extras, g)
		}
	}
	return extras
}

// labelled puts prefix before each translation.
func labelled(prefix string, labels map[string]string) map[string]string {
	out := make(map[string]string, len(labels))
	for language, label := range labels {
		out[language] = prefix + ": " + label
	}
	return out
}

// diskID returns the start of the ids of a disk's values: its serial
// number, so a disk keeps its history when names such as sda go to other
// disks at a start. A disk without one, or with the same one as a disk
// before it, as some cheap disks report, is told by its name.
func diskID(disk Disk, used map[string]bool) string {
	if id := idOf(disk.Serial); id != "" && !used[id] {
		return id
	}
	if id := idOf(disk.Name); id != "" {
		return id
	}
	return "disk"
}

// maxDiskID is the longest start of an id, so that the longest value id,
// with "-power-on-hours", still fits in 40 characters.
const maxDiskID = 40 - len("-power-on-hours")

// idOf turns a serial number or a device name such as "Disk 0" into the
// start of an id, at most maxDiskID characters (see metrics.ShortID).
func idOf(name string) string {
	return metrics.ShortID(name, maxDiskID)
}
