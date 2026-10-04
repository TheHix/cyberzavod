// Команда api — один бинарник с тремя подкомандами:
//
//	api serve        HTTP-сервер (по умолчанию)
//	api migrate      применить миграции и выйти
//	api healthcheck  проверить /api/health; нужна для healthcheck в контейнере без curl
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TheHix/cyberzavod/apps/api/internal/config"
	"github.com/TheHix/cyberzavod/apps/api/internal/db"
	"github.com/TheHix/cyberzavod/apps/api/internal/httpapi"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var err error
	switch cmd {
	case "serve":
		err = serve(ctx, stop, logger)
	case "migrate":
		err = migrate(ctx, logger)
	case "healthcheck":
		err = healthcheck(ctx)
	default:
		err = fmt.Errorf("неизвестная команда %q", cmd)
	}
	if err != nil {
		logger.Error("ошибка", "cmd", cmd, "err", err)
		os.Exit(1)
	}
}

// stop отменяет подписку на сигналы: после первого сигнала второй завершает процесс сразу.
func serve(ctx context.Context, stop context.CancelFunc, logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpapi.NewHandler(httpapi.Deps{DB: pool, Logger: logger}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("API запущен", "addr", cfg.Addr)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	stop()

	logger.Info("останавливаюсь")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-errCh; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func migrate(ctx context.Context, logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if err := db.Migrate(ctx, cfg.DatabaseURL); err != nil {
		return err
	}
	logger.Info("миграции применены")
	return nil
}

func healthcheck(ctx context.Context) error {
	url, err := config.LocalURL(config.Addr(), "/api/health")
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	// Тело ответа healthcheck не читается: ошибка закрытия ничего не меняет в результате.
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health вернул %d", resp.StatusCode)
	}
	return nil
}
