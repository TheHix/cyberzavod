// Package github говорит с GitHub: проверяет токены авторов и меняет код входа на сайте на токен.
package github

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const (
	requestTimeout = 5 * time.Second
	// tokenCacheTTL — сколько помнить ответ GitHub на токен: CLI ходит в API серией запросов,
	// и каждый из них не должен стоить запроса к GitHub.
	tokenCacheTTL = 10 * time.Minute
	// maxUserResponseBytes — с запасом больше ответа GET /user; защищает от бесконечного тела.
	maxUserResponseBytes = 1 << 20
	gitHubAPIVersion     = "2022-11-28"
	userAgent            = "cyberzavod-api"
)

// Verifier узнаёт у GitHub автора по токену и помнит ответ tokenCacheTTL.
type Verifier struct {
	apiURL string
	client *http.Client
	cache  *tokenCache
}

// githubUser — нужные поля ответа GET /user.
type githubUser struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}

// NewVerifier создаёт проверку токенов у API GitHub по адресу apiURL.
func NewVerifier(apiURL string) *Verifier {
	return &Verifier{
		apiURL: strings.TrimSuffix(apiURL, "/"),
		client: &http.Client{},
		cache:  newTokenCache(tokenCacheTTL, time.Now),
	}
}

// Verify возвращает автора, которому принадлежит токен. Если GitHub токен не принял —
// gallery.ErrTokenRejected; другие ошибки значат, что GitHub не ответил толком.
func (v *Verifier) Verify(ctx context.Context, token string) (gallery.User, error) {
	key := sha256.Sum256([]byte(token))
	if user, isCached := v.cache.get(key); isCached {
		return user, nil
	}

	user, err := v.fetchUser(ctx, token)
	if err != nil {
		return gallery.User{}, err
	}

	v.cache.put(key, user)

	return user, nil
}

// fetchUser спрашивает GitHub, чей это токен.
func (v *Verifier) fetchUser(ctx context.Context, token string) (gallery.User, error) {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, v.apiURL+"/user", nil)
	if err != nil {
		return gallery.User{}, fmt.Errorf("запрос к GitHub: %w", err)
	}

	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", gitHubAPIVersion)
	request.Header.Set("User-Agent", userAgent)

	response, err := v.client.Do(request)
	if err != nil {
		return gallery.User{}, fmt.Errorf("запрос к GitHub: %w", err)
	}
	// Тело уже прочитано или не нужно: ошибка закрытия ничего не меняет в ответе.
	defer func() { _ = response.Body.Close() }()

	return userFromResponse(response)
}

func userFromResponse(response *http.Response) (gallery.User, error) {
	if response.StatusCode == http.StatusUnauthorized {
		return gallery.User{}, gallery.ErrTokenRejected
	}

	if response.StatusCode != http.StatusOK {
		return gallery.User{}, fmt.Errorf("GitHub ответил %d на GET /user", response.StatusCode)
	}

	var user githubUser
	body := io.LimitReader(response.Body, maxUserResponseBytes)
	if err := json.NewDecoder(body).Decode(&user); err != nil {
		return gallery.User{}, fmt.Errorf("разбор ответа GitHub: %w", err)
	}

	isComplete := user.ID > 0 && user.Login != ""
	if !isComplete {
		return gallery.User{}, errors.New("в ответе GitHub нет id или login")
	}

	return gallery.User{GitHubID: user.ID, Login: user.Login}, nil
}
