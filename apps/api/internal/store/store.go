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

const (
	queryTimeout = 5 * time.Second
	// storageLockKey — ключ advisory-блокировки Postgres, под которой загрузки всех авторов
	// по очереди сверяют общий объём с потолком. Число произвольное, лишь бы своё.
	storageLockKey int64 = 0x637a_7374_6f72_6167
)

// Store — галереи в Postgres. Каждый метод ограничен queryTimeout.
type Store struct {
	pool *pgxpool.Pool
	// storageLimitBytes — потолок суммы тел записей всех галерей.
	storageLimitBytes int64
}

// New создаёт хранилище галерей поверх пула соединений с потолком storageLimitBytes на
// сумму тел записей всех галерей (в работе — gallery.StorageLimitBytes).
func New(pool *pgxpool.Pool, storageLimitBytes int64) *Store {
	return &Store{pool: pool, storageLimitBytes: storageLimitBytes}
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
// там. isNew — запись новая. Новая запись сверх gallery.RecordingLimit — gallery.ErrLimitReached;
// запись, которая выросла и не помещается под потолок хранилища, — gallery.ErrStorageFull.
func (s *Store) SaveRecording(ctx context.Context, ownerID int64, recording gallery.Recording) (summary gallery.Summary, isNew bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		summary, isNew, err = s.saveRecording(ctx, tx, ownerID, recording)
		return err
	})
	if err != nil {
		return gallery.Summary{}, false, fmt.Errorf("сохранение записи: %w", err)
	}

	return summary, isNew, nil
}

// saveRecording сохраняет запись под блокировкой строки автора: параллельные загрузки
// одного автора идут по очереди и не превышают предел вдвоём.
func (s *Store) saveRecording(ctx context.Context, tx pgx.Tx, ownerID int64, recording gallery.Recording) (gallery.Summary, bool, error) {
	if err := lockOwner(ctx, tx, ownerID); err != nil {
		return gallery.Summary{}, false, err
	}

	previousBytes, err := recordingBytes(ctx, tx, ownerID, recording.ID)
	if err != nil {
		return gallery.Summary{}, false, err
	}

	slug, isNew, err := slugForRecording(ctx, tx, ownerID, recording.ID)
	if err != nil {
		return gallery.Summary{}, false, err
	}

	summary, savedBytes, err := upsertRecording(ctx, tx, ownerID, slug, recording)
	if err != nil {
		return gallery.Summary{}, false, err
	}

	hasGrown := savedBytes > previousBytes
	if hasGrown {
		if err := s.ensureStorage(ctx, tx); err != nil {
			return gallery.Summary{}, false, err
		}
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

// recordingBytes возвращает размер тела уже лежащей записи; новой записи — 0.
func recordingBytes(ctx context.Context, tx pgx.Tx, ownerID int64, recordID string) (int64, error) {
	var size int64
	err := tx.QueryRow(ctx,
		`SELECT body_bytes FROM recordings WHERE owner_id = $1 AND record_id = $2`, ownerID, recordID,
	).Scan(&size)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}

	if err != nil {
		return 0, fmt.Errorf("размер записи: %w", err)
	}

	return size, nil
}

// savedRecording — строка записи после сохранения: сводка и размер тела.
type savedRecording struct {
	gallery.Summary
	BodyBytes int64
}

// upsertRecording пишет запись и возвращает её сводку и размер тела; у заменённой записи
// ссылка остаётся прежней. Размер считает Postgres тем же выражением, что и миграция.
func upsertRecording(ctx context.Context, tx pgx.Tx, ownerID int64, slug string, recording gallery.Recording) (gallery.Summary, int64, error) {
	rows, err := tx.Query(ctx, `
		INSERT INTO recordings
			(owner_id, record_id, slug, project_id, title, language, started_at, body, body_bytes, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, octet_length($8::jsonb::text), now())
		ON CONFLICT (owner_id, record_id) DO UPDATE SET
			project_id = EXCLUDED.project_id,
			title = EXCLUDED.title,
			language = EXCLUDED.language,
			started_at = EXCLUDED.started_at,
			body = EXCLUDED.body,
			body_bytes = EXCLUDED.body_bytes,
			uploaded_at = EXCLUDED.uploaded_at
		RETURNING `+summaryColumns+`, body_bytes`,
		ownerID, recording.ID, slug, recording.ProjectID, recording.Title, recording.Language,
		recording.StartedAt, recording.Body)
	if err != nil {
		return gallery.Summary{}, 0, fmt.Errorf("запись в галерею: %w", err)
	}

	saved, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByPos[savedRecording])
	if err != nil {
		return gallery.Summary{}, 0, fmt.Errorf("запись в галерею: %w", err)
	}

	return saved.Summary, saved.BodyBytes, nil
}

// ensureStorage проверяет, что тела записей всех галерей, уже со свежей записью, не выше
// потолка. Advisory-блокировка до конца транзакции ставит загрузки разных авторов в очередь:
// иначе две параллельные загрузки вместе перешагнули бы потолок.
func (s *Store) ensureStorage(ctx context.Context, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, storageLockKey); err != nil {
		return fmt.Errorf("блокировка хранилища: %w", err)
	}

	var totalBytes int64
	if err := tx.QueryRow(ctx, `SELECT coalesce(sum(body_bytes), 0) FROM recordings`).Scan(&totalBytes); err != nil {
		return fmt.Errorf("подсчёт объёма хранилища: %w", err)
	}

	if totalBytes > s.storageLimitBytes {
		return gallery.ErrStorageFull
	}

	return nil
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
