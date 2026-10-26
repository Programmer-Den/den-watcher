package router

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
)

// fakeASUSRouter answers like the web interface of an ASUS router: a
// login with the right user and password gets a token, which appGet.cgi
// and ajax_coretmp.asp take until it is expired.
type fakeASUSRouter struct {
	server *httptest.Server

	mu     sync.Mutex
	paths  []string
	logins int
	busy   bool
	// pagesBusy makes appGet.cgi fail while the token is still taken.
	pagesBusy bool
	token     string
	appGet    string
	coretmp   string
	// mesh answers the hook of the AiMesh nodes; a router without AiMesh
	// refuses it.
	mesh string
}

func newFakeASUSRouter(t *testing.T) *fakeASUSRouter {
	t.Helper()
	appGet, err := os.ReadFile("testdata/asus/appGet.json")
	if err != nil {
		t.Fatal(err)
	}
	coretmp, err := os.ReadFile("testdata/asus/coretmp.asp")
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeASUSRouter{appGet: string(appGet), coretmp: string(coretmp)}
	f.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.paths = append(f.paths, r.URL.Path)
		if r.UserAgent() != asusUserAgent {
			http.Error(w, "the login page", http.StatusOK)
			return
		}
		if r.URL.Path == "/login.cgi" {
			f.logins++
			if f.busy {
				http.Error(w, "<html>busy</html>", http.StatusServiceUnavailable)
				return
			}
			_ = r.ParseForm()
			if r.PostForm.Get("login_authorization") != base64.StdEncoding.EncodeToString([]byte("admin:right")) {
				_, _ = w.Write([]byte(`{"error_status":"3"}`))
				return
			}
			f.token = "token" + strings.Repeat("x", f.logins)
			_, _ = w.Write([]byte(`{"asus_token":"` + f.token + `"}`))
			return
		}
		if cookie, err := r.Cookie("asus_token"); err != nil || f.token == "" || cookie.Value != f.token {
			_, _ = w.Write([]byte(`<html>the login page</html>`))
			return
		}
		switch r.URL.Path {
		case "/appGet.cgi":
			if f.pagesBusy {
				http.Error(w, "<html>busy</html>", http.StatusServiceUnavailable)
				return
			}
			_ = r.ParseForm()
			if r.PostForm.Get("hook") == asusMeshHook && f.mesh != "" {
				_, _ = w.Write([]byte(f.mesh))
				return
			}
			if r.PostForm.Get("hook") != asusHooks {
				http.Error(w, "unknown hook", http.StatusBadRequest)
				return
			}
			_, _ = w.Write([]byte(f.appGet))
		case "/ajax_coretmp.asp":
			_, _ = w.Write([]byte(f.coretmp))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeASUSRouter) reader(password string) *ASUSReader {
	return NewASUS(strings.TrimPrefix(f.server.URL, "http://"), "admin", password)
}

func TestASUSReadsTheRouter(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("right")

	snapshot, err := reader.Collect(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.UptimeSeconds != 86400 {
		t.Errorf("uptime %d", snapshot.UptimeSeconds)
	}
	if snapshot.CPU.Cores != 2 || snapshot.CPU.CoreUsagePercent[0] != 10 || snapshot.CPU.CoreUsagePercent[1] != 30 || snapshot.CPU.UsagePercent != 20 {
		t.Errorf("CPU %+v", snapshot.CPU)
	}
	if snapshot.Memory.TotalBytes != 512<<20 || snapshot.Memory.UsedPercent != 50 {
		t.Errorf("memory %+v", snapshot.Memory)
	}
	var names []string
	for _, network := range snapshot.Network {
		names = append(names, network.Name)
	}
	if want := []string{"WAN", "LAN", "Wi-Fi 2.4 GHz", "Wi-Fi 5 GHz"}; !slices.Equal(names, want) {
		t.Errorf("interfaces %q, want %q", names, want)
	}
	if snapshot.Network[0].ReceivedBytes != 0x100000 {
		t.Errorf("WAN %+v", snapshot.Network[0])
	}
	if online := extraItem(snapshot, "clients", "online"); online == nil || *online.Value != 2 {
		t.Errorf("clients online %+v", online)
	}
	if wireless := extraItem(snapshot, "clients", "wireless"); wireless == nil || *wireless.Value != 1 {
		t.Errorf("clients on Wi-Fi %+v", wireless)
	}
	// By name: the nickname where the owner gave one.
	if laptop := extraItem(snapshot, "connected", "client-1"); laptop == nil || laptop.Label != "Laptop" || laptop.Text != "5 GHz" {
		t.Errorf("first client %+v", laptop)
	}
	if nas := extraItem(snapshot, "connected", "client-2"); nas == nil || nas.Label != "nas" || nas.Text != "Cable" || nas.Texts["de"] != "Kabel" {
		t.Errorf("second client %+v", nas)
	}
	if extraItem(snapshot, "connected", "client-3") != nil {
		t.Error("a client that is offline is listed")
	}
	var sensors []string
	for _, temperature := range snapshot.Temperatures {
		sensors = append(sensors, temperature.Sensor)
	}
	if want := []string{"Wi-Fi 2.4 GHz", "Wi-Fi 5 GHz", "CPU"}; !slices.Equal(sensors, want) {
		t.Errorf("temperatures %+v, want %q", snapshot.Temperatures, want)
	}

	// The next reading measures the CPU and traffic since the first.
	router.mu.Lock()
	router.appGet = strings.NewReplacer(
		`"cpu1_total":"1000","cpu1_usage":"100"`, `"cpu1_total":"2000","cpu1_usage":"600"`,
		`"INTERNET_rx":"0x100000"`, `"INTERNET_rx":"0x200000"`,
	).Replace(router.appGet)
	router.mu.Unlock()
	snapshot, err = reader.Collect(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.CPU.CoreUsagePercent[0] != 50 || snapshot.CPU.CoreUsagePercent[1] != 0 {
		t.Errorf("CPU since the first reading %+v", snapshot.CPU)
	}
	if snapshot.Network[0].ReceiveBytesPerSecond <= 0 {
		t.Errorf("no traffic measured %+v", snapshot.Network[0])
	}

	router.mu.Lock()
	defer router.mu.Unlock()
	if router.logins != 1 {
		t.Errorf("logged in %d times, want once with the token kept", router.logins)
	}
	for _, path := range router.paths {
		if !slices.Contains(ASUSPaths, path) {
			t.Errorf("asked %s, which is not one of the pages that only read", path)
		}
	}
}

func TestASUSLogsInAgainWhenTheTokenExpired(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("right")
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	router.mu.Lock()
	router.token = "expired"
	router.mu.Unlock()
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	router.mu.Lock()
	defer router.mu.Unlock()
	if router.logins != 2 {
		t.Errorf("logged in %d times, want 2", router.logins)
	}
}

func TestASUSKeepsTheTokenAfterAFailedPage(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("right")
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	router.mu.Lock()
	router.pagesBusy = true
	router.mu.Unlock()
	if _, err := reader.Collect(t.Context()); err == nil {
		t.Fatal("read a router whose page failed")
	}
	router.mu.Lock()
	router.pagesBusy = false
	router.mu.Unlock()
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	router.mu.Lock()
	defer router.mu.Unlock()
	if router.logins != 1 {
		t.Errorf("logged in %d times, want once with the token kept", router.logins)
	}
}

func TestASUSDoesNotLogInAgainForAnAnswerThatDoesNotParse(t *testing.T) {
	router := newFakeASUSRouter(t)
	good := router.appGet
	router.appGet = `{"cpu_usage":`
	reader := router.reader("right")
	for range 3 {
		if _, err := reader.Collect(t.Context()); err == nil {
			t.Fatal("read an answer that does not parse")
		}
	}
	router.mu.Lock()
	router.appGet = good
	router.mu.Unlock()
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	router.mu.Lock()
	defer router.mu.Unlock()
	if router.logins != 1 {
		t.Errorf("logged in %d times, want once with the token kept", router.logins)
	}
}

func TestASUSDoesNotRetryAWrongPasswordAtOnce(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("wrong")
	for range 3 {
		if _, err := reader.Collect(t.Context()); err == nil {
			t.Fatal("a wrong password was taken")
		}
	}
	router.mu.Lock()
	defer router.mu.Unlock()
	if router.logins != 1 {
		t.Errorf("tried to log in %d times, want once until the backoff is over", router.logins)
	}
}

func TestASUSRetriesALoginWithoutAnswerAtOnce(t *testing.T) {
	router := newFakeASUSRouter(t)
	router.busy = true
	reader := router.reader("right")
	if _, err := reader.Collect(t.Context()); err == nil || errors.Is(err, errASUSLogin) {
		t.Fatalf("got %v, want an error that is not a refused login", err)
	}
	router.mu.Lock()
	router.busy = false
	router.mu.Unlock()
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Errorf("the next reading: %v", err)
	}
}

func TestASUSCPUAfterARestart(t *testing.T) {
	reader := &ASUSReader{}
	reader.cpu(map[string]string{"cpu1_total": "1000", "cpu1_usage": "500"})
	if got := reader.cpu(map[string]string{"cpu1_total": "1100", "cpu1_usage": "550"}); got.UsagePercent != 50 {
		t.Errorf("got %v, want 50", got.UsagePercent)
	}
	if got := reader.cpu(map[string]string{"cpu1_total": "100", "cpu1_usage": "90"}); got.Cores != 0 {
		t.Errorf("after counters started again got %+v, want none", got)
	}
}

func TestASUSInterfaceNames(t *testing.T) {
	for name, want := range map[string]string{
		"INTERNET": "WAN", "INTERNET1": "WAN 1", "WIRED": "LAN", "BRIDGE": "",
		"WIRELESS0": "Wi-Fi 2.4 GHz", "WIRELESS1": "Wi-Fi 5 GHz", "WIRELESS2": "Wi-Fi 3", "LACP": "LACP",
	} {
		if got := asusInterfaceName(name); got != want {
			t.Errorf("%s: got %q, want %q", name, got, want)
		}
	}
}

func TestASUSReadsTheAiMeshNodes(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("right")
	host := strings.TrimPrefix(router.server.URL, "http://")
	host = host[:strings.LastIndex(host, ":")]
	router.mu.Lock()
	// The main router lists itself too, at level 0; its client list tells
	// which node each client is on.
	router.mesh = `{"get_cfg_clientlist":[[
		{"alias":"Main","model_name":"RT-AX88U","ip":"` + host + `","mac":"aa:00:00:00:00:01","online":"1","level":"0"},
		{"alias":"Living room","model_name":"RT-AX58U","ui_model_name":"RT-AX3000","fwver":"3.0.0.4.388_24243","ip":"192.168.1.2","mac":"aa:00:00:00:00:02","online":"1","level":"1",
		 "ap2g":"aa:00:00:00:00:12","ap5g":"aa:00:00:00:00:15","pap5g":"AA:00:00:00:00:05","rssi5g":"-58","pap2g":"","rssi2g":""},
		{"alias":"","model_name":"RP-AX56","ip":"192.168.1.3","mac":"aa:00:00:00:00:03","online":"1","level":"1"},
		{"alias":"Garden","model_name":"RT-AX58U","ip":"192.168.1.4","mac":"aa:00:00:00:00:04","online":"0","level":"2"},
	]]}`
	router.appGet = strings.Replace(router.appGet, `"name":"DESKTOP-1","nickName":"Laptop"`, `"name":"DESKTOP-1","nickName":"Laptop","amesh_isRe":"1","amesh_papMac":"AA:00:00:00:00:02"`, 1)
	router.mu.Unlock()

	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	nodes, at := reader.MeshNodes()
	if at.IsZero() || len(nodes) != 3 {
		t.Fatalf("nodes %+v at %v, want the three besides the main router", nodes, at)
	}
	living := nodes[0]
	if living.MAC != "AA:00:00:00:00:02" || living.Name != "Living room" || living.Model != "RT-AX3000" || !living.Online ||
		living.Backhaul != "5 GHz" || living.BackhaulDBm == nil || *living.BackhaulDBm != -58 || living.Clients != 1 ||
		!slices.Equal(living.Radios, []string{"AA:00:00:00:00:12", "AA:00:00:00:00:15"}) {
		t.Errorf("living room %+v", living)
	}
	// Without a name, a node is named by its model; one without a Wi-Fi
	// link is on a cable.
	if nodes[1].Name != "RP-AX56" || nodes[1].Backhaul != "cable" || nodes[1].BackhaulDBm != nil {
		t.Errorf("second node %+v", nodes[1])
	}

	snapshot, err := reader.Node("aa:00:00:00:00:02").Collect(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if clients := extraItem(snapshot, "aimesh-node", "clients"); clients == nil || *clients.Value != 1 {
		t.Errorf("clients of the node %+v", clients)
	}
	if link := extraItem(snapshot, "aimesh-node", "backhaul"); link == nil || link.Text != "Wi-Fi 5 GHz" || link.Texts["de"] != "WLAN 5 GHz" {
		t.Errorf("link of the node %+v", link)
	}
	if _, err := reader.Node("AA:00:00:00:00:04").Collect(t.Context()); !errors.Is(err, errNodeOffline) {
		t.Errorf("a node that is offline: %v", err)
	}
	if _, err := reader.Node("AA:00:00:00:00:99").Collect(t.Context()); err == nil {
		t.Error("a node the router no longer lists is read")
	}
	if MeshOf(New(Config{Protocol: ASUS, Address: host}, "right")) == nil || MeshOf(NewUPnP(host)) != nil {
		t.Error("MeshOf finds no ASUS reader, or one in a UPnP reader")
	}
}

func TestASUSWithoutAiMeshHasNoNodes(t *testing.T) {
	router := newFakeASUSRouter(t)
	reader := router.reader("right")
	if _, err := reader.Collect(t.Context()); err != nil {
		t.Fatal(err)
	}
	if nodes, _ := reader.MeshNodes(); len(nodes) != 0 {
		t.Errorf("nodes %+v", nodes)
	}
	if _, err := reader.Node("AA:00:00:00:00:02").Collect(t.Context()); err == nil {
		t.Error("a node of a router without AiMesh is read")
	}
}
