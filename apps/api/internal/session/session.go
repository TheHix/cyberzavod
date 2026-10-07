// Package session описывает сессии входа на сайте: браузер держит случайный идентификатор,
// сервер — только его sha256, чтобы утечка базы не давала войти чужими сессиями.
// Пакет не знает ни о базе, ни об HTTP.
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
	// Lifetime — срок сессии с момента входа.
	Lifetime = 30 * 24 * time.Hour
	// tokenBytes — 256 случайных бит: перебрать такой идентификатор нельзя.
	tokenBytes = 32
)

// ErrNotFound — сессии нет или она просрочена.
var ErrNotFound = errors.New("сессия не найдена")

// Session — сессия автора глазами сервера: хэш идентификатора, автор и срок.
type Session struct {
	TokenHash []byte
	UserID    int64
	ExpiresAt time.Time
}

// RandomToken возвращает 32 случайных байта в base64url без выравнивания: годится
// и для идентификатора сессии, и для state входа через GitHub. Ошибка — системный
// источник случайности недоступен.
func RandomToken() (string, error) {
	random := make([]byte, tokenBytes)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("случайный идентификатор: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(random), nil
}

// HashToken возвращает sha256 идентификатора сессии: по нему сессию ищут в хранилище.
func HashToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}

// New открывает сессию автора userID в момент now: возвращает идентификатор для браузера
// и сессию для хранилища.
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
