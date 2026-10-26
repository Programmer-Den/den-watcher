package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Programmer-Den/den-watcher/backend/internal/metrics"
)

// asusMeshHook asks the main router of an AiMesh for its nodes. It is asked
// on its own, after the other values, so a firmware without AiMesh, which
// may not know it, still answers those.
const asusMeshHook = "get_cfg_clientlist()"

// meshStale is how old the main router's list of nodes may be before a
// node is no longer known: two readings missed.
const meshStale = 3 * asusInterval

// MeshNode is a router of an ASUS AiMesh other than the main router, as the
// main router reports it.
type MeshNode struct {
	// MAC is the node's hardware address in upper case, which keys it.
	MAC string
	// Name is the name the node was given in the router's settings, or else
	// its model.
	Name     string
	Model    string
	Firmware string
	IP       string
	Online   bool
	// Backhaul is how the node is linked to the mesh: "cable", or the Wi-Fi
	// band, such as "5 GHz"; empty when the router does not tell.
	Backhaul string
	// BackhaulDBm is the signal of a Wi-Fi backhaul, nil for a cable.
	BackhaulDBm *float64
	// Clients is how many clients online are connected to the node.
	Clients int
	// Radios are the hardware addresses of the node's access points, one
	// for each band.
	Radios []string
}

// asusNode is a node in get_cfg_clientlist, with the fields as the
// firmware names them, all of them strings.
type asusNode struct {
	Alias    string `json:"alias"`
	Model    string `json:"model_name"`
	UIModel  string `json:"ui_model_name"`
	Firmware string `json:"fwver"`
	IP       string `json:"ip"`
	MAC      string `json:"mac"`
	Online   string `json:"online"`
	Level    string `json:"level"`
	AP2G     string `json:"ap2g"`
	AP5G     string `json:"ap5g"`
	AP5G1    string `json:"ap5g1"`
	AP6G     string `json:"ap6g"`
	Parent2G string `json:"pap2g"`
	Parent5G string `json:"pap5g"`
	Parent6G string `json:"pap6g"`
	RSSI2G   string `json:"rssi2g"`
	RSSI5G   string `json:"rssi5g"`
	RSSI6G   string `json:"rssi6g"`
}

// MeshNodes returns the nodes of the router's AiMesh as last read, and when;
// none for a router without AiMesh, and a zero time before the first
// reading.
func (a *ASUSReader) MeshNodes() ([]MeshNode, time.Time) {
	a.nodesMu.Lock()
	defer a.nodesMu.Unlock()
	return slices.Clone(a.nodes), a.nodesAt
}

// readMesh asks the router for its AiMesh nodes and keeps them, with the
// clients counted on each from clients, the get_clientlist of the same
// reading. A router that does not answer it keeps the nodes from before,
// which grow old (see meshStale). The caller holds mu.
func (a *ASUSReader) readMesh(ctx context.Context, clients map[string]json.RawMessage, now time.Time) {
	data, status, err := a.ask(ctx, http.MethodPost, "/appGet.cgi", url.Values{"hook": {asusMeshHook}})
	if err != nil || status != http.StatusOK {
		return
	}
	var values map[string]json.RawMessage
	if json.Unmarshal(trailingComma.ReplaceAll(data, []byte("$1")), &values) != nil {
		return
	}
	nodes, err := parseMesh(values["get_cfg_clientlist"], a.base)
	if err != nil {
		return
	}
	counts := nodeClients(clients)
	for i := range nodes {
		nodes[i].Clients = counts[nodes[i].MAC]
	}
	a.nodesMu.Lock()
	a.nodes, a.nodesAt = nodes, now
	a.nodesMu.Unlock()
}

// parseMesh reads the nodes of get_cfg_clientlist, which some firmware
// wraps in a list of its own, leaving out the main router itself: the node
// of level 0, or at the address base is read at.
func parseMesh(raw json.RawMessage, base string) ([]MeshNode, error) {
	var list []json.RawMessage
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, err
	}
	if len(list) == 1 && strings.HasPrefix(strings.TrimSpace(string(list[0])), "[") {
		if err := json.Unmarshal(list[0], &list); err != nil {
			return nil, err
		}
	}
	host := strings.TrimPrefix(base, "http://")
	if h, _, ok := strings.Cut(host, ":"); ok && !strings.HasPrefix(host, "[") {
		host = h
	}
	var nodes []MeshNode
	for _, raw := range list {
		var n asusNode
		if json.Unmarshal(raw, &n) != nil || n.MAC == "" || n.Level == "0" || n.IP == host {
			continue
		}
		nodes = append(nodes, n.node())
	}
	return nodes, nil
}

// node turns a node of get_cfg_clientlist into a MeshNode.
func (n asusNode) node() MeshNode {
	node := MeshNode{
		MAC:      strings.ToUpper(strings.TrimSpace(n.MAC)),
		Name:     clientName(n.Alias, n.UIModel, n.Model, n.MAC),
		Model:    clientName(n.UIModel, n.Model),
		Firmware: strings.TrimSpace(n.Firmware),
		IP:       strings.TrimSpace(n.IP),
		Online:   n.Online == "1",
	}
	for _, radio := range []string{n.AP2G, n.AP5G, n.AP5G1, n.AP6G} {
		if radio = strings.ToUpper(strings.TrimSpace(radio)); radio != "" && !slices.Contains(node.Radios, radio) {
			node.Radios = append(node.Radios, radio)
		}
	}
	// A node on Wi-Fi tells the access point it is linked to, and its
	// signal, in the band it uses; one on a cable tells none.
	for _, link := range []struct{ band, parent, rssi string }{
		{"6 GHz", n.Parent6G, n.RSSI6G}, {"5 GHz", n.Parent5G, n.RSSI5G}, {"2.4 GHz", n.Parent2G, n.RSSI2G},
	} {
		dBm, err := strconv.ParseFloat(strings.TrimSpace(link.rssi), 64)
		if strings.TrimSpace(link.parent) != "" && err == nil && dBm < 0 && dBm > -120 {
			node.Backhaul, node.BackhaulDBm = link.band, &dBm
			break
		}
	}
	if node.Backhaul == "" && node.Online {
		node.Backhaul = "cable"
	}
	return node
}

// nodeClients counts the clients online in get_clientlist by the node they
// are connected to, by the node's hardware address in upper case.
func nodeClients(list map[string]json.RawMessage) map[string]int {
	counts := map[string]int{}
	for key, raw := range list {
		if key == "maclist" || key == "ClientAPILevel" {
			continue
		}
		var entry struct {
			Online string `json:"isOnline"`
			OnNode string `json:"amesh_isRe"`
			Node   string `json:"amesh_papMac"`
		}
		if json.Unmarshal(raw, &entry) == nil && entry.Online == "1" && entry.OnNode == "1" && entry.Node != "" {
			counts[strings.ToUpper(strings.TrimSpace(entry.Node))]++
		}
	}
	return counts
}

// errNodeOffline is a node its main router reports offline.
var errNodeOffline = errors.New("the main router of the AiMesh reports the node offline")

// NodeReader reads an AiMesh node from what its main router reports about
// it, as a node is not asked itself: whether it is online, how it is linked
// to the mesh and how many clients it has.
type NodeReader struct {
	mesh *ASUSReader
	mac  string
}

// Node returns the reader of the node with the hardware address mac in the
// AiMesh of the main router mesh reads.
func (a *ASUSReader) Node(mac string) *NodeReader {
	return &NodeReader{mesh: a, mac: strings.ToUpper(mac)}
}

// Collect returns the node's usage as the main router last reported it. It
// fails while the node is offline, and while the main router was not read
// lately, as then nothing is known.
func (r *NodeReader) Collect(context.Context) (metrics.Snapshot, error) {
	nodes, at := r.mesh.MeshNodes()
	if at.IsZero() || time.Since(at) > meshStale {
		return metrics.Snapshot{}, fmt.Errorf("the main router of the AiMesh at %s was not read lately", r.mesh.base)
	}
	i := slices.IndexFunc(nodes, func(n MeshNode) bool { return n.MAC == r.mac })
	if i < 0 {
		return metrics.Snapshot{}, errors.New("the main router of the AiMesh no longer lists the node")
	}
	node := nodes[i]
	if !node.Online {
		return metrics.Snapshot{}, errNodeOffline
	}
	return metrics.Snapshot{Extras: []metrics.Extra{nodeExtra(node)}}, nil
}

// backhaulWords are the words for a node linked by cable in each language.
var backhaulWords = map[string]string{"en": "Cable", "de": "Kabel", "fr": "Câble", "es": "Cable"}

// nodeExtra is the group of what the main router tells about a node.
func nodeExtra(node MeshNode) metrics.Extra {
	clients := float64(node.Clients)
	extra := metrics.Extra{
		ID: "aimesh-node", Title: "AiMesh node", Titles: map[string]string{"de": "AiMesh-Knoten", "fr": "Nœud AiMesh", "es": "Nodo AiMesh"},
		Description: "What the main router of the AiMesh tells about this node: how it is linked to the mesh, how many devices are connected to it, its model and firmware.",
		Descriptions: map[string]string{
			"de": "Was der Hauptrouter des AiMesh über diesen Knoten meldet: wie er mit dem Mesh verbunden ist, wie viele Geräte mit ihm verbunden sind, sein Modell und seine Firmware.",
			"fr": "Ce que le routeur principal de l'AiMesh indique sur ce nœud : comment il est relié au maillage, combien d'appareils y sont connectés, son modèle et son firmware.",
			"es": "Lo que el router principal del AiMesh indica sobre este nodo: cómo está unido a la malla, cuántos dispositivos están conectados a él, su modelo y su firmware.",
		},
		Items: []metrics.ExtraItem{
			{ID: "clients", Label: "Clients", Unit: metrics.UnitNumber, Value: &clients, History: true, Labels: map[string]string{"de": "Geräte", "fr": "Appareils", "es": "Dispositivos"}},
		},
	}
	if node.Backhaul != "" {
		item := metrics.ExtraItem{ID: "backhaul", Label: "Link to the mesh", Unit: metrics.UnitText, Labels: map[string]string{"de": "Verbindung zum Mesh", "fr": "Liaison au maillage", "es": "Enlace a la malla"}}
		if node.Backhaul == "cable" {
			item.Text = backhaulWords["en"]
			item.Texts = map[string]string{"de": backhaulWords["de"], "fr": backhaulWords["fr"], "es": backhaulWords["es"]}
		} else {
			item.Text = "Wi-Fi " + node.Backhaul
			comma := "Wi-Fi " + strings.ReplaceAll(node.Backhaul, ".", ",")
			item.Texts = map[string]string{"de": "WLAN " + strings.ReplaceAll(node.Backhaul, ".", ","), "fr": comma, "es": comma}
		}
		extra.Items = append(extra.Items, item)
	}
	if node.BackhaulDBm != nil {
		extra.Items = append(extra.Items, metrics.ExtraItem{
			ID: "backhaul-signal", Label: "Signal of the link (dBm)", Unit: metrics.UnitNumber, Value: node.BackhaulDBm, History: true,
			Labels: map[string]string{"de": "Signal der Verbindung (dBm)", "fr": "Signal de la liaison (dBm)", "es": "Señal del enlace (dBm)"},
		})
	}
	for _, text := range []metrics.ExtraItem{
		{ID: "model", Label: "Model", Text: node.Model, Labels: map[string]string{"de": "Modell", "fr": "Modèle", "es": "Modelo"}},
		{ID: "firmware", Label: "Firmware", Text: node.Firmware, Labels: map[string]string{"de": "Firmware", "fr": "Firmware", "es": "Firmware"}},
		{ID: "address", Label: "Address", Text: node.IP, Labels: map[string]string{"de": "Adresse", "fr": "Adresse", "es": "Dirección"}},
	} {
		if text.Text != "" {
			text.Unit = metrics.UnitText
			extra.Items = append(extra.Items, text)
		}
	}
	return extra
}

// MeshOf returns the reader of an ASUS router that New returned, whose
// AiMesh nodes it reads; nil for any other router.
func MeshOf(reader Reader) *ASUSReader {
	if t, ok := reader.(*throttled); ok {
		reader = t.reader
	}
	asus, _ := reader.(*ASUSReader)
	return asus
}
