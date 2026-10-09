package gallery

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

// sessionJSON builds a session recording body; replace substitutes pieces of text in it.
func sessionJSON(replace ...string) string {
	body := `{"version":1,"type":"session","id":"2026-10-05-4365c610","timestamp":"2026-10-05T08:00:00.500Z",` +
		`"projectId":"lab","source":{"type":"manual"},` +
		`"data":{"title":"Галерея","language":"en","workflow":"default","harness":"0.6.0","events":[]}}`

	return strings.NewReplacer(replace...).Replace(body)
}

func TestParseRecording(t *testing.T) {
	body := []byte(sessionJSON())
	want := Recording{
		ID:        "2026-10-05-4365c610",
		ProjectID: "lab",
		Title:     "Галерея",
		Language:  "en",
		StartedAt: time.Date(2026, 10, 5, 8, 0, 0, 500_000_000, time.UTC),
		Body:      body,
	}

	recording, err := ParseRecording(body)
	if err != nil {
		t.Fatalf("запись отклонена: %v", err)
	}
	if !reflect.DeepEqual(recording, want) {
		t.Fatalf("получено %+v, ожидалось %+v", recording, want)
	}
}

func TestParseRecordingRejects(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"не JSON", `{"type":`},
		{"массив", `[1]`},
		{"null", `null`},
		{"решение вместо сессии", sessionJSON(`"type":"session"`, `"type":"decision"`)},
		{"без type", sessionJSON(`"type":"session",`, "")},
		{"id не строка", sessionJSON(`"id":"2026-10-05-4365c610"`, `"id":7`)},
		{"без id", sessionJSON(`"id":"2026-10-05-4365c610",`, "")},
		{"пустой projectId", sessionJSON(`"projectId":"lab"`, `"projectId":""`)},
		{"без timestamp", sessionJSON(`"timestamp":"2026-10-05T08:00:00.500Z",`, "")},
		{"timestamp не время", sessionJSON(`2026-10-05T08:00:00.500Z`, `вчера`)},
		{"data не объект", `{"type":"session","id":"a","projectId":"lab","timestamp":"2026-10-05T08:00:00Z","data":"x"}`},
		{"без data", `{"type":"session","id":"a","projectId":"lab","timestamp":"2026-10-05T08:00:00Z"}`},
		{"без title", sessionJSON(`"title":"Галерея",`, "")},
		{"без language", sessionJSON(`"language":"en",`, "")},
		{"language не строка", sessionJSON(`"language":"en"`, `"language":1`)},
		{"пустой language", sessionJSON(`"language":"en"`, `"language":""`)},
		{"events не массив", sessionJSON(`"events":[]`, `"events":{}`)},
		{"без events", sessionJSON(`,"events":[]`, "")},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseRecording([]byte(tt.body))

			var invalid *InvalidRecordError
			if !errors.As(err, &invalid) {
				t.Fatalf("ошибка %v, ожидалась InvalidRecordError", err)
			}
		})
	}
}
