// Package github talks to GitHub: it verifies authors' tokens and exchanges site sign-in codes.
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
	// tokenCacheTTL is how long to remember GitHub's answer for a token: the CLI calls the API in
	// a series of requests, and each of them should not cost a request to GitHub.
	tokenCacheTTL = 10 * time.Minute
	// maxUserResponseBytes is well above a GET /user response; it guards against an endless body.
	maxUserResponseBytes = 1 << 20
	gitHubAPIVersion     = "2022-11-28"
	userAgent            = "cyberzavod-api"
)

// Verifier asks GitHub for the author by token and remembers the answer for tokenCacheTTL.
type Verifier struct {
	apiURL string
	client *http.Client
	cache  *tokenCache
}

// githubUser holds the needed fields of the GET /user response.
type githubUser struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}

// NewVerifier creates a token verifier against the GitHub API at apiURL.
func NewVerifier(apiURL string) *Verifier {
	return &Verifier{
		apiURL: strings.TrimSuffix(apiURL, "/"),
		client: &http.Client{},
		cache:  newTokenCache(tokenCacheTTL, time.Now),
	}
}

// Verify returns the author who owns the token. If GitHub rejected the token, it returns
// gallery.ErrTokenRejected; other errors mean GitHub did not give a proper answer.
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

// fetchUser asks GitHub whose token this is.
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
	// The body is already read or not needed: a close error changes nothing in the response.
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
