package config

import "testing"

func TestLoad(t *testing.T) {
	tests := []struct {
		name     string
		addr     string
		dbURL    string
		wantAddr string
		wantErr  bool
	}{
		{"адрес по умолчанию", "", "postgres://x", ":8080", false},
		{"адрес из окружения", "127.0.0.1:9000", "postgres://x", "127.0.0.1:9000", false},
		{"без DATABASE_URL", ":8080", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("API_ADDR", tt.addr)
			t.Setenv("DATABASE_URL", tt.dbURL)

			cfg, err := Load()

			if (err != nil) != tt.wantErr {
				t.Fatalf("ошибка %v, ожидалась ошибка: %v", err, tt.wantErr)
			}
			if cfg.Addr != tt.wantAddr {
				t.Fatalf("Addr %q, ожидался %q", cfg.Addr, tt.wantAddr)
			}
		})
	}
}

func TestLoadGitHub(t *testing.T) {
	tests := []struct {
		name         string
		clientID     string
		apiURL       string
		wantClientID string
		wantAPIURL   string
	}{
		{"без входа через GitHub", "", "", "", "https://api.github.com"},
		{"client_id из окружения", "Iv1.test", "", "Iv1.test", "https://api.github.com"},
		{"адрес API из окружения", "", "http://127.0.0.1:9999", "", "http://127.0.0.1:9999"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("DATABASE_URL", "postgres://x")
			t.Setenv("GITHUB_CLIENT_ID", tt.clientID)
			t.Setenv("GITHUB_API_URL", tt.apiURL)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("ошибка %v", err)
			}
			if cfg.GitHubClientID != tt.wantClientID {
				t.Fatalf("GitHubClientID %q, ожидался %q", cfg.GitHubClientID, tt.wantClientID)
			}
			if cfg.GitHubAPIURL != tt.wantAPIURL {
				t.Fatalf("GitHubAPIURL %q, ожидался %q", cfg.GitHubAPIURL, tt.wantAPIURL)
			}
		})
	}
}

func TestLocalURL(t *testing.T) {
	tests := []struct {
		addr    string
		want    string
		wantErr bool
	}{
		{":8080", "http://localhost:8080/api/health", false},
		{"0.0.0.0:8080", "http://localhost:8080/api/health", false},
		{"127.0.0.1:9000", "http://localhost:9000/api/health", false},
		{"[::]:8080", "http://localhost:8080/api/health", false},
		{"8080", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.addr, func(t *testing.T) {
			got, err := LocalURL(tt.addr, "/api/health")

			if (err != nil) != tt.wantErr {
				t.Fatalf("ошибка %v, ожидалась ошибка: %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("получено %q, ожидалось %q", got, tt.want)
			}
		})
	}
}
