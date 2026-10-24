package server

import (
	"bytes"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/Programmer-Den/den-watcher/backend/internal/alerts"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// localName is what GET /metrics calls the machine the site runs on when no
// DEVICE_NAME is set, as the page does.
const localName = "Host Hub"

// prometheusHandler serves GET /metrics: the current usage of every device in
// the Prometheus text format, for Prometheus to scrape and Grafana to show.
// The usage is read as for GET /api/devices/metrics, so a device that does
// not answer within fleetTimeout has denwatcher_device_up 0 and no values.
func prometheusHandler(devices Devices) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list := devices.List()
		usage := readAll(r.Context(), list)
		var out bytes.Buffer
		writePrometheus(&out, list, usage)
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		if _, err := w.Write(out.Bytes()); err != nil {
			slog.Error("write response", "error", err)
		}
	}
}

// label is one label of a sample, such as sensor="cpu_thermal".
type label struct {
	name, value string
}

// sample is one value of a metric, with its labels besides device and id.
type sample struct {
	labels []label
	value  string
}

// family is a metric with its help text, type and samples. Prometheus wants
// the samples of a metric together, so they are gathered for every device
// first and written after.
type family struct {
	name, help, kind string
	samples          []sample
	// seen has the labels of each sample, so a repeated one, as from a
	// device that lists the same disk twice, is left out: Prometheus refuses
	// the whole scrape for one.
	seen map[string]bool
}

// exposition gathers the families in the order they are first used.
type exposition struct {
	families []*family
	byName   map[string]*family
	// device are the labels of the device whose values are added now.
	device []label
}

func (e *exposition) add(name, kind, help, value string, labels ...label) {
	f := e.byName[name]
	if f == nil {
		f = &family{name: name, help: help, kind: kind, seen: map[string]bool{}}
		e.byName[name] = f
		e.families = append(e.families, f)
	}
	all := make([]label, 0, len(labels)+len(e.device))
	all = append(append(all, e.device...), labels...)
	var key strings.Builder
	for _, l := range all {
		key.WriteString(l.name + "\x00" + l.value + "\x00")
	}
	if f.seen[key.String()] {
		return
	}
	f.seen[key.String()] = true
	f.samples = append(f.samples, sample{labels: all, value: value})
}

// gauge adds a value that goes up and down.
func (e *exposition) gauge(name, help string, value float64, labels ...label) {
	e.add(name, "gauge", help, formatFloat(value), labels...)
}

// counter adds a value that only goes up, until the device starts again.
func (e *exposition) counter(name, help string, value uint64, labels ...label) {
	e.add(name, "counter", help, strconv.FormatUint(value, 10), labels...)
}

// optional adds value as a gauge when it is known.
func (e *exposition) optional(name, help string, value *float64, labels ...label) {
	if value != nil {
		e.gauge(name, help, *value, labels...)
	}
}

// writePrometheus writes the usage of the devices in list, by their id in
// usage, in the Prometheus text format to out.
func writePrometheus(out *bytes.Buffer, list []Device, usage map[string]metrics.Snapshot) {
	e := &exposition{byName: map[string]*family{}}
	for _, d := range list {
		name := d.Name
		if name == "" {
			name = localName
		}
		e.device = []label{{"device", name}, {"id", d.ID}}
		snapshot, up := usage[d.ID]
		e.gauge("denwatcher_device_up", "1 when the device answered, 0 when it did not.", boolValue(up))
		for _, level := range []alerts.Level{alerts.Warning, alerts.Critical} {
			count := 0
			for _, a := range d.Alerts {
				if a.Level == level {
					count++
				}
			}
			e.gauge("denwatcher_alerts", "Alerts of the device that last now, by level.", float64(count), label{"level", string(level)})
		}
		if up {
			addSnapshot(e, snapshot)
		}
	}
	for _, f := range e.families {
		out.WriteString("# HELP " + f.name + " " + escapeHelp(f.help) + "\n")
		out.WriteString("# TYPE " + f.name + " " + f.kind + "\n")
		for _, s := range f.samples {
			out.WriteString(f.name)
			out.WriteByte('{')
			for i, l := range s.labels {
				if i > 0 {
					out.WriteByte(',')
				}
				out.WriteString(l.name + `="` + escapeLabel(l.value) + `"`)
			}
			out.WriteString("} " + s.value + "\n")
		}
	}
}

// addSnapshot adds the values of one device's usage. Uptime, CPU and memory
// are left out where they are 0, as a router read over UPnP or a check does
// not report them; the page leaves out their cards the same way.
func addSnapshot(e *exposition, s metrics.Snapshot) {
	if s.UptimeSeconds > 0 {
		e.gauge("denwatcher_uptime_seconds", "Time since the device started.", float64(s.UptimeSeconds))
	}
	if r := s.ResponseMilliseconds; r != nil {
		e.gauge("denwatcher_response_seconds", "How long the device took to answer the hub's last reading of it.", *r/1000)
	}

	if s.CPU.Cores > 0 {
		e.gauge("denwatcher_cpu_usage_percent", "Processor usage across all cores.", s.CPU.UsagePercent)
		e.gauge("denwatcher_cpu_cores", "Number of processor cores.", float64(s.CPU.Cores))
	}
	for i, usage := range s.CPU.CoreUsagePercent {
		e.gauge("denwatcher_cpu_core_usage_percent", "Usage of one processor core.", usage, label{"core", strconv.Itoa(i)})
	}
	if s.CPU.ClockMHz > 0 {
		e.gauge("denwatcher_cpu_clock_mhz", "Processor clock.", s.CPU.ClockMHz)
	}
	if l := s.CPU.LoadAverage; l != nil {
		e.gauge("denwatcher_load1", "Load average over 1 minute.", l.One)
		e.gauge("denwatcher_load5", "Load average over 5 minutes.", l.Five)
		e.gauge("denwatcher_load15", "Load average over 15 minutes.", l.Fifteen)
	}
	e.optional("denwatcher_cpu_iowait_percent", "Share of time the processor waited for disks and the network.", s.CPU.IOWaitPercent)
	e.optional("denwatcher_cpu_steal_percent", "Share of time a virtual machine's processor was taken by others.", s.CPU.StealPercent)
	if p := s.CPU.Processes; p != nil {
		e.gauge("denwatcher_processes", "Number of processes.", float64(p.Total))
		e.gauge("denwatcher_processes_running", "Number of processes running now.", float64(p.Running))
	}

	m := s.Memory
	if m.TotalBytes > 0 {
		e.gauge("denwatcher_memory_total_bytes", "Size of the main memory.", float64(m.TotalBytes))
		e.gauge("denwatcher_memory_used_bytes", "Main memory in use.", float64(m.UsedBytes))
		e.gauge("denwatcher_memory_used_percent", "Share of the main memory in use.", m.UsedPercent)
	}
	if m.AvailableBytes > 0 {
		e.gauge("denwatcher_memory_available_bytes", "Main memory programs can still get, the cache included.", float64(m.AvailableBytes))
	}
	if m.CachedBytes > 0 {
		e.gauge("denwatcher_memory_cached_bytes", "Main memory used as cache.", float64(m.CachedBytes))
	}
	if sw := m.Swap; sw != nil {
		e.gauge("denwatcher_swap_total_bytes", "Size of the swap space.", float64(sw.TotalBytes))
		e.gauge("denwatcher_swap_used_bytes", "Swap space in use.", float64(sw.UsedBytes))
		e.gauge("denwatcher_swap_used_percent", "Share of the swap space in use.", sw.UsedPercent)
	}

	for _, t := range s.Temperatures {
		e.gauge("denwatcher_temperature_celsius", "Temperature of one sensor.", t.Celsius, label{"sensor", t.Sensor})
	}

	for _, d := range s.Disks {
		path := label{"path", d.Path}
		e.gauge("denwatcher_disk_total_bytes", "Size of the filesystem holding the path.", float64(d.TotalBytes), path)
		e.gauge("denwatcher_disk_used_bytes", "Space in use on the filesystem.", float64(d.UsedBytes), path)
		e.gauge("denwatcher_disk_used_percent", "Share of the filesystem in use.", d.UsedPercent, path)
		e.optional("denwatcher_disk_read_bytes_per_second", "Bytes read from the disk per second.", d.ReadBytesPerSecond, path)
		e.optional("denwatcher_disk_write_bytes_per_second", "Bytes written to the disk per second.", d.WriteBytesPerSecond, path)
		e.optional("denwatcher_disk_operations_per_second", "Reads and writes of the disk per second.", d.OperationsPerSecond, path)
		e.optional("denwatcher_disk_busy_percent", "Share of time the disk was busy.", d.BusyPercent, path)
		if d.LatencyMs != nil {
			e.gauge("denwatcher_disk_latency_seconds", "Average time a read or write of the disk took.", *d.LatencyMs/1000, path)
		}
	}

	for _, n := range s.Network {
		iface := label{"interface", n.Name}
		e.counter("denwatcher_network_received_bytes_total", "Bytes received since the device started.", n.ReceivedBytes, iface)
		e.counter("denwatcher_network_sent_bytes_total", "Bytes sent since the device started.", n.SentBytes, iface)
		e.gauge("denwatcher_network_receive_bytes_per_second", "Bytes received per second.", n.ReceiveBytesPerSecond, iface)
		e.gauge("denwatcher_network_send_bytes_per_second", "Bytes sent per second.", n.SendBytesPerSecond, iface)
		e.counter("denwatcher_network_errors_total", "Packets that arrived or left broken since the device started.", n.Errors, iface)
		e.counter("denwatcher_network_dropped_total", "Packets the interface threw away since the device started.", n.Dropped, iface)
		if n.LinkMbps > 0 {
			e.gauge("denwatcher_network_link_mbps", "Speed the interface is connected at, in Mbit/s.", float64(n.LinkMbps), iface)
		}
	}

	for _, g := range s.GPUs {
		gpu := label{"gpu", g.Name}
		e.gauge("denwatcher_gpu_usage_percent", "Usage of the graphics processor.", g.UsagePercent, gpu)
		if g.MemoryTotalBytes > 0 {
			e.gauge("denwatcher_gpu_memory_total_bytes", "Size of the graphics processor's own memory.", float64(g.MemoryTotalBytes), gpu)
			e.gauge("denwatcher_gpu_memory_used_bytes", "Graphics memory in use.", float64(g.MemoryUsedBytes), gpu)
		}
		e.optional("denwatcher_gpu_temperature_celsius", "Temperature of the graphics processor.", g.Celsius, gpu)
	}

	if b := s.Battery; b != nil {
		e.gauge("denwatcher_battery_percent", "Charge of the batteries.", b.Percent)
		e.gauge("denwatcher_battery_plugged_in", "1 when the device runs on mains power.", boolValue(b.PluggedIn))
		e.optional("denwatcher_battery_watts", "Power flowing into or out of the batteries.", b.Watts)
		e.optional("denwatcher_battery_health_percent", "What the batteries hold compared to when they were new.", b.HealthPercent)
	}

	for _, f := range s.Fans {
		e.gauge("denwatcher_fan_rpm", "Speed of one fan.", f.RPM, label{"fan", f.Name})
	}

	for _, group := range s.Extras {
		for _, item := range group.Items {
			if item.Unit == metrics.UnitText || item.Value == nil {
				continue
			}
			labels := []label{{"group", group.ID}, {"item", item.ID}, {"unit", string(item.Unit)}, {"label", item.Label}}
			if item.Section != "" {
				labels = append(labels, label{"section", item.Section})
			}
			e.gauge("denwatcher_extra", "A value of an add-on or other extra, in the unit its label names.", *item.Value, labels...)
		}
	}
}

func boolValue(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// formatFloat writes a value as Prometheus reads it, NaN and +Inf and -Inf
// included.
func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'g', -1, 64)
}

var (
	// labelEscaper escapes a label value: a backslash, a double quote and a
	// line feed. Prometheus reads label values as UTF-8, so invalid bytes,
	// as a sensor's name could have, are replaced first.
	labelEscaper = strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`)
	// helpEscaper escapes a help text: a backslash and a line feed.
	helpEscaper = strings.NewReplacer(`\`, `\\`, "\n", `\n`)
)

func escapeLabel(s string) string { return labelEscaper.Replace(strings.ToValidUTF8(s, "\uFFFD")) }

func escapeHelp(s string) string { return helpEscaper.Replace(s) }
