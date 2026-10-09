package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
	"github.com/bysavelii/cyberzavod/apps/api/internal/session"
)

// CreateSession saves a new author session and also deletes expired ones, so the table
// does not grow forever.
func (s *Store) CreateSession(ctx context.Context, created session.Session) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := deleteExpiredSessions(ctx, tx); err != nil {
			return err
		}

		return insertSession(ctx, tx, created)
	})
	if err != nil {
		return fmt.Errorf("создание сессии: %w", err)
	}

	return nil
}

func deleteExpiredSessions(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `DELETE FROM sessions WHERE expires_at <= now()`); err != nil {
		return fmt.Errorf("удаление просроченных сессий: %w", err)
	}

	return nil
}

func insertSession(ctx context.Context, tx pgx.Tx, created session.Session) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		created.TokenHash, created.UserID, created.ExpiresAt)
	if err != nil {
		return fmt.Errorf("запись сессии: %w", err)
	}

	return nil
}

// SessionUser returns the author of a live session by the sha256 of its identifier.
// A missing or expired session gives session.ErrNotFound.
func (s *Store) SessionUser(ctx context.Context, tokenHash []byte) (gallery.User, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var user gallery.User
	err := s.pool.QueryRow(ctx, `
		SELECT u.github_id, u.login
		FROM sessions s
		JOIN users u ON u.github_id = s.user_id
		WHERE s.token_hash = $1 AND s.expires_at > now()`,
		tokenHash,
	).Scan(&user.GitHubID, &user.Login)
	if errors.Is(err, pgx.ErrNoRows) {
		return gallery.User{}, session.ErrNotFound
	}

	if err != nil {
		return gallery.User{}, fmt.Errorf("чтение сессии: %w", err)
	}

	return user, nil
}

// DeleteSession deletes a session by the sha256 of its identifier. A missing one is not an error.
func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	if _, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash); err != nil {
		return fmt.Errorf("удаление сессии: %w", err)
	}

	return nil
}
