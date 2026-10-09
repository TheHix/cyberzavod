package gallery

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const sessionType = "session"

// InvalidRecordError means the recording failed the envelope check; Reason explains why.
type InvalidRecordError struct {
	Reason string
}

func (e *InvalidRecordError) Error() string {
	return "запись не прошла проверку: " + e.Reason
}

// envelope is what the server checks in a recording. The full format check is done by
// the TypeScript core in the CLI and in the browser; there is no second format description here.
type envelope struct {
	Type      *string `json:"type"`
	ID        *string `json:"id"`
	ProjectID *string `json:"projectId"`
	Timestamp *string `json:"timestamp"`
	Data      *struct {
		Title    *string            `json:"title"`
		Language *string            `json:"language"`
		Events   *[]json.RawMessage `json:"events"`
	} `json:"data"`
}

// ParseRecording checks the session recording envelope and extracts the fields for lists from it.
// The recording body is stored as received.
//
// Returns *InvalidRecordError if the body is not a JSON object, the record is not a session or it
// lacks required fields.
func ParseRecording(body []byte) (Recording, error) {
	var parsed envelope
	if err := json.Unmarshal(body, &parsed); err != nil {
		return Recording{}, decodeError(err)
	}

	if parsed.Type == nil || *parsed.Type != sessionType {
		return Recording{}, &InvalidRecordError{Reason: `type должен быть "session"`}
	}

	return recordingFromEnvelope(parsed, body)
}

func recordingFromEnvelope(parsed envelope, body []byte) (Recording, error) {
	if parsed.Data == nil {
		return Recording{}, &InvalidRecordError{Reason: "нет объекта data"}
	}

	if parsed.Data.Events == nil {
		return Recording{}, &InvalidRecordError{Reason: "data.events должен быть массивом"}
	}

	fields := []struct {
		name  string
		value *string
	}{
		{"id", parsed.ID},
		{"projectId", parsed.ProjectID},
		{"timestamp", parsed.Timestamp},
		{"data.title", parsed.Data.Title},
		{"data.language", parsed.Data.Language},
	}
	for _, field := range fields {
		if field.value == nil || *field.value == "" {
			return Recording{}, &InvalidRecordError{Reason: field.name + " должен быть непустой строкой"}
		}
	}

	startedAt, err := time.Parse(time.RFC3339Nano, *parsed.Timestamp)
	if err != nil {
		return Recording{}, &InvalidRecordError{Reason: "timestamp должен быть временем ISO 8601"}
	}

	return Recording{
		ID:        *parsed.ID,
		ProjectID: *parsed.ProjectID,
		Title:     *parsed.Data.Title,
		Language:  *parsed.Data.Language,
		StartedAt: startedAt.UTC(),
		Body:      body,
	}, nil
}

// decodeError turns a JSON parse error into a clear rejection reason.
func decodeError(err error) error {
	var typeErr *json.UnmarshalTypeError
	if !errors.As(err, &typeErr) {
		return &InvalidRecordError{Reason: "тело не JSON"}
	}

	if typeErr.Field == "" {
		return &InvalidRecordError{Reason: "запись должна быть объектом JSON"}
	}

	return &InvalidRecordError{Reason: fmt.Sprintf("у поля %s неверный тип", typeErr.Field)}
}
