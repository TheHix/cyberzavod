// Package gallery описывает галереи записей: кто их автор, что в них лежит и что о них
// известно публично. Пакет не знает ни о базе, ни об HTTP — только о своих типах.
package gallery

import (
	"encoding/json"
	"errors"
	"time"
)

// RecordingLimit — сколько записей может лежать в галерее одного автора.
const RecordingLimit = 5

var (
	// ErrNotFound — записи, галереи или автора нет, или галерея закрыта для посторонних.
	ErrNotFound = errors.New("не найдено")
	// ErrLimitReached — в галерее уже RecordingLimit записей, новая не помещается.
	ErrLimitReached = errors.New("достигнут предел записей в галерее")
	// ErrTokenRejected — GitHub не принял токен автора.
	ErrTokenRejected = errors.New("GitHub не принял токен")
)

// User — автор галереи: учётная запись GitHub. Ключ — GitHubID, логин могут сменить.
type User struct {
	GitHubID int64
	Login    string
}

// Recording — запись сессии, которую автор загрузил в галерею: поля конверта для списков
// и тело записи целиком.
type Recording struct {
	ID        string
	ProjectID string
	Title     string
	Language  string
	StartedAt time.Time
	Body      json.RawMessage
}

// Summary — запись в списке галереи: без тела, со ссылкой slug.
type Summary struct {
	ID         string    `json:"id"`
	Slug       string    `json:"slug"`
	ProjectID  string    `json:"projectId"`
	Title      string    `json:"title"`
	Language   string    `json:"language"`
	StartedAt  time.Time `json:"startedAt"`
	UploadedAt time.Time `json:"uploadedAt"`
}

// Account — галерея глазами её автора: открыта ли она и все его записи.
type Account struct {
	Login         string
	GalleryPublic bool
	Recordings    []Summary
}

// Gallery — открытая галерея глазами посетителя.
type Gallery struct {
	Login      string    `json:"login"`
	Recordings []Summary `json:"recordings"`
}

// Overview — строка общего списка открытых галерей.
type Overview struct {
	Login          string    `json:"login"`
	RecordingCount int       `json:"recordingCount"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// SharedRecording — запись по секретной ссылке: чья она и тело как загружено.
type SharedRecording struct {
	Owner         string          `json:"owner"`
	GalleryPublic bool            `json:"galleryPublic"`
	Record        json.RawMessage `json:"record"`
}

// Stats — сводка по записям открытых галерей.
type Stats struct {
	Recordings    int                   `json:"recordings"`
	Authors       int                   `json:"authors"`
	Tokens        int64                 `json:"tokens"`
	Returns       []StageReturns        `json:"returns"`
	Interventions []ReasonInterventions `json:"interventions"`
	Outcomes      Outcomes              `json:"outcomes"`
}

// StageReturns — сколько раз работу вернули с этапа Stage.
type StageReturns struct {
	Stage string `json:"stage"`
	Count int    `json:"count"`
}

// ReasonInterventions — сколько раз человека звали по причине Reason.
type ReasonInterventions struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

// Outcomes — сколько сборок закончилось удачно и сколько нет.
type Outcomes struct {
	OK     int `json:"ok"`
	Failed int `json:"failed"`
}
