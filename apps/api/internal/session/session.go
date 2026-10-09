// Package session describes site sign-in sessions: the browser keeps a random identifier, the
// server only its sha256, so that a database leak does not let anyone use other people's sessions.
// The package knows nothing about the database or HTTP.
package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"
)

const (
	// Lifetime is the session duration from sign-in.
	Lifetime = 30 * 24 * time.Hour
	// tokenBytes is 256 random bits: such an identifier cannot be brute-forced.
	tokenBytes = 32
)

// ErrNotFound means the session does not exist or has expired.
var ErrNotFound = errors.New("сессия не найдена")

// Session is an author's session as the server sees it: identifier hash, author and expiry.
type Session struct {
	TokenHash []byte
	UserID    int64
	ExpiresAt time.Time
}

// RandomToken returns 32 random bytes in base64url without padding: suitable both
// for a session identifier and for the GitHub sign-in state. An error means the system
// source of randomness is unavailable.
func RandomToken() (string, error) {
	random := make([]byte, tokenBytes)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("случайный идентификатор: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(random), nil
}

// HashToken returns the sha256 of a session identifier: the store looks sessions up by it.
func HashToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}

// New opens a session for author userID at time now: it returns the identifier for the browser
// and the session for the store.
func New(userID int64, now time.Time) (token string, created Session, err error) {
	token, err = RandomToken()
	if err != nil {
		return "", Session{}, err
	}

	created = Session{
		TokenHash: HashToken(token),
		UserID:    userID,
		ExpiresAt: now.Add(Lifetime),
	}

	return token, created, nil
}
