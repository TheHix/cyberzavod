// Package config читает настройки API из переменных окружения.
package config

import (
	"errors"
	"fmt"
	"net"
	"os"
)

const defaultAddr = ":8080"

// Config — настройки API, прочитанные из окружения.
type Config struct {
	// Addr — адрес, на котором слушает HTTP-сервер, например ":8080".
	Addr string
	// DatabaseURL — строка подключения к Postgres.
	DatabaseURL string
}

// Load читает настройки из переменных окружения. DATABASE_URL обязателен.
func Load() (Config, error) {
	cfg := Config{
		Addr:        Addr(),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("не задана переменная DATABASE_URL")
	}
	return cfg, nil
}

// Addr возвращает адрес HTTP-сервера. Отдельно от Load, потому что healthcheck база не нужна.
func Addr() string {
	addr := os.Getenv("API_ADDR")
	if addr != "" {
		return addr
	}

	return defaultAddr
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
