// Package httpapi собирает HTTP-маршруты API. Все пути начинаются с /api:
// nginx отдаёт под этим префиксом запросы в Go, остальное — статика фронта.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
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

// Deps — зависимости обработчиков API.
type Deps struct {
	DB     Pinger
	Logger *slog.Logger
}

// NewHandler собирает маршруты API.
func NewHandler(deps Deps) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(http.MethodGet+" "+HealthPath, health)
	mux.HandleFunc(http.MethodGet+" "+readyPath, ready(deps))
	return mux
}

// health отвечает, жив ли процесс. Базу не трогает, чтобы её сбой не перезапускал API.
func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ready отвечает, может ли API обслуживать запросы, то есть доступна ли база.
func ready(deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), databasePingTimeout)
		defer cancel()

		if err := deps.DB.Ping(ctx); err != nil {
			deps.Logger.WarnContext(ctx, "база недоступна", "err", err)
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}

// writeJSON отвечает телом body в JSON с кодом status.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
