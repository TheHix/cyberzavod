package gallery

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

const sessionType = "session"

// InvalidRecordError — запись не прошла проверку конверта; Reason объясняет почему.
type InvalidRecordError struct {
	Reason string
}

func (e *InvalidRecordError) Error() string {
	return "запись не прошла проверку: " + e.Reason
}

// envelope — то, что сервер проверяет в записи. Полную проверку формата делает
// TypeScript-ядро в CLI и в браузере; второго описания формата здесь нет.
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

// ParseRecording проверяет конверт записи сессии и достаёт из него поля для списков.
// Тело записи сохраняется как пришло.
//
// Возвращает *InvalidRecordError, если тело не JSON-объект, запись не сессия или в ней нет
// нужных полей.
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

// decodeError переводит ошибку разбора JSON в понятную причину отказа.
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
