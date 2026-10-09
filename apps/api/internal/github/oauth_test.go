package github

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

const (
	testClientID     = "Iv1.test"
	testClientSecret = "secret-test"
	testCode         = "code-test"
	testRedirectURI  = "https://cyberzavod.test/api/auth/github/callback"
)

// fakeAccessTokenEndpoint serves POST /login/oauth/access_token like GitHub: it answers with status
// and body only if the correct client_id, client_secret, code and redirect_uri arrived.
func fakeAccessTokenEndpoint(t *testing.T, status int, body string) *OAuthApp {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isExpected := r.Method == http.MethodPost && r.URL.Path == accessTokenPath &&
			r.Header.Get("Accept") == "application/json" &&
			r.PostFormValue("client_id") == testClientID &&
			r.PostFormValue("client_secret") == testClientSecret &&
			r.PostFormValue("code") == testCode &&
			r.PostFormValue("redirect_uri") == testRedirectURI
		if !isExpected {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	return NewOAuthApp(server.URL+"/", testClientID, testClientSecret)
}

func TestOAuthAppExchangeCode(t *testing.T) {
	tests := []struct {
		name      string
		status    int
		body      string
		wantToken string
		wantErr   bool
	}{
		{"токен", http.StatusOK, `{"access_token":"gho_new","token_type":"bearer","scope":""}`, "gho_new", false},
		{"неверный код", http.StatusOK, `{"error":"bad_verification_code"}`, "", true},
		{"нет токена", http.StatusOK, `{}`, "", true},
		{"не JSON", http.StatusOK, `<html>`, "", true},
		{"сбой GitHub", http.StatusInternalServerError, ``, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fakeAccessTokenEndpoint(t, tt.status, tt.body)

			token, err := app.ExchangeCode(t.Context(), testCode, testRedirectURI)

			if (err != nil) != tt.wantErr {
				t.Fatalf("ошибка %v, ожидалась ошибка: %v", err, tt.wantErr)
			}
			if token != tt.wantToken {
				t.Fatalf("токен %q, ожидался %q", token, tt.wantToken)
			}
			if err != nil && strings.Contains(err.Error(), testClientSecret) {
				t.Fatalf("секрет попал в ошибку: %v", err)
			}
		})
	}
}

func TestOAuthAppAuthorizeURL(t *testing.T) {
	app := NewOAuthApp("https://github.example/", testClientID, testClientSecret)

	authorize, err := url.Parse(app.AuthorizeURL("state-test", testRedirectURI))
	if err != nil {
		t.Fatalf("адрес не разобрался: %v", err)
	}

	query := authorize.Query()
	if authorize.Host != "github.example" || authorize.Path != authorizePath {
		t.Fatalf("адрес %s, ожидалась страница согласия github.example", authorize)
	}
	if query.Get("client_id") != testClientID || query.Get("state") != "state-test" || query.Get("redirect_uri") != testRedirectURI {
		t.Fatalf("параметры %v", query)
	}
	if query.Has("client_secret") || query.Has("scope") {
		t.Fatalf("в адресе лишнее: %v", query)
	}
}
