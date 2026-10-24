package server

import (
	"encoding/csv"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Programmer-Den/den-watcher/backend/internal/history"
)

// historyCSVHandler serves GET /api/history.csv?from=<unix seconds>&to=<unix seconds>:
// the same history as GET /api/history, as a CSV file to download, with a
// column for each metric and a row for each time.
func historyCSVHandler(d Device, retention time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		response, ok := readHistory(w, r, d, retention)
		if !ok {
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Disposition", attachment(d, response.From, response.To))
		if err := writeHistoryCSV(w, response.Series); err != nil {
			slog.Error("write the history as CSV", "device", d.ID, "error", err)
		}
	}
}

// writeHistoryCSV writes series as CSV: a header with "time" and the name of
// each metric, then a row for each time any metric has a value, oldest first,
// with the time in ISO 8601 in UTC and an empty cell where a metric has no
// value then. Lines end in CRLF, as RFC 4180 has it.
func writeHistoryCSV(w io.Writer, series []history.Series) error {
	out := csv.NewWriter(w)
	out.UseCRLF = true
	header := make([]string, 0, len(series)+1)
	header = append(header, "time")
	values := make([]map[int64]float64, len(series))
	var times []int64
	for i, s := range series {
		header = append(header, textCell(s.Metric))
		values[i] = make(map[int64]float64, len(s.Points))
		for _, p := range s.Points {
			if _, seen := values[i][p.Time]; !seen {
				times = append(times, p.Time)
			}
			values[i][p.Time] = p.Value
		}
	}
	slices.Sort(times)
	times = slices.Compact(times)
	if err := out.Write(header); err != nil {
		return err
	}
	row := make([]string, len(header))
	for _, t := range times {
		row[0] = time.Unix(t, 0).UTC().Format(time.RFC3339)
		for i := range series {
			row[i+1] = ""
			if v, ok := values[i][t]; ok {
				row[i+1] = strconv.FormatFloat(v, 'f', -1, 64)
			}
		}
		if err := out.Write(row); err != nil {
			return err
		}
	}
	out.Flush()
	return out.Error()
}

// textCell returns text as a cell a spreadsheet does not take for a formula:
// text that starts with =, +, -, @, a tab or a carriage return gets a ' in
// front. Only text is guarded; numbers stay as they are, also negative ones.
func textCell(text string) string {
	if text != "" && strings.ContainsRune("=+-@\t\r", rune(text[0])) {
		return "'" + text
	}
	return text
}

// csvFileName returns the name the CSV of a device's history over from to
// to is saved as, such as "NAS-20261013T120000Z-20261013T130000Z.csv": the
// device's name with every character but letters, digits, dots, dashes and
// underscores replaced by a dash, or "den-watcher" for the machine the site
// runs on when it has no name. With ascii, letters and digits beyond ASCII
// are replaced too, for browsers that do not read the name in UTF-8.
func csvFileName(d Device, from, to int64, ascii bool) string {
	var b strings.Builder
	dash := false
	for _, c := range d.Name {
		ok := c == '.' || c == '_' || c == '-' || unicode.IsLetter(c) || unicode.IsDigit(c)
		switch {
		case ok && (!ascii || c < utf8.RuneSelf):
			b.WriteRune(c)
			dash = false
		case !dash:
			b.WriteByte('-')
			dash = true
		}
	}
	clean := strings.Trim(b.String(), "-.")
	if clean == "" {
		clean = "den-watcher"
	}
	const stamp = "20060102T150405Z"
	return fmt.Sprintf("%s-%s-%s.csv", clean, time.Unix(from, 0).UTC().Format(stamp), time.Unix(to, 0).UTC().Format(stamp))
}

// attachment returns the Content-Disposition of a file to download as name,
// in ASCII and, for names beyond it, in UTF-8 as RFC 6266 has it.
func attachment(d Device, from, to int64) string {
	ascii := csvFileName(d, from, to, true)
	name := csvFileName(d, from, to, false)
	if name == ascii {
		return fmt.Sprintf("attachment; filename=%q", ascii)
	}
	return fmt.Sprintf("attachment; filename=%q; filename*=UTF-8''%s", ascii, url.PathEscape(name))
}
