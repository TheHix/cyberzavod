package badge

import (
	"encoding/xml"
	"strings"
	"testing"
)

// svgSize is what the badge reports about its size.
type svgSize struct {
	Width int `xml:"width,attr"`
}

func parseWidth(t *testing.T, svg string) int {
	t.Helper()

	var size svgSize
	if err := xml.Unmarshal([]byte(svg), &size); err != nil {
		t.Fatalf("бейдж — не XML: %v\n%s", err, svg)
	}

	return size.Width
}

func TestBuilds(t *testing.T) {
	tests := []struct {
		name  string
		count int
		want  string
	}{
		{"одна запись", 1, ">1 build<"},
		{"нет записей", 0, ">0 builds<"},
		{"несколько записей", 5, ">5 builds<"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svg := Builds("octocat", tt.count)

			if !strings.Contains(svg, tt.want) {
				t.Fatalf("в бейдже нет %q:\n%s", tt.want, svg)
			}
			if !strings.Contains(svg, buildsColor) {
				t.Fatalf("бейдж открытой галереи не цветной:\n%s", svg)
			}
			parseWidth(t, svg)
		})
	}
}

func TestPrivate(t *testing.T) {
	svg := Private("octocat")

	if !strings.Contains(svg, ">private<") || !strings.Contains(svg, privateColor) {
		t.Fatalf("бейдж закрытой галереи не серый «private»:\n%s", svg)
	}
	parseWidth(t, svg)
}

func TestRenderEscapesLogin(t *testing.T) {
	login := `"><script>alert(1)</script>`

	svg := Private(login)

	if strings.Contains(svg, "<script>") {
		t.Fatalf("логин попал в SVG без экранирования:\n%s", svg)
	}
	if !strings.Contains(svg, "&lt;script&gt;") {
		t.Fatalf("экранированного логина нет в подписи:\n%s", svg)
	}
	parseWidth(t, svg)
}

func TestRenderWidth(t *testing.T) {
	short := parseWidth(t, Builds("octocat", 1))

	long := parseWidth(t, Builds("octocat", 1000))

	if long <= short {
		t.Fatalf("бейдж с длинной надписью %d не шире короткого %d", long, short)
	}
}
