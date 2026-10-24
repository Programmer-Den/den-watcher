// Package reach checks whether things on the local network that cannot run
// den-watcher answer, such as a printer, a NAS or an IP camera, so a hub can
// show them as devices of their own: with a TCP connection to a port, or a
// ping where no port is given.
//
// It only connects: nothing is sent over a TCP connection, which is closed
// as soon as it is open. It only connects to the local network.
package reach

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/lan"
	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// Config is a thing the hub checks, from HUB_CHECKS.
type Config struct {
	Name string
	// Host is its host name or IP address.
	Host string
	// Port is the TCP port that is connected to, or 0 to ping.
	Port int
}

// Address is the host with the port, as host:port, or the host alone for a
// ping.
func (c Config) Address() string {
	if c.Port == 0 {
		return c.Host
	}
	return net.JoinHostPort(c.Host, strconv.Itoa(c.Port))
}

// hostPattern matches a host name or IPv4 address, or an IPv6 address in
// brackets, with an optional port.
var hostPattern = regexp.MustCompile(`^([A-Za-z0-9.-]+|\[[0-9A-Fa-f:.]+\])(?::([0-9]{1,5}))?$`)

// ParseConfigs reads the things to check from a comma-separated list of
// entries such as "Printer=192.168.1.50:631" or "NAS=192.168.1.10".
func ParseConfigs(value string) ([]Config, error) {
	var configs []Config
	for _, entry := range strings.Split(value, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		config, err := parseConfig(entry)
		if err != nil {
			return nil, fmt.Errorf("%q: %w", entry, err)
		}
		configs = append(configs, config)
	}
	return configs, nil
}

func parseConfig(entry string) (Config, error) {
	name, address, named := strings.Cut(entry, "=")
	if !named || strings.TrimSpace(name) == "" {
		return Config{}, errors.New("write each check as name=address:port, such as Printer=192.168.1.50:631, or name=address to ping, such as NAS=192.168.1.10")
	}
	match := hostPattern.FindStringSubmatch(strings.TrimSpace(address))
	if match == nil {
		return Config{}, errors.New("the address must be a host name or IP address, with a port to connect to or without one to ping, such as 192.168.1.50:631")
	}
	config := Config{Name: strings.TrimSpace(name), Host: strings.Trim(match[1], "[]")}
	if match[2] != "" {
		port, _ := strconv.Atoi(match[2])
		if port < 1 || port > 65535 {
			return Config{}, errors.New("the port must be a number from 1 to 65535")
		}
		config.Port = port
	}
	return config, nil
}

const (
	// timeout is how long a check waits for an answer.
	timeout = 4 * time.Second
	// interval is how often a thing that answered is checked again.
	interval = 15 * time.Second
	// pings is how many pings each check of a thing without a port sends,
	// pingSpacing apart, to tell the share that is lost and how much the
	// answers vary: 5 pings of 16 bytes every 15 seconds.
	pings       = 5
	pingSpacing = 200 * time.Millisecond
)

// result is what one check found: how long the answer took, and for a ping
// the share of the pings that got no answer and the jitter, the mean
// difference between the times of answers one after the other; nil when
// not measured.
type result struct {
	took        time.Duration
	lossPercent *float64
	jitter      *time.Duration
}

// Reader checks one thing.
type Reader struct {
	config Config
	// ping sends one ping to addr and returns how long the answer took;
	// replaced in tests.
	ping func(ctx context.Context, addr netip.Addr) (time.Duration, error)
	// dial connects to address; replaced in tests.
	dial func(ctx context.Context, address string) (net.Conn, error)
	// local tells whether an address is on the local network.
	local func(addr netip.Addr) bool
	// spacing is the time between the pings of a check; pingSpacing but in
	// tests.
	spacing time.Duration

	mu     sync.Mutex
	latest metrics.Snapshot
	at     time.Time
}

// New returns the reader that checks config.
func New(config Config) *Reader {
	dialer := &net.Dialer{Timeout: timeout, Control: lan.Control}
	return &Reader{
		config: config,
		ping:   ping,
		dial: func(ctx context.Context, address string) (net.Conn, error) {
			return dialer.DialContext(ctx, "tcp", address)
		},
		local:   lan.Default.Local,
		spacing: pingSpacing,
	}
}

// Collect checks the thing, at most once per interval while it answers, and
// fails when it does not answer, which the hub counts as an outage. A failed
// check is not kept: the next one asks again.
func (r *Reader) Collect(ctx context.Context) (metrics.Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.at.IsZero() && time.Since(r.at) < interval {
		return r.latest, nil
	}
	found, err := r.check(ctx)
	if err != nil {
		r.at = time.Time{}
		return metrics.Snapshot{}, err
	}
	r.latest, r.at = snapshot(r.config, found), time.Now()
	return r.latest, nil
}

// check connects to the port, or pings the host, and returns what it found.
func (r *Reader) check(ctx context.Context) (result, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	if r.config.Port != 0 {
		start := time.Now()
		conn, err := r.dial(ctx, r.config.Address())
		if err != nil {
			return result{}, err
		}
		took := time.Since(start)
		_ = conn.Close()
		return result{took: took}, nil
	}
	addr, err := r.resolve(ctx)
	if err != nil {
		return result{}, err
	}
	return r.pingBurst(ctx, addr)
}

// pingBurst sends pings pings to addr, r.spacing apart, each waiting for
// its answer until ctx is done, and fails only when none is answered. A
// ping that gets no answer counts as lost.
func (r *Reader) pingBurst(ctx context.Context, addr netip.Addr) (result, error) {
	times := make([]time.Duration, pings)
	errs := make([]error, pings)
	var wait sync.WaitGroup
	for i := range pings {
		wait.Go(func() {
			select {
			case <-time.After(time.Duration(i) * r.spacing):
				times[i], errs[i] = r.ping(ctx, addr)
			case <-ctx.Done():
				errs[i] = ctx.Err()
			}
		})
	}
	wait.Wait()
	return burstResult(times, errs)
}

// burstResult turns the times of the pings, in the order they were sent, into
// a result: the response time is the mean of the answers. Without any, it
// fails with the error of the first ping.
func burstResult(times []time.Duration, errs []error) (result, error) {
	var answered []time.Duration
	for i, took := range times {
		if errs[i] == nil {
			answered = append(answered, took)
		}
	}
	if len(answered) == 0 {
		// The pings fail alike, so the first tells why.
		return result{}, errs[0]
	}
	var sum time.Duration
	for _, took := range answered {
		sum += took
	}
	loss := float64(len(times)-len(answered)) / float64(len(times)) * 100
	found := result{took: sum / time.Duration(len(answered)), lossPercent: &loss}
	if len(answered) > 1 {
		var differences time.Duration
		for i := 1; i < len(answered); i++ {
			differences += (answered[i] - answered[i-1]).Abs()
		}
		jitter := differences / time.Duration(len(answered)-1)
		found.jitter = &jitter
	}
	return found, nil
}

// resolve returns the IPv4 address of the host to ping, which must be on the
// local network.
func (r *Reader) resolve(ctx context.Context) (netip.Addr, error) {
	addr, err := netip.ParseAddr(r.config.Host)
	if err != nil {
		addrs, err := net.DefaultResolver.LookupNetIP(ctx, "ip4", r.config.Host)
		if err != nil {
			return netip.Addr{}, err
		}
		if len(addrs) == 0 {
			return netip.Addr{}, fmt.Errorf("%s has no IPv4 address", r.config.Host)
		}
		addr = addrs[0]
	}
	addr = addr.Unmap()
	if !addr.Is4() {
		return netip.Addr{}, fmt.Errorf("%s: only IPv4 addresses can be pinged; give a port to connect to instead", r.config.Host)
	}
	if !r.local(addr) {
		return netip.Addr{}, fmt.Errorf("%s is not on the local network", addr)
	}
	return addr, nil
}

// snapshot is what the page shows of a thing that answered: how long the
// answer took, for a ping the packet loss and jitter, each with its history,
// and how it is checked.
func snapshot(config Config, found result) metrics.Snapshot {
	ms := milliseconds(found.took)
	method := metrics.ExtraItem{
		ID: "method", Label: "Checked with", Unit: metrics.UnitText, Text: "Ping",
		Labels: map[string]string{"de": "Geprüft mit", "fr": "Vérifié par", "es": "Comprobado con"},
	}
	if config.Port != 0 {
		port := strconv.Itoa(config.Port)
		method.Text = "TCP port " + port
		method.Texts = map[string]string{"de": "TCP-Port " + port, "fr": "Port TCP " + port, "es": "Puerto TCP " + port}
	}
	items := []metrics.ExtraItem{{
		ID: "response-time", Label: "Response time", Unit: metrics.UnitMilliseconds, Value: &ms, History: true,
		Labels: map[string]string{"de": "Antwortzeit", "fr": "Temps de réponse", "es": "Tiempo de respuesta"},
	}}
	if found.lossPercent != nil {
		items = append(items, metrics.ExtraItem{
			ID: "packet-loss", Label: "Packet loss", Unit: metrics.UnitPercent, Value: found.lossPercent, History: true,
			Labels: map[string]string{"de": "Paketverlust", "fr": "Perte de paquets", "es": "Pérdida de paquetes"},
		})
	}
	if found.jitter != nil {
		jitter := milliseconds(*found.jitter)
		items = append(items, metrics.ExtraItem{
			ID: "jitter", Label: "Jitter", Unit: metrics.UnitMilliseconds, Value: &jitter, History: true,
			Labels: map[string]string{"de": "Jitter", "fr": "Gigue", "es": "Fluctuación"},
		})
	}
	items = append(items, method)
	description := "How long it took to answer the hub, which checks it every 15 seconds. It runs no den-watcher, so this is all the hub knows of it."
	descriptions := map[string]string{
		"de": "Wie lange die Antwort an den Hub dauerte, der alle 15 Sekunden prüft. Hier läuft kein den-watcher, daher weiß der Hub nur das.",
		"fr": "Le temps de réponse au hub, qui vérifie toutes les 15 secondes. Aucun den-watcher n'y tourne, le hub ne sait donc que cela.",
		"es": "El tiempo que tardó en responder al hub, que lo comprueba cada 15 segundos. No ejecuta den-watcher, así que es todo lo que el hub sabe.",
	}
	if config.Port == 0 {
		description = "How long it took to answer the hub, which pings it 5 times every 15 seconds, how many of the pings got no answer, and how much the answers varied. It runs no den-watcher, so this is all the hub knows of it."
		descriptions = map[string]string{
			"de": "Wie lange die Antwort an den Hub dauerte, der alle 15 Sekunden 5 Pings sendet, wie viele davon keine Antwort bekamen und wie stark die Antworten schwankten. Hier läuft kein den-watcher, daher weiß der Hub nur das.",
			"fr": "Le temps de réponse au hub, qui envoie 5 pings toutes les 15 secondes, combien sont restés sans réponse et à quel point les réponses ont varié. Aucun den-watcher n'y tourne, le hub ne sait donc que cela.",
			"es": "El tiempo que tardó en responder al hub, que envía 5 pings cada 15 segundos, cuántos quedaron sin respuesta y la variación de las respuestas. No ejecuta den-watcher, así que es todo lo que el hub sabe.",
		}
	}
	return metrics.Snapshot{Extras: []metrics.Extra{{
		ID: "reachability", Title: "Reachability",
		Titles:       map[string]string{"de": "Erreichbarkeit", "fr": "Accessibilité", "es": "Accesibilidad"},
		Description:  description,
		Descriptions: descriptions,
		Items:        items,
	}}}
}

// milliseconds returns d in milliseconds, to the microsecond.
func milliseconds(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000
}
