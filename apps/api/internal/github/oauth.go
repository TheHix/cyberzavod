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
	// maxAccessTokenResponseBytes — с запасом больше ответа на обмен кода.
	maxAccessTokenResponseBytes = 1 << 16
)

// OAuthApp — OAuth-приложение GitHub для входа на сайте: ссылка на страницу согласия
// и обмен кода авторизации на токен.
type OAuthApp struct {
	oauthURL     string
	clientID     string
	clientSecret string
	client       *http.Client
}

// accessTokenResponse — нужные поля ответа на обмен кода. Отказ GitHub приходит с кодом 200
// и полем error.
type accessTokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
}

// NewOAuthApp создаёт OAuth-приложение с clientID и clientSecret на сервере GitHub по
// адресу oauthURL, например https://github.com.
func NewOAuthApp(oauthURL, clientID, clientSecret string) *OAuthApp {
	return &OAuthApp{
		oauthURL:     strings.TrimSuffix(oauthURL, "/"),
		clientID:     clientID,
		clientSecret: clientSecret,
		client:       &http.Client{},
	}
}

// AuthorizeURL возвращает адрес страницы согласия GitHub, откуда браузер вернётся на
// redirectURI с кодом и state. Без scope: публичного профиля хватает.
func (a *OAuthApp) AuthorizeURL(state, redirectURI string) string {
	query := url.Values{
		"client_id":    {a.clientID},
		"redirect_uri": {redirectURI},
		"state":        {state},
	}

	return a.oauthURL + authorizePath + "?" + query.Encode()
}

// ExchangeCode меняет код авторизации на токен GitHub. Ни код, ни секрет, ни токен не
// попадают в текст ошибки.
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
	// Тело уже прочитано или не нужно: ошибка закрытия ничего не меняет в ответе.
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

	// Поле error — код отказа из перечня GitHub (bad_verification_code и т. п.), не секрет.
	if exchanged.Error != "" {
		return "", fmt.Errorf("GitHub отказал в обмене кода: %s", exchanged.Error)
	}

	if exchanged.AccessToken == "" {
		return "", errors.New("в ответе GitHub на обмен кода нет токена")
	}

	return exchanged.AccessToken, nil
}
