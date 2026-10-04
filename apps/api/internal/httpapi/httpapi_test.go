package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func newTestHandler(dbErr error) http.Handler {
	return NewHandler(Deps{
		DB:     fakeDB{err: dbErr},
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
}

func TestRoutes(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		dbErr  error
		want   int
	}{
		{"health без базы", http.MethodGet, "/api/health", errors.New("down"), http.StatusOK},
		{"ready с базой", http.MethodGet, "/api/ready", nil, http.StatusOK},
		{"ready без базы", http.MethodGet, "/api/ready", errors.New("down"), http.StatusServiceUnavailable},
		{"неверный метод", http.MethodPost, "/api/health", nil, http.StatusMethodNotAllowed},
		{"неизвестный путь", http.MethodGet, "/api/nope", nil, http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := newTestHandler(tt.dbErr)
			rec := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), tt.method, tt.path, nil)

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.want {
				t.Fatalf("%s %s: код %d, ожидался %d", tt.method, tt.path, rec.Code, tt.want)
			}
		})
	}
}
