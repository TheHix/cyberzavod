package httpapi

import (
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const (
	// galleryChangeLimit is how many recording uploads and deletions an author can make per
	// galleryChangeWindow: plenty for a real author, too few to flood the database with re-uploads.
	galleryChangeLimit  = 20
	galleryChangeWindow = time.Hour
)

// changeLimiter counts an author's attempts to change the gallery in a fixed window. Counters
// live in process memory: the API runs as a single instance.
type changeLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	windows map[int64]changeWindow
}

// changeWindow is an author's window: when it started and how many attempts it has had.
type changeWindow struct {
	startedAt time.Time
	attempts  int
}

func newChangeLimiter(limit int, window time.Duration, now func() time.Time) *changeLimiter {
	return &changeLimiter{limit: limit, window: window, now: now, windows: map[int64]changeWindow{}}
}

// allow counts an attempt by author ownerID. If the window's attempts are used up, it returns
// false and how long until the window opens again.
func (l *changeLimiter) allow(ownerID int64) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.forgetEnded(now)

	current, isOpen := l.windows[ownerID]
	if !isOpen {
		current = changeWindow{startedAt: now}
	}

	if current.attempts >= l.limit {
		endsAt := current.startedAt.Add(l.window)
		return false, endsAt.Sub(now)
	}

	l.windows[ownerID] = changeWindow{startedAt: current.startedAt, attempts: current.attempts + 1}

	return true, 0
}

// forgetEnded drops ended windows so the map does not grow forever. Called under mu.
func (l *changeLimiter) forgetEnded(now time.Time) {
	for ownerID, window := range l.windows {
		hasEnded := !now.Before(window.startedAt.Add(l.window))
		if hasEnded {
			delete(l.windows, ownerID)
		}
	}
}

// limitedChanges lets through to next until the author runs out of gallery change attempts;
// after that it responds 429 with Retry-After.
func (a *api) limitedChanges(next authorizedHandler) authorizedHandler {
	return func(w http.ResponseWriter, r *http.Request, user gallery.User) {
		isAllowed, retryAfter := a.changes.allow(user.GitHubID)
		if !isAllowed {
			writeTooManyChanges(w, retryAfter)
			return
		}

		next(w, r, user)
	}
}

func writeTooManyChanges(w http.ResponseWriter, retryAfter time.Duration) {
	// Retry-After is in whole seconds; rounded up so the retry does not come before the window.
	seconds := int(math.Ceil(retryAfter.Seconds()))
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeError(w, http.StatusTooManyRequests, codeTooManyRequests,
		"Слишком много загрузок и удалений записей, попробуйте позже")
}
