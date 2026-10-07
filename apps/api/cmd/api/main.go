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

	"github.com/bysavelii/cyberzavod/apps/api/internal/config"
	"github.com/bysavelii/cyberzavod/apps/api/internal/db"
	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
	"github.com/bysavelii/cyberzavod/apps/api/internal/github"
	"github.com/bysavelii/cyberzavod/apps/api/internal/httpapi"
	"github.com/bysavelii/cyberzavod/apps/api/internal/store"
)

const (
	defaultCommand = "serve"

	readHeaderTimeout  = 5 * time.Second
	readTimeout        = 15 * time.Second
	writeTimeout       = 15 * time.Second
	idleTimeout        = 60 * time.Second
	shutdownTimeout    = 10 * time.Second
	healthcheckTimeout = 3 * time.Second
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cmd := defaultCommand
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	err := run(ctx, stop, cmd, logger)
	if err != nil {
		logger.Error("ошибка", "cmd", cmd, "err", err)
		os.Exit(1)
	}
}

// run выполняет подкоманду cmd. stop нужен только serve: см. комментарий к нему.
func run(ctx context.Context, stop context.CancelFunc, cmd string, logger *slog.Logger) error {
	switch cmd {
	case "serve":
		return serve(ctx, stop, logger)
	case "migrate":
		return migrate(ctx, logger)
	case "healthcheck":
		return healthcheck(ctx)
	default:
		return fmt.Errorf("неизвестная команда %q", cmd)
	}
}

// serve запускает HTTP-сервер и ждёт сигнала остановки.
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

	galleryStore := store.New(pool, gallery.StorageLimitBytes)
	handler := httpapi.NewHandler(httpapi.Deps{
		DB:             pool,
		Galleries:      galleryStore,
		Sessions:       galleryStore,
		Tokens:         github.NewVerifier(cfg.GitHubAPIURL),
		GitHubClientID: cfg.GitHubClientID,
		OAuth:          siteLogin(cfg),
		PublicURL:      cfg.PublicURL,
		Logger:         logger,
	})
	srv := newServer(cfg.Addr, handler)

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

	return shutdown(srv, errCh)
}

// siteLogin возвращает OAuth-приложение для входа на сайте или nil, если вход не настроен.
// nil возвращается явно: *github.OAuthApp, равный nil, в интерфейсе nil не был бы.
func siteLogin(cfg config.Config) httpapi.OAuthApp {
	if !cfg.HasSiteLogin() {
		return nil
	}

	return github.NewOAuthApp(cfg.GitHubOAuthURL, cfg.GitHubClientID, cfg.GitHubClientSecret)
}

func newServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
}

// shutdown останавливает сервер и дожидается завершения ListenAndServe.
func shutdown(srv *http.Server, errCh <-chan error) error {
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		return err
	}

	err := <-errCh
	if !errors.Is(err, http.ErrServerClosed) {
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
	url, err := config.LocalURL(config.Addr(), httpapi.HealthPath)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, healthcheckTimeout)
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
