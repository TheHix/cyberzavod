package httpapi

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// testClock — часы, которые идут, только когда их переводят.
type testClock struct{ now time.Time }

func (c *testClock) Now() time.Time { return c.now }

func newTestClock() *testClock {
	return &testClock{now: time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)}
}

// spendAttempts тратит count попыток автора ownerID; каждая должна пройти.
func spendAttempts(t *testing.T, limiter *changeLimiter, ownerID int64, count int) {
	t.Helper()

	for attempt := range count {
		if isAllowed, _ := limiter.allow(ownerID); !isAllowed {
			t.Fatalf("попытка %d отклонена раньше предела", attempt+1)
		}
	}
}

func TestChangeLimiterAllow(t *testing.T) {
	tests := []struct {
		name           string
		spent          int
		elapsed        time.Duration
		ownerID        int64
		wantAllowed    bool
		wantRetryAfter time.Duration
	}{
		{"последняя попытка в окне", galleryChangeLimit - 1, 0, author.GitHubID, true, 0},
		{"попытки кончились", galleryChangeLimit, 10 * time.Minute, author.GitHubID, false, 50 * time.Minute},
		{"окно закончилось", galleryChangeLimit, galleryChangeWindow, author.GitHubID, true, 0},
		{"у другого автора своё окно", galleryChangeLimit, 0, author.GitHubID + 1, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clock := newTestClock()
			limiter := newChangeLimiter(galleryChangeLimit, galleryChangeWindow, clock.Now)
			spendAttempts(t, limiter, author.GitHubID, tt.spent)
			clock.now = clock.now.Add(tt.elapsed)

			isAllowed, retryAfter := limiter.allow(tt.ownerID)

			if isAllowed != tt.wantAllowed {
				t.Fatalf("пропущено: %v, ожидалось %v", isAllowed, tt.wantAllowed)
			}
			if retryAfter != tt.wantRetryAfter {
				t.Fatalf("повтор через %v, ожидалось %v", retryAfter, tt.wantRetryAfter)
			}
		})
	}
}

func TestChangeLimiterForgetsEndedWindows(t *testing.T) {
	clock := newTestClock()
	limiter := newChangeLimiter(galleryChangeLimit, galleryChangeWindow, clock.Now)
	for ownerID := range int64(100) {
		spendAttempts(t, limiter, ownerID, 1)
	}
	clock.now = clock.now.Add(galleryChangeWindow)

	spendAttempts(t, limiter, author.GitHubID, 1)

	if len(limiter.windows) != 1 {
		t.Fatalf("окон %d, ожидалось одно живое", len(limiter.windows))
	}
}

// changeRequest собирает загрузку или удаление записи автора по токену.
func changeRequest(t *testing.T, method string) *http.Request {
	t.Helper()

	request := httptest.NewRequestWithContext(t.Context(), method, "/api/me/recordings/abc", strings.NewReader(sessionBody("abc")))
	request.Header.Set("Authorization", "Bearer "+authorToken)

	return request
}

func TestLimitedChanges(t *testing.T) {
	clock := newTestClock()
	handler := NewHandler(Deps{
		DB:        fakeDB{},
		Galleries: &fakeGalleries{},
		Sessions:  newFakeSessions(),
		Tokens:    fakeVerifier{},
		PublicURL: testPublicURL,
		Now:       clock.Now,
		Logger:    slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	for attempt := range galleryChangeLimit {
		method := []string{http.MethodPut, http.MethodDelete}[attempt%2]
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, changeRequest(t, method))
		if recorder.Code == http.StatusTooManyRequests {
			t.Fatalf("попытка %d отклонена раньше предела", attempt+1)
		}
	}
	clock.now = clock.now.Add(time.Minute + time.Second/2)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, changeRequest(t, http.MethodPut))

	if recorder.Code != http.StatusTooManyRequests || !strings.Contains(recorder.Body.String(), codeTooManyRequests) {
		t.Fatalf("код %d, ожидался 429 %s: %s", recorder.Code, codeTooManyRequests, recorder.Body)
	}
	if got := recorder.Header().Get("Retry-After"); got != "3540" {
		t.Fatalf("Retry-After %q, ожидалось 3540: остаток 3539,5 с округляется вверх", got)
	}
	me := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/me", nil)
	me.Header.Set("Authorization", "Bearer "+authorToken)
	meRecorder := httptest.NewRecorder()
	handler.ServeHTTP(meRecorder, me)
	if meRecorder.Code != http.StatusOK {
		t.Fatalf("чтение галереи после предела: код %d, ожидался 200", meRecorder.Code)
	}
}
