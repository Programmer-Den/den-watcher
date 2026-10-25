package wifi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// dot11BSSTypeAny is dot11_BSS_type_any, for access points and ad hoc
// networks alike.
const dot11BSSTypeAny = 3

var wlanGetNetworkBssList = wlanapi.NewProc("WlanGetNetworkBssList")

// NewNetworksReader returns what reads the nearby access points of every
// Wi-Fi interface, through WlanGetNetworkBssList of Windows' Native Wifi
// API, which lists those Windows' own scans found. It starts no scan.
// Without the API, the WLAN AutoConfig service or a Wi-Fi adapter it reads
// nothing, and so it does when Windows denies the list, as Windows 11 24H2
// and later do to programs without location access; why is logged once,
// and again when it changes.
//
// It keeps a WLAN handle of its own open, opened at the first read and again
// after the API failed, and closes it when ctx of the first read is done.
func NewNetworksReader() func(ctx context.Context) []AccessPoint {
	var (
		mu       sync.Mutex
		watching sync.Once
		handle   windows.Handle
		open     bool
		closed   bool
		logged   string
	)
	closeHandle := func() {
		if open {
			_, _, _ = wlanCloseHandle.Call(uintptr(handle), 0)
			open = false
		}
	}
	return func(ctx context.Context) []AccessPoint {
		watching.Do(func() {
			context.AfterFunc(ctx, func() {
				mu.Lock()
				defer mu.Unlock()
				closeHandle()
				closed = true
			})
		})
		mu.Lock()
		defer mu.Unlock()
		if closed {
			return nil
		}
		var aps []AccessPoint
		problem := ""
		if !open {
			handle, problem = openWLAN()
			open = problem == ""
		}
		if open {
			var ok bool
			aps, problem, ok = readBSSLists(handle, time.Now())
			if !ok {
				closeHandle()
			}
		}
		if problem != logged {
			if problem != "" {
				slog.Info("the nearby Wi-Fi networks are read only in part or not at all", "reason", problem)
			} else {
				slog.Info("the nearby Wi-Fi networks are read in full again")
			}
			logged = problem
		}
		return aps
	}
}

// readBSSLists reads the access points every interface sees through handle,
// and says why when it can read less than all of them. It returns nil when
// there is no interface or none could be read, and reports false when the interfaces could not be
// listed at all.
//
//nolint:gosec // wlanapi.dll takes and returns pointers, which need unsafe.
func readBSSLists(handle windows.Handle, now time.Time) ([]AccessPoint, string, bool) {
	var list *byte
	if ret, _, _ := wlanEnumInterfaces.Call(uintptr(handle), 0, uintptr(unsafe.Pointer(&list))); ret != 0 {
		return nil, fmt.Sprintf("WlanEnumInterfaces: %v", windows.Errno(ret)), false
	}
	count := *(*uint32)(unsafe.Pointer(list))
	interfaces := parseInterfaces(unsafe.Slice(list, interfaceListSize(int(count))))
	_, _, _ = wlanFreeMemory.Call(uintptr(unsafe.Pointer(list)))
	if len(interfaces) == 0 {
		return nil, "", true
	}

	var aps []AccessPoint
	read := 0
	problem := ""
	for _, iface := range interfaces {
		connected := ""
		if iface.connected {
			if data, size, err := query(handle, &iface.guid, opCurrentConnection); err == nil {
				connected = connectedBSSID(unsafe.Slice(data, size))
				_, _, _ = wlanFreeMemory.Call(uintptr(unsafe.Pointer(data)))
			}
		}
		var bss *byte
		ret, _, _ := wlanGetNetworkBssList.Call(uintptr(handle), uintptr(unsafe.Pointer(&iface.guid)), 0,
			dot11BSSTypeAny, 0, 0, uintptr(unsafe.Pointer(&bss)))
		if ret != 0 {
			err := windows.Errno(ret)
			if errors.Is(err, windows.ERROR_ACCESS_DENIED) {
				problem = fmt.Sprintf("%s: Windows denies the nearby networks without location access", iface.description)
			} else {
				problem = fmt.Sprintf("%s: WlanGetNetworkBssList: %v", iface.description, err)
			}
			continue
		}
		read++
		total := *(*uint32)(unsafe.Pointer(bss))
		aps = append(aps, parseBSSList(unsafe.Slice(bss, total), connected, now)...)
		_, _, _ = wlanFreeMemory.Call(uintptr(unsafe.Pointer(bss)))
	}
	if read > 0 && aps == nil {
		// Interfaces that see nothing nearby, unlike those Windows denies.
		aps = []AccessPoint{}
	}
	return aps, problem, true
}
