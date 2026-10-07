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
	// galleryChangeLimit — сколько загрузок и удалений записей автор может сделать за
	// galleryChangeWindow: живому автору хватает с запасом, а забить базу перезаливками нельзя.
	galleryChangeLimit  = 20
	galleryChangeWindow = time.Hour
)

// changeLimiter считает попытки автора менять галерею в фиксированном окне. Счётчики живут
// в памяти процесса: API работает одним экземпляром.
type changeLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	windows map[int64]changeWindow
}

// changeWindow — окно автора: когда началось и сколько попыток в нём уже было.
type changeWindow struct {
	startedAt time.Time
	attempts  int
}

func newChangeLimiter(limit int, window time.Duration, now func() time.Time) *changeLimiter {
	return &changeLimiter{limit: limit, window: window, now: now, windows: map[int64]changeWindow{}}
}

// allow засчитывает попытку автора ownerID. Если попытки в окне кончились — false и через
// сколько окно откроется заново.
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

// forgetEnded убирает закончившиеся окна, чтобы карта не росла без конца. Вызывается под mu.
func (l *changeLimiter) forgetEnded(now time.Time) {
	for ownerID, window := range l.windows {
		hasEnded := !now.Before(window.startedAt.Add(l.window))
		if hasEnded {
			delete(l.windows, ownerID)
		}
	}
}

// limitedChanges пускает к next, пока автор не исчерпал попытки изменить галерею; дальше —
// 429 с Retry-After.
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
	// Retry-After — целые секунды; округление вверх, чтобы повтор не пришёл раньше окна.
	seconds := int(math.Ceil(retryAfter.Seconds()))
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	writeError(w, http.StatusTooManyRequests, codeTooManyRequests,
		"Слишком много загрузок и удалений записей, попробуйте позже")
}
