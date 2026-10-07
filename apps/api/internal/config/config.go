// Package config читает настройки API из переменных окружения.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
)

const (
	defaultAddr           = ":8080"
	defaultGitHubAPIURL   = "https://api.github.com"
	defaultGitHubOAuthURL = "https://github.com"
	defaultPublicURL      = "https://cyberzavod.com"
)

// Config — настройки API, прочитанные из окружения.
type Config struct {
	// Addr — адрес, на котором слушает HTTP-сервер, например ":8080".
	Addr string
	// DatabaseURL — строка подключения к Postgres.
	DatabaseURL string
	// GitHubClientID — client_id OAuth-приложения GitHub, через которое входят из CLI по
	// device flow и на сайте. Пусто — вход недоступен, остальное API работает.
	GitHubClientID string
	// GitHubClientSecret — секрет OAuth-приложения для входа на сайте. Пусто — вход на сайте
	// недоступен, CLI работает. Не логируется.
	GitHubClientSecret string
	// GitHubAPIURL — адрес API GitHub, у которого проверяются токены авторов.
	GitHubAPIURL string
	// GitHubOAuthURL — адрес GitHub, на котором живут страница согласия и обмен кода.
	GitHubOAuthURL string
	// PublicURL — адрес сайта без завершающего "/": из него строится адрес возврата с GitHub,
	// и с ним сверяется Origin запросов по куке сессии.
	PublicURL string
}

// Load читает настройки из переменных окружения. DATABASE_URL обязателен, остальные — нет;
// PUBLIC_URL, если задан, — только схема и хост.
func Load() (Config, error) {
	cfg := Config{
		Addr:               Addr(),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		GitHubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		GitHubAPIURL:       envOrDefault("GITHUB_API_URL", defaultGitHubAPIURL),
		GitHubOAuthURL:     strings.TrimSuffix(envOrDefault("GITHUB_OAUTH_URL", defaultGitHubOAuthURL), "/"),
		PublicURL:          strings.TrimSuffix(envOrDefault("PUBLIC_URL", defaultPublicURL), "/"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("не задана переменная DATABASE_URL")
	}

	if err := validateOrigin(cfg.PublicURL); err != nil {
		return Config{}, fmt.Errorf("PUBLIC_URL: %w", err)
	}

	return cfg, nil
}

// HasSiteLogin отвечает, настроен ли вход на сайте: для него нужны и client_id, и секрет.
func (c Config) HasSiteLogin() bool {
	return c.GitHubClientID != "" && c.GitHubClientSecret != ""
}

// validateOrigin проверяет, что адрес — только схема http(s) и хост: с ним напрямую
// сравнивается заголовок Origin, а в нём пути не бывает.
func validateOrigin(address string) error {
	parsed, err := url.Parse(address)
	if err != nil {
		return fmt.Errorf("разбор адреса %q: %w", address, err)
	}

	isHTTP := parsed.Scheme == "http" || parsed.Scheme == "https"
	isOrigin := parsed.Host != "" && parsed.Path == "" && parsed.RawQuery == "" && parsed.Fragment == "" && parsed.User == nil
	if !isHTTP || !isOrigin {
		return fmt.Errorf("адрес %q должен быть вида https://хост без пути", address)
	}

	return nil
}

// Addr возвращает адрес HTTP-сервера. Отдельно от Load, потому что healthcheck база не нужна.
func Addr() string {
	return envOrDefault("API_ADDR", defaultAddr)
}

func envOrDefault(name, fallback string) string {
	value := os.Getenv(name)
	if value != "" {
		return value
	}

	return fallback
}

// LocalURL строит адрес, по которому процесс достучится до своего же сервера:
// хост из addr отбрасывается, остаётся localhost и порт.
func LocalURL(addr, path string) (string, error) {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "", fmt.Errorf("разбор адреса %q: %w", addr, err)
	}
	return "http://" + net.JoinHostPort("localhost", port) + path, nil
}
