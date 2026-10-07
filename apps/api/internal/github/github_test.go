package github

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const validToken = "gho_valid"

// fakeGitHub — GET /user, как у GitHub: validToken принадлежит octocat, остальные отклоняются.
// Считает запросы, чтобы было видно, когда сработал кэш.
type fakeGitHub struct {
	status   int
	body     string
	requests atomic.Int32
}

func (f *fakeGitHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.requests.Add(1)

	isValid := r.URL.Path == "/user" && r.Header.Get("Authorization") == "Bearer "+validToken
	if !isValid {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	w.WriteHeader(f.status)
	_, _ = w.Write([]byte(f.body))
}

func newFakeGitHub(t *testing.T, status int, body string) (*fakeGitHub, *Verifier) {
	t.Helper()

	fake := &fakeGitHub{status: status, body: body}
	server := httptest.NewServer(fake)
	t.Cleanup(server.Close)

	return fake, NewVerifier(server.URL + "/")
}

// fakeClock — часы, которые идут, только когда их переводят.
type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

func TestVerifierVerify(t *testing.T) {
	tests := []struct {
		name         string
		token        string
		status       int
		body         string
		want         gallery.User
		wantRejected bool
		wantErr      bool
	}{
		{"токен принят", validToken, http.StatusOK, `{"id":583231,"login":"octocat","name":"x"}`, gallery.User{GitHubID: 583231, Login: "octocat"}, false, false},
		{"токен отклонён", "gho_bad", http.StatusOK, "", gallery.User{}, true, true},
		{"GitHub недоступен", validToken, http.StatusBadGateway, "", gallery.User{}, false, true},
		{"ответ не JSON", validToken, http.StatusOK, "<html>", gallery.User{}, false, true},
		{"в ответе нет логина", validToken, http.StatusOK, `{"id":1}`, gallery.User{}, false, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, verifier := newFakeGitHub(t, tt.status, tt.body)

			user, err := verifier.Verify(t.Context(), tt.token)

			if (err != nil) != tt.wantErr {
				t.Fatalf("ошибка %v, ожидалась ошибка: %v", err, tt.wantErr)
			}
			if errors.Is(err, gallery.ErrTokenRejected) != tt.wantRejected {
				t.Fatalf("ошибка %v, ожидался отказ в токене: %v", err, tt.wantRejected)
			}
			if user != tt.want {
				t.Fatalf("автор %+v, ожидался %+v", user, tt.want)
			}
		})
	}
}

func TestVerifierCache(t *testing.T) {
	tests := []struct {
		name         string
		elapsed      time.Duration
		wantRequests int32
	}{
		{"повтор в течение 10 минут не идёт в GitHub", 9 * time.Minute, 1},
		{"через 10 минут токен проверяется заново", 10 * time.Minute, 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake, verifier := newFakeGitHub(t, http.StatusOK, `{"id":1,"login":"octocat"}`)
			clock := &fakeClock{now: time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)}
			verifier.cache = newTokenCache(tokenCacheTTL, clock.Now)
			if _, err := verifier.Verify(t.Context(), validToken); err != nil {
				t.Fatalf("первая проверка: %v", err)
			}
			clock.now = clock.now.Add(tt.elapsed)

			_, err := verifier.Verify(t.Context(), validToken)
			if err != nil {
				t.Fatalf("повторная проверка: %v", err)
			}
			if got := fake.requests.Load(); got != tt.wantRequests {
				t.Fatalf("запросов к GitHub %d, ожидалось %d", got, tt.wantRequests)
			}
		})
	}
}

func TestVerifierCacheKeyedByToken(t *testing.T) {
	fake, verifier := newFakeGitHub(t, http.StatusOK, `{"id":1,"login":"octocat"}`)
	if _, err := verifier.Verify(t.Context(), validToken); err != nil {
		t.Fatalf("проверка своего токена: %v", err)
	}

	_, err := verifier.Verify(t.Context(), "gho_other")

	if !errors.Is(err, gallery.ErrTokenRejected) {
		t.Fatalf("чужой токен: ошибка %v, ожидался отказ", err)
	}
	if got := fake.requests.Load(); got != 2 {
		t.Fatalf("запросов к GitHub %d, ожидалось 2: другой токен — другой ключ кэша", got)
	}
}
