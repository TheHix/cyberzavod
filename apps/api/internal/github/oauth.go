package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	authorizePath   = "/login/oauth/authorize"
	accessTokenPath = "/login/oauth/access_token"
	// maxAccessTokenResponseBytes is comfortably larger than the code exchange response.
	maxAccessTokenResponseBytes = 1 << 16
)

// OAuthApp is the GitHub OAuth app for sign-in on the site: a link to the consent page
// and the exchange of an authorization code for a token.
type OAuthApp struct {
	oauthURL     string
	clientID     string
	clientSecret string
	client       *http.Client
}

// accessTokenResponse holds the needed fields of the code exchange response. A GitHub refusal comes
// with code 200 and an error field.
type accessTokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
}

// NewOAuthApp creates an OAuth app with clientID and clientSecret on the GitHub server at
// oauthURL, for example https://github.com.
func NewOAuthApp(oauthURL, clientID, clientSecret string) *OAuthApp {
	return &OAuthApp{
		oauthURL:     strings.TrimSuffix(oauthURL, "/"),
		clientID:     clientID,
		clientSecret: clientSecret,
		client:       &http.Client{},
	}
}

// AuthorizeURL returns the address of the GitHub consent page, from which the browser returns to
// redirectURI with a code and state. No scope: the public profile is enough.
func (a *OAuthApp) AuthorizeURL(state, redirectURI string) string {
	query := url.Values{
		"client_id":    {a.clientID},
		"redirect_uri": {redirectURI},
		"state":        {state},
	}

	return a.oauthURL + authorizePath + "?" + query.Encode()
}

// ExchangeCode exchanges an authorization code for a GitHub token. Neither the code, the secret nor
// the token ends up in the error text.
func (a *OAuthApp) ExchangeCode(ctx context.Context, code, redirectURI string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()

	form := url.Values{
		"client_id":     {a.clientID},
		"client_secret": {a.clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, a.oauthURL+accessTokenPath, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("обмен кода GitHub: %w", err)
	}

	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", userAgent)

	response, err := a.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("обмен кода GitHub: %w", err)
	}
	// The body is already read or not needed: a close error changes nothing in the response.
	defer func() { _ = response.Body.Close() }()

	return accessTokenFromResponse(response)
}

func accessTokenFromResponse(response *http.Response) (string, error) {
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub ответил %d на обмен кода", response.StatusCode)
	}

	var exchanged accessTokenResponse
	body := io.LimitReader(response.Body, maxAccessTokenResponseBytes)
	if err := json.NewDecoder(body).Decode(&exchanged); err != nil {
		return "", fmt.Errorf("разбор ответа GitHub на обмен кода: %w", err)
	}

	// The error field is a GitHub refusal code (bad_verification_code and the like), not a secret.
	if exchanged.Error != "" {
		return "", fmt.Errorf("GitHub отказал в обмене кода: %s", exchanged.Error)
	}

	if exchanged.AccessToken == "" {
		return "", errors.New("в ответе GitHub на обмен кода нет токена")
	}

	return exchanged.AccessToken, nil
}
