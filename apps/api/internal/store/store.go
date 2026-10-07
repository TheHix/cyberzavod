// Package store хранит галереи в Postgres: авторов, их записи и сводку по открытым галереям.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const queryTimeout = 5 * time.Second

// Store — галереи в Postgres. Каждый метод ограничен queryTimeout.
type Store struct {
	pool *pgxpool.Pool
}

// New создаёт хранилище галерей поверх пула соединений.
func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const summaryColumns = `record_id, slug, project_id, title, language, started_at, uploaded_at`

// SaveUser заводит автора или обновляет его логин: логин на GitHub могут сменить.
func (s *Store) SaveUser(ctx context.Context, user gallery.User) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := releaseLogin(ctx, tx, user); err != nil {
			return err
		}

		return upsertUser(ctx, tx, user)
	})
	if err != nil {
		return fmt.Errorf("сохранение автора: %w", err)
	}

	return nil
}

// releaseLogin снимает логин с другого автора, у которого он записан. Так бывает, когда
// тот сменил логин на GitHub, а его старый логин занял кто-то ещё. Прежний владелец получает
// метку "#<id>": такого логина на GitHub не бывает, а настоящий вернётся при его входе.
func releaseLogin(ctx context.Context, tx pgx.Tx, user gallery.User) error {
	_, err := tx.Exec(ctx, `
		UPDATE users SET login = '#' || github_id::text, updated_at = now()
		WHERE lower(login) = lower($2) AND github_id <> $1`,
		user.GitHubID, user.Login)
	if err != nil {
		return fmt.Errorf("освобождение логина: %w", err)
	}

	return nil
}

func upsertUser(ctx context.Context, tx pgx.Tx, user gallery.User) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO users (github_id, login) VALUES ($1, $2)
		ON CONFLICT (github_id) DO UPDATE SET login = EXCLUDED.login, updated_at = now()
		WHERE users.login <> EXCLUDED.login`,
		user.GitHubID, user.Login)
	if err != nil {
		return fmt.Errorf("запись автора: %w", err)
	}

	return nil
}

// Account возвращает галерею автора с его записями, свежие сверху.
// Если автора нет — gallery.ErrNotFound.
func (s *Store) Account(ctx context.Context, ownerID int64) (gallery.Account, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var account gallery.Account
	err := s.pool.QueryRow(ctx,
		`SELECT login, gallery_public FROM users WHERE github_id = $1`, ownerID,
	).Scan(&account.Login, &account.GalleryPublic)
	if errors.Is(err, pgx.ErrNoRows) {
		return gallery.Account{}, gallery.ErrNotFound
	}

	if err != nil {
		return gallery.Account{}, fmt.Errorf("чтение автора: %w", err)
	}

	recordings, err := s.recordings(ctx, ownerID)
	if err != nil {
		return gallery.Account{}, err
	}

	account.Recordings = recordings

	return account, nil
}

// recordings возвращает записи автора, свежие сверху.
func (s *Store) recordings(ctx context.Context, ownerID int64) ([]gallery.Summary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+summaryColumns+` FROM recordings
		WHERE owner_id = $1
		ORDER BY started_at DESC, record_id`,
		ownerID)
	if err != nil {
		return nil, fmt.Errorf("чтение записей автора: %w", err)
	}

	summaries, err := pgx.CollectRows(rows, pgx.RowToStructByPos[gallery.Summary])
	if err != nil {
		return nil, fmt.Errorf("чтение записей автора: %w", err)
	}

	return summaries, nil
}

// SaveRecording кладёт запись в галерею автора или заменяет её, если запись с тем же id уже
// там. isNew — запись новая. Новая запись сверх gallery.RecordingLimit — gallery.ErrLimitReached.
func (s *Store) SaveRecording(ctx context.Context, ownerID int64, recording gallery.Recording) (summary gallery.Summary, isNew bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		summary, isNew, err = saveRecording(ctx, tx, ownerID, recording)
		return err
	})
	if err != nil {
		return gallery.Summary{}, false, fmt.Errorf("сохранение записи: %w", err)
	}

	return summary, isNew, nil
}

// saveRecording сохраняет запись под блокировкой строки автора: параллельные загрузки
// одного автора идут по очереди и не превышают предел вдвоём.
func saveRecording(ctx context.Context, tx pgx.Tx, ownerID int64, recording gallery.Recording) (gallery.Summary, bool, error) {
	if err := lockOwner(ctx, tx, ownerID); err != nil {
		return gallery.Summary{}, false, err
	}

	slug, isNew, err := slugForRecording(ctx, tx, ownerID, recording.ID)
	if err != nil {
		return gallery.Summary{}, false, err
	}

	summary, err := upsertRecording(ctx, tx, ownerID, slug, recording)
	if err != nil {
		return gallery.Summary{}, false, err
	}

	if err := touchOwner(ctx, tx, ownerID); err != nil {
		return gallery.Summary{}, false, err
	}

	return summary, isNew, nil
}

// lockOwner блокирует строку автора до конца транзакции.
func lockOwner(ctx context.Context, tx pgx.Tx, ownerID int64) error {
	var lockedID int64
	err := tx.QueryRow(ctx, `SELECT github_id FROM users WHERE github_id = $1 FOR UPDATE`, ownerID).Scan(&lockedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return gallery.ErrNotFound
	}

	if err != nil {
		return fmt.Errorf("блокировка автора: %w", err)
	}

	return nil
}

// slugForRecording возвращает ссылку уже лежащей записи или выдаёт новую, если в галерее
// есть место.
func slugForRecording(ctx context.Context, tx pgx.Tx, ownerID int64, recordID string) (slug string, isNew bool, err error) {
	err = tx.QueryRow(ctx,
		`SELECT slug FROM recordings WHERE owner_id = $1 AND record_id = $2`, ownerID, recordID,
	).Scan(&slug)
	if err == nil {
		return slug, false, nil
	}

	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, fmt.Errorf("поиск записи: %w", err)
	}

	if err := ensureRoom(ctx, tx, ownerID); err != nil {
		return "", false, err
	}

	slug, err = gallery.NewSlug()

	return slug, true, err
}

// ensureRoom проверяет, что в галерее автора есть место для новой записи.
func ensureRoom(ctx context.Context, tx pgx.Tx, ownerID int64) error {
	var count int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM recordings WHERE owner_id = $1`, ownerID).Scan(&count)
	if err != nil {
		return fmt.Errorf("подсчёт записей: %w", err)
	}

	if count >= gallery.RecordingLimit {
		return gallery.ErrLimitReached
	}

	return nil
}

// upsertRecording пишет запись; у заменённой записи ссылка остаётся прежней.
func upsertRecording(ctx context.Context, tx pgx.Tx, ownerID int64, slug string, recording gallery.Recording) (gallery.Summary, error) {
	rows, err := tx.Query(ctx, `
		INSERT INTO recordings
			(owner_id, record_id, slug, project_id, title, language, started_at, body, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
		ON CONFLICT (owner_id, record_id) DO UPDATE SET
			project_id = EXCLUDED.project_id,
			title = EXCLUDED.title,
			language = EXCLUDED.language,
			started_at = EXCLUDED.started_at,
			body = EXCLUDED.body,
			uploaded_at = EXCLUDED.uploaded_at
		RETURNING `+summaryColumns,
		ownerID, recording.ID, slug, recording.ProjectID, recording.Title, recording.Language,
		recording.StartedAt, recording.Body)
	if err != nil {
		return gallery.Summary{}, fmt.Errorf("запись в галерею: %w", err)
	}

	summary, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[gallery.Summary])
	if err != nil {
		return gallery.Summary{}, fmt.Errorf("запись в галерею: %w", err)
	}

	return summary, nil
}

// touchOwner отмечает, что галерея автора изменилась: по этому времени сортируется список
// открытых галерей.
func touchOwner(ctx context.Context, tx pgx.Tx, ownerID int64) error {
	_, err := tx.Exec(ctx, `UPDATE users SET updated_at = now() WHERE github_id = $1`, ownerID)
	if err != nil {
		return fmt.Errorf("отметка о перемене галереи: %w", err)
	}

	return nil
}

// DeleteRecording убирает запись из галереи автора. Если такой записи нет — gallery.ErrNotFound.
func (s *Store) DeleteRecording(ctx context.Context, ownerID int64, recordID string) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if err := deleteRecording(ctx, tx, ownerID, recordID); err != nil {
			return err
		}

		return touchOwner(ctx, tx, ownerID)
	})
	if err != nil {
		return fmt.Errorf("удаление записи: %w", err)
	}

	return nil
}

func deleteRecording(ctx context.Context, tx pgx.Tx, ownerID int64, recordID string) error {
	tag, err := tx.Exec(ctx,
		`DELETE FROM recordings WHERE owner_id = $1 AND record_id = $2`, ownerID, recordID)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return gallery.ErrNotFound
	}

	return nil
}

// SetGalleryPublic открывает или закрывает галерею автора. Если автора нет — gallery.ErrNotFound.
func (s *Store) SetGalleryPublic(ctx context.Context, ownerID int64, isPublic bool) error {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	tag, err := s.pool.Exec(ctx,
		`UPDATE users SET gallery_public = $2, updated_at = now() WHERE github_id = $1`,
		ownerID, isPublic)
	if err != nil {
		return fmt.Errorf("смена видимости галереи: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return gallery.ErrNotFound
	}

	return nil
}

// PublicGalleries возвращает открытые галереи, недавно изменённые сверху.
func (s *Store) PublicGalleries(ctx context.Context) ([]gallery.Overview, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	rows, err := s.pool.Query(ctx, `
		SELECT u.login, count(r.record_id), u.updated_at
		FROM users u
		LEFT JOIN recordings r ON r.owner_id = u.github_id
		WHERE u.gallery_public
		GROUP BY u.github_id
		ORDER BY u.updated_at DESC, u.login`)
	if err != nil {
		return nil, fmt.Errorf("чтение открытых галерей: %w", err)
	}

	overviews, err := pgx.CollectRows(rows, pgx.RowToStructByPos[gallery.Overview])
	if err != nil {
		return nil, fmt.Errorf("чтение открытых галерей: %w", err)
	}

	return overviews, nil
}

// PublicGallery возвращает открытую галерею по логину без учёта регистра.
// Закрытая и несуществующая галерея — gallery.ErrNotFound: посторонний их не различает.
func (s *Store) PublicGallery(ctx context.Context, login string) (gallery.Gallery, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var (
		ownerID    int64
		ownerLogin string
	)
	err := s.pool.QueryRow(ctx,
		`SELECT github_id, login FROM users WHERE lower(login) = lower($1) AND gallery_public`, login,
	).Scan(&ownerID, &ownerLogin)
	if errors.Is(err, pgx.ErrNoRows) {
		return gallery.Gallery{}, gallery.ErrNotFound
	}

	if err != nil {
		return gallery.Gallery{}, fmt.Errorf("чтение галереи: %w", err)
	}

	recordings, err := s.recordings(ctx, ownerID)
	if err != nil {
		return gallery.Gallery{}, err
	}

	return gallery.Gallery{Login: ownerLogin, Recordings: recordings}, nil
}

// SharedRecording возвращает запись по секретной ссылке. Если ссылки нет — gallery.ErrNotFound.
func (s *Store) SharedRecording(ctx context.Context, slug string) (gallery.SharedRecording, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var shared gallery.SharedRecording
	err := s.pool.QueryRow(ctx, `
		SELECT u.login, u.gallery_public, r.body
		FROM recordings r
		JOIN users u ON u.github_id = r.owner_id
		WHERE r.slug = $1`,
		slug,
	).Scan(&shared.Owner, &shared.GalleryPublic, &shared.Record)
	if errors.Is(err, pgx.ErrNoRows) {
		return gallery.SharedRecording{}, gallery.ErrNotFound
	}

	if err != nil {
		return gallery.SharedRecording{}, fmt.Errorf("чтение записи по ссылке: %w", err)
	}

	return shared, nil
}
