package store

import (
	"errors"
	"testing"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/session"
)

// openSession заводит автора octocat и сохраняет ему сессию, которая истекает через
// expiresIn (отрицательное — уже истекла). Возвращает идентификатор сессии.
func openSession(t *testing.T, store *Store, expiresIn time.Duration) string {
	t.Helper()

	saveAuthor(t, store, octocat, false, 0)
	token, created, err := session.New(octocat.GitHubID, time.Now())
	if err != nil {
		t.Fatalf("новая сессия: %v", err)
	}

	created.ExpiresAt = time.Now().Add(expiresIn)
	if err := store.CreateSession(t.Context(), created); err != nil {
		t.Fatalf("сохранение сессии: %v", err)
	}

	return token
}

// countSessions возвращает, сколько сессий лежит в базе, включая просроченные.
func countSessions(t *testing.T, store *Store) int {
	t.Helper()

	var count int
	if err := store.pool.QueryRow(t.Context(), `SELECT count(*) FROM sessions`).Scan(&count); err != nil {
		t.Fatalf("подсчёт сессий: %v", err)
	}

	return count
}

func TestSessionUser(t *testing.T) {
	tests := []struct {
		name      string
		expiresIn time.Duration
		lookup    func(token string) string
		wantErr   error
	}{
		{"живая сессия", session.Lifetime, func(token string) string { return token }, nil},
		{"просроченная сессия", -time.Minute, func(token string) string { return token }, session.ErrNotFound},
		{"чужой идентификатор", session.Lifetime, func(string) string { return "unknown" }, session.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newTestStore(t)
			token := openSession(t, store, tt.expiresIn)

			user, err := store.SessionUser(t.Context(), session.HashToken(tt.lookup(token)))

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ошибка %v, ожидалась %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && user != octocat {
				t.Fatalf("автор %+v, ожидался %+v", user, octocat)
			}
		})
	}
}

func TestDeleteSession(t *testing.T) {
	store := newTestStore(t)
	token := openSession(t, store, session.Lifetime)

	err := store.DeleteSession(t.Context(), session.HashToken(token))
	if err != nil {
		t.Fatalf("удаление: %v", err)
	}

	if _, err := store.SessionUser(t.Context(), session.HashToken(token)); !errors.Is(err, session.ErrNotFound) {
		t.Fatalf("после удаления ошибка %v, ожидалась %v", err, session.ErrNotFound)
	}
	if err := store.DeleteSession(t.Context(), session.HashToken(token)); err != nil {
		t.Fatalf("повторное удаление: %v", err)
	}
}

func TestCreateSessionForgetsExpired(t *testing.T) {
	store := newTestStore(t)
	openSession(t, store, -time.Minute)

	openSession(t, store, session.Lifetime)

	if count := countSessions(t, store); count != 1 {
		t.Fatalf("сессий %d, ожидалась одна живая", count)
	}
}
