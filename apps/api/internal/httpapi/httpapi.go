// Package httpapi собирает HTTP-маршруты API. Все пути начинаются с /api:
// nginx отдаёт под этим префиксом запросы в Go, остальное — статика фронта.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const (
	// HealthPath — путь проверки жизни процесса; по нему же ходит подкоманда healthcheck.
	HealthPath = "/api/health"
	readyPath  = "/api/ready"

	databasePingTimeout = 2 * time.Second
)

// Pinger — всё, что нужно от базы для проверки готовности.
type Pinger interface {
	Ping(ctx context.Context) error
}

// TokenVerifier узнаёт автора по токену GitHub. Токен, который GitHub не принял, —
// gallery.ErrTokenRejected.
type TokenVerifier interface {
	Verify(ctx context.Context, token string) (gallery.User, error)
}

// Galleries — хранилище галерей: авторы, их записи и сводка по открытым галереям.
// Чего нет или что закрыто для посторонних — gallery.ErrNotFound.
type Galleries interface {
	SaveUser(ctx context.Context, user gallery.User) error
	Account(ctx context.Context, ownerID int64) (gallery.Account, error)
	SaveRecording(ctx context.Context, ownerID int64, recording gallery.Recording) (summary gallery.Summary, isNew bool, err error)
	DeleteRecording(ctx context.Context, ownerID int64, recordID string) error
	SetGalleryPublic(ctx context.Context, ownerID int64, isPublic bool) error
	PublicGalleries(ctx context.Context) ([]gallery.Overview, error)
	PublicGallery(ctx context.Context, login string) (gallery.Gallery, error)
	SharedRecording(ctx context.Context, slug string) (gallery.SharedRecording, error)
	Stats(ctx context.Context) (gallery.Stats, error)
}

// Deps — зависимости обработчиков API.
type Deps struct {
	DB        Pinger
	Galleries Galleries
	Tokens    TokenVerifier
	// GitHubClientID — client_id OAuth-приложения для входа из CLI; пусто — вход недоступен.
	GitHubClientID string
	Logger         *slog.Logger
}

// api — обработчики маршрутов поверх общих зависимостей.
type api struct {
	deps Deps
}

// NewHandler собирает маршруты API.
func NewHandler(deps Deps) http.Handler {
	routes := &api{deps: deps}
	mux := http.NewServeMux()

	mux.HandleFunc("GET "+HealthPath, health)
	mux.HandleFunc("GET "+readyPath, routes.ready)

	mux.HandleFunc("GET /api/auth/github", routes.githubAuth)
	mux.HandleFunc("GET /api/me", routes.authorized(routes.me))
	mux.HandleFunc("PUT /api/me/recordings/{id}", routes.authorized(routes.putRecording))
	mux.HandleFunc("DELETE /api/me/recordings/{id}", routes.authorized(routes.deleteRecording))
	mux.HandleFunc("PUT /api/me/gallery", routes.authorized(routes.putGallery))

	mux.HandleFunc("GET /api/galleries", routes.galleries)
	mux.HandleFunc("GET /api/galleries/{login}", routes.publicGallery)
	mux.HandleFunc("GET /api/recordings/{slug}", routes.sharedRecording)
	mux.HandleFunc("GET /api/badges/{file}", routes.badge)
	mux.HandleFunc("GET /api/stats", routes.stats)

	return mux
}

// health отвечает, жив ли процесс. Базу не трогает, чтобы её сбой не перезапускал API.
func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ready отвечает, может ли API обслуживать запросы, то есть доступна ли база.
func (a *api) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), databasePingTimeout)
	defer cancel()

	if err := a.deps.DB.Ping(ctx); err != nil {
		a.deps.Logger.WarnContext(ctx, "база недоступна", "err", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

// writeJSON отвечает телом body в JSON с кодом status.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
