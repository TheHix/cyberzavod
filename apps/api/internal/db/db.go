// Package db отвечает за подключение к Postgres и миграции схемы.
package db

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"

	"github.com/TheHix/cyberzavod/apps/api/migrations"
)

// Connect открывает пул соединений с Postgres.
func Connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("подключение к базе: %w", err)
	}
	return pool, nil
}

// Migrate применяет все миграции из папки migrations, вшитой в бинарник.
func Migrate(ctx context.Context, url string) (err error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("разбор DATABASE_URL: %w", err)
	}
	conn := stdlib.OpenDB(*cfg.ConnConfig)
	defer func() {
		if closeErr := conn.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("закрытие соединения: %w", closeErr))
		}
	}()

	// Advisory-блокировка в Postgres: два одновременных migrate не применят миграции дважды.
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return fmt.Errorf("блокировка миграций: %w", err)
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, conn, migrations.FS, goose.WithSessionLocker(locker))
	if err != nil {
		return fmt.Errorf("загрузка миграций: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("применение миграций: %w", err)
	}
	return nil
}
