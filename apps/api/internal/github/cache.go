package github

import (
	"sync"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

// tokenCache remembers the author by the token's sha256: the token itself is not kept in memory.
type tokenCache struct {
	ttl time.Duration
	now func() time.Time

	mu      sync.Mutex
	entries map[[32]byte]cachedUser
}

type cachedUser struct {
	user      gallery.User
	expiresAt time.Time
}

func newTokenCache(ttl time.Duration, now func() time.Time) *tokenCache {
	return &tokenCache{ttl: ttl, now: now, entries: map[[32]byte]cachedUser{}}
}

func (c *tokenCache) get(key [32]byte) (gallery.User, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, isFound := c.entries[key]
	isFresh := isFound && c.now().Before(entry.expiresAt)

	if !isFresh {
		return gallery.User{}, false
	}

	return entry.user, true
}

func (c *tokenCache) put(key [32]byte, user gallery.User) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	c.forgetExpired(now)
	c.entries[key] = cachedUser{user: user, expiresAt: now.Add(c.ttl)}
}

// forgetExpired drops expired tokens so the cache does not grow forever. Called under mu.
func (c *tokenCache) forgetExpired(now time.Time) {
	for key, entry := range c.entries {
		isExpired := !now.Before(entry.expiresAt)
		if isExpired {
			delete(c.entries, key)
		}
	}
}
