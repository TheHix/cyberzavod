package session

import (
	"bytes"
	"encoding/base64"
	"testing"
	"time"
)

func TestNew(t *testing.T) {
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)

	token, created, err := New(7, now)
	if err != nil {
		t.Fatalf("ошибка %v", err)
	}

	random, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(random) != tokenBytes {
		t.Fatalf("идентификатор %q не 32 байта в base64url: %v", token, err)
	}
	if !bytes.Equal(created.TokenHash, HashToken(token)) {
		t.Fatalf("в сессии не sha256 идентификатора")
	}
	if created.UserID != 7 {
		t.Fatalf("автор %d, ожидался 7", created.UserID)
	}
	if !created.ExpiresAt.Equal(now.Add(Lifetime)) {
		t.Fatalf("срок %v, ожидался %v", created.ExpiresAt, now.Add(Lifetime))
	}
}

func TestRandomToken(t *testing.T) {
	first, err := RandomToken()
	if err != nil {
		t.Fatalf("ошибка %v", err)
	}

	second, err := RandomToken()
	if err != nil {
		t.Fatalf("ошибка %v", err)
	}

	if first == second {
		t.Fatalf("два идентификатора совпали: %q", first)
	}
}
