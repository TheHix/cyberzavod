package httpapi

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
	"github.com/bysavelii/cyberzavod/apps/api/internal/github"
	"github.com/bysavelii/cyberzavod/apps/api/internal/session"
)

const (
	testPublicURL    = "https://cyberzavod.test"
	foreignOrigin    = "https://evil.test"
	testClientSecret = "secret-test"
	grantedCode      = "code-granted"
	rejectedCode     = "code-rejected"
	// brokenCode is a code on whose exchange GitHub fails.
	brokenCode = "code-broken"
)

// fakeSessions is a session store without a database; err comes from CreateSession.
type fakeSessions struct {
	err      error
	sessions map[string]session.Session
}

func newFakeSessions() *fakeSessions {
	return &fakeSessions{sessions: map[string]session.Session{}}
}

func (f *fakeSessions) CreateSession(_ context.Context, created session.Session) error {
	if f.err != nil {
		return f.err
	}

	f.sessions[string(created.TokenHash)] = created

	return nil
}

func (f *fakeSessions) SessionUser(_ context.Context, tokenHash []byte) (gallery.User, error) {
	found, isFound := f.sessions[string(tokenHash)]
	isAlive := isFound && time.Now().Before(found.ExpiresAt)
	if !isAlive {
		return gallery.User{}, session.ErrNotFound
	}

	return gallery.User{GitHubID: found.UserID, Login: author.Login}, nil
}

func (f *fakeSessions) DeleteSession(_ context.Context, tokenHash []byte) error {
	delete(f.sessions, string(tokenHash))
	return nil
}

// open stores an author session that expires in expiresIn and returns its identifier.
func (f *fakeSessions) open(t *testing.T, expiresIn time.Duration) string {
	t.Helper()

	token, created, err := session.New(author.GitHubID, time.Now())
	if err != nil {
		t.Fatalf("новая сессия: %v", err)
	}

	created.ExpiresAt = time.Now().Add(expiresIn)
	f.sessions[string(created.TokenHash)] = created

	return token
}

// newFakeGitHubServer is GitHub for site sign-in: grantedCode is exchanged for the author's token,
// GitHub rejects rejectedCode and fails on brokenCode; GET /user finds the author by their token.
func newFakeGitHubServer(t *testing.T) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	mux.HandleFunc("POST /login/oauth/access_token", func(w http.ResponseWriter, r *http.Request) {
		switch r.PostFormValue("code") {
		case grantedCode:
			_, _ = w.Write([]byte(`{"access_token":"` + authorToken + `"}`))
		case brokenCode:
			w.WriteHeader(http.StatusInternalServerError)
		default:
			_, _ = w.Write([]byte(`{"error":"bad_verification_code"}`))
		}
	})
	mux.HandleFunc("GET /user", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+authorToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		_, _ = w.Write([]byte(`{"id":7,"login":"octocat"}`))
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)

	return server
}

// siteLoginHarness is the API with site sign-in on top of a fake GitHub; it logs to logs.
type siteLoginHarness struct {
	handler   http.Handler
	galleries *fakeGalleries
	sessions  *fakeSessions
	logs      *bytes.Buffer
}

// newSiteLoginHarness assembles the API; isLoginConfigured: client_id and secret are set.
func newSiteLoginHarness(t *testing.T, isLoginConfigured bool) siteLoginHarness {
	t.Helper()

	gitHub := newFakeGitHubServer(t)
	harness := siteLoginHarness{galleries: &fakeGalleries{}, sessions: newFakeSessions(), logs: &bytes.Buffer{}}
	deps := Deps{
		DB:        fakeDB{},
		Galleries: harness.galleries,
		Sessions:  harness.sessions,
		Tokens:    github.NewVerifier(gitHub.URL),
		PublicURL: testPublicURL,
		Logger:    slog.New(slog.NewTextHandler(harness.logs, nil)),
	}
	if isLoginConfigured {
		deps.OAuth = github.NewOAuthApp(gitHub.URL, testClientID, testClientSecret)
	}

	harness.handler = NewHandler(deps)

	return harness
}

// do runs a request through the API with cookies cookies.
func (h siteLoginHarness) do(t *testing.T, request *http.Request, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	h.handler.ServeHTTP(recorder, request)

	return recorder
}

// startLogin starts sign-in with return path returnPath and returns the state cookie and the
// state from the consent page address.
func (h siteLoginHarness) startLogin(t *testing.T, returnPath string) (*http.Cookie, string) {
	t.Helper()

	path := loginPath + "?" + url.Values{returnQueryParam: {returnPath}}.Encode()
	recorder := h.do(t, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
	if recorder.Code != http.StatusFound {
		t.Fatalf("вход: код %d, ожидался 302: %s", recorder.Code, recorder.Body)
	}

	authorize, err := url.Parse(recorder.Header().Get("Location"))
	if err != nil {
		t.Fatalf("адрес страницы согласия: %v", err)
	}

	return responseCookie(t, recorder, stateCookieName), authorize.Query().Get("state")
}

// responseCookie extracts cookie name from the response; no cookie fails the test.
func responseCookie(t *testing.T, recorder *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()

	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}

	t.Fatalf("в ответе нет куки %s: %v", name, recorder.Header().Values("Set-Cookie"))

	return nil
}

func hasResponseCookie(recorder *httptest.ResponseRecorder, name string) bool {
	for _, cookie := range recorder.Result().Cookies() {
		if cookie.Name == name && cookie.MaxAge >= 0 {
			return true
		}
	}

	return false
}

func TestGitHubLogin(t *testing.T) {
	harness := newSiteLoginHarness(t, true)

	recorder := harness.do(t, httptest.NewRequestWithContext(t.Context(), http.MethodGet, loginPath+"?return=/me/", nil))

	if recorder.Code != http.StatusFound {
		t.Fatalf("код %d, ожидался 302", recorder.Code)
	}
	authorize, err := url.Parse(recorder.Header().Get("Location"))
	if err != nil {
		t.Fatalf("адрес страницы согласия: %v", err)
	}
	query := authorize.Query()
	if authorize.Path != "/login/oauth/authorize" || query.Get("client_id") != testClientID {
		t.Fatalf("редирект на %s, ожидалась страница согласия", authorize)
	}
	if query.Get("redirect_uri") != testPublicURL+callbackPath {
		t.Fatalf("redirect_uri %q", query.Get("redirect_uri"))
	}
	cookie := responseCookie(t, recorder, stateCookieName)
	if !strings.HasPrefix(cookie.Value, query.Get("state")+stateSeparator) || query.Get("state") == "" {
		t.Fatalf("state в куке %q не совпадает со state в адресе %q", cookie.Value, query.Get("state"))
	}
	isProtected := cookie.HttpOnly && cookie.Secure && cookie.SameSite == http.SameSiteLaxMode
	if !isProtected || cookie.Path != stateCookiePath || cookie.MaxAge != 600 {
		t.Fatalf("кука state %+v", cookie)
	}
}

func TestGitHubLoginUnavailable(t *testing.T) {
	harness := newSiteLoginHarness(t, false)

	recorder := harness.do(t, httptest.NewRequestWithContext(t.Context(), http.MethodGet, loginPath, nil))

	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), codeAuthUnavailable) {
		t.Fatalf("код %d, ожидался 503 %s: %s", recorder.Code, codeAuthUnavailable, recorder.Body)
	}
}

func TestSafeReturnPath(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"/me/", "/me/"},
		{"/r/?id=k3f9&lang=en", "/r/?id=k3f9&lang=en"},
		{"", "/"},
		{"me", "/"},
		{"//evil.com", "/"},
		{"https://evil.com", "/"},
		{`/\evil.com`, "/"},
		{"/\t/evil.com", "/"},
		{"/\n/evil.com", "/"},
		{"/" + strings.Repeat("a", maxReturnPathBytes), "/"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := safeReturnPath(tt.path)

			if got != tt.want {
				t.Fatalf("путь %q, ожидался %q", got, tt.want)
			}
		})
	}
}

func TestGitHubCallback(t *testing.T) {
	tests := []struct {
		name          string
		returnPath    string
		code          string
		forgeState    bool
		withoutCookie bool
		gitHubError   string
		sessionErr    error
		isConfigured  bool
		wantLocation  string
		wantSession   bool
	}{
		{"успешный вход", "/me/?tab=1", grantedCode, false, false, "", nil, true, "/me/?tab=1", true},
		{"чужой путь возврата", "//evil.com", grantedCode, false, false, "", nil, true, "/", true},
		{"неверный state", "/me/", grantedCode, true, false, "", nil, true, "/me/?login=failed", false},
		{"нет куки state", "/me/", grantedCode, false, true, "", nil, true, "/?login=failed", false},
		{"нет кода", "/me/", "", false, false, "", nil, true, "/me/?login=failed", false},
		{"автор отказал на GitHub", "/me/", grantedCode, false, false, "access_denied", nil, true, "/me/?login=failed", false},
		{"GitHub отклонил код", "/me/", rejectedCode, false, false, "", nil, true, "/me/?login=failed", false},
		{"GitHub упал", "/me/", brokenCode, false, false, "", nil, true, "/me/?login=failed", false},
		{"сбой базы", "/me/", grantedCode, false, false, "", errors.New("база упала"), true, "/me/?login=failed", false},
		{"путь возврата с параметрами", "/ru/gallery/?user=alice", brokenCode, false, false, "", nil, true, "/ru/gallery/?login=failed&user=alice", false},
		{"вход не настроен", "/me/", grantedCode, false, false, "", nil, false, "/me/?login=failed", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newSiteLoginHarness(t, true)
			stateCookie, state := harness.startLogin(t, tt.returnPath)
			if !tt.isConfigured {
				harness = newSiteLoginHarness(t, false)
			}
			harness.sessions.err = tt.sessionErr
			if tt.forgeState {
				state = "forged"
			}
			query := url.Values{"code": {tt.code}, "state": {state}, "error": {tt.gitHubError}}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, callbackPath+"?"+query.Encode(), nil)
			if tt.withoutCookie {
				stateCookie = &http.Cookie{Name: "other", Value: "x"}
			}

			recorder := harness.do(t, request, stateCookie)

			if recorder.Code != http.StatusFound || recorder.Header().Get("Location") != tt.wantLocation {
				t.Fatalf("код %d на %q, ожидался 302 на %q", recorder.Code, recorder.Header().Get("Location"), tt.wantLocation)
			}
			if hasResponseCookie(recorder, sessionCookieName) != tt.wantSession {
				t.Fatalf("кука сессии выдана: %v, ожидалось %v", !tt.wantSession, tt.wantSession)
			}
			if cleared := responseCookie(t, recorder, stateCookieName); cleared.MaxAge >= 0 {
				t.Fatalf("кука state не стёрта: %+v", cleared)
			}
			for _, secret := range []string{tt.code, authorToken, testClientSecret} {
				if secret != "" && strings.Contains(harness.logs.String(), secret) {
					t.Fatalf("в журнал попало %q: %s", secret, harness.logs)
				}
			}
		})
	}
}

func TestGitHubCallbackOpensSession(t *testing.T) {
	harness := newSiteLoginHarness(t, true)
	stateCookie, state := harness.startLogin(t, "/me/")
	query := url.Values{"code": {grantedCode}, "state": {state}}
	callback := httptest.NewRequestWithContext(t.Context(), http.MethodGet, callbackPath+"?"+query.Encode(), nil)

	recorder := harness.do(t, callback, stateCookie)

	sessionCookie := responseCookie(t, recorder, sessionCookieName)
	isProtected := sessionCookie.HttpOnly && sessionCookie.Secure && sessionCookie.SameSite == http.SameSiteLaxMode
	if !isProtected || sessionCookie.Path != "/" || sessionCookie.MaxAge != int(session.Lifetime.Seconds()) {
		t.Fatalf("кука сессии %+v", sessionCookie)
	}
	if _, isStored := harness.sessions.sessions[string(session.HashToken(sessionCookie.Value))]; !isStored {
		t.Fatalf("в хранилище нет sha256 идентификатора из куки")
	}
	if len(harness.galleries.savedUsers) != 1 || harness.galleries.savedUsers[0] != author {
		t.Fatalf("заведены авторы %+v, ожидался %+v", harness.galleries.savedUsers, author)
	}
	me := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/me", nil)
	if code := harness.do(t, me, sessionCookie).Code; code != http.StatusOK {
		t.Fatalf("/api/me по куке после входа: код %d", code)
	}
}

// sessionRequest is a request to the API by session cookie or token.
type sessionRequest struct {
	method    string
	path      string
	body      string
	origin    string
	token     string
	expiresIn time.Duration
	isUnknown bool
}

func TestSessionAuthorization(t *testing.T) {
	galleryPath := "/api/me/gallery"
	recordingPath := "/api/me/recordings/abc"
	publicBody := `{"public":true}`
	tests := []struct {
		name    string
		request sessionRequest
		want    int
	}{
		{"галерея по куке", sessionRequest{method: http.MethodGet, path: "/api/me", expiresIn: time.Hour}, http.StatusOK},
		{"просроченная сессия", sessionRequest{method: http.MethodGet, path: "/api/me", expiresIn: -time.Minute}, http.StatusUnauthorized},
		{"неизвестная сессия", sessionRequest{method: http.MethodGet, path: "/api/me", isUnknown: true}, http.StatusUnauthorized},

		{"PUT по куке без Origin", sessionRequest{method: http.MethodPut, path: galleryPath, body: publicBody, expiresIn: time.Hour}, http.StatusForbidden},
		{"PUT по куке с чужим Origin", sessionRequest{http.MethodPut, galleryPath, publicBody, foreignOrigin, "", time.Hour, false}, http.StatusForbidden},
		{"PUT по куке со своим Origin", sessionRequest{http.MethodPut, galleryPath, publicBody, testPublicURL, "", time.Hour, false}, http.StatusOK},
		{"DELETE по куке без Origin", sessionRequest{method: http.MethodDelete, path: recordingPath, expiresIn: time.Hour}, http.StatusForbidden},
		{"DELETE по куке с чужим Origin", sessionRequest{method: http.MethodDelete, path: recordingPath, origin: foreignOrigin, expiresIn: time.Hour}, http.StatusForbidden},
		{"DELETE по куке со своим Origin", sessionRequest{method: http.MethodDelete, path: recordingPath, origin: testPublicURL, expiresIn: time.Hour}, http.StatusNoContent},
		{"выход по куке без Origin", sessionRequest{method: http.MethodPost, path: "/api/auth/logout", expiresIn: time.Hour}, http.StatusForbidden},
		{"выход по куке с чужим Origin", sessionRequest{method: http.MethodPost, path: "/api/auth/logout", origin: foreignOrigin, expiresIn: time.Hour}, http.StatusForbidden},
		{"выход по куке со своим Origin", sessionRequest{method: http.MethodPost, path: "/api/auth/logout", origin: testPublicURL, expiresIn: time.Hour}, http.StatusNoContent},

		{"Bearer без Origin", sessionRequest{method: http.MethodPut, path: galleryPath, body: publicBody, token: authorToken}, http.StatusOK},
		{"Bearer важнее куки", sessionRequest{method: http.MethodGet, path: "/api/me", token: rejectedToken, expiresIn: time.Hour}, http.StatusUnauthorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newSiteLoginHarness(t, true)
			sessionToken := harness.sessions.open(t, tt.request.expiresIn)
			if tt.request.isUnknown {
				sessionToken = "unknown"
			}
			request := httptest.NewRequestWithContext(t.Context(), tt.request.method, tt.request.path, strings.NewReader(tt.request.body))
			if tt.request.origin != "" {
				request.Header.Set("Origin", tt.request.origin)
			}
			if tt.request.token != "" {
				request.Header.Set("Authorization", "Bearer "+tt.request.token)
			}

			recorder := harness.do(t, request, &http.Cookie{Name: sessionCookieName, Value: sessionToken})

			if recorder.Code != tt.want {
				t.Fatalf("код %d, ожидался %d: %s", recorder.Code, tt.want, recorder.Body)
			}
		})
	}
}

func TestSessionAuthorizationHeaders(t *testing.T) {
	tests := []struct {
		name            string
		expiresIn       time.Duration
		wantCookieClear bool
	}{
		{"живая сессия", time.Hour, false},
		{"просроченная сессия стирает куку", -time.Minute, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			harness := newSiteLoginHarness(t, true)
			sessionCookie := &http.Cookie{Name: sessionCookieName, Value: harness.sessions.open(t, tt.expiresIn)}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/me", nil)

			recorder := harness.do(t, request, sessionCookie)

			if recorder.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("Cache-Control %q, ожидалось no-store", recorder.Header().Get("Cache-Control"))
			}
			isCleared := strings.Contains(recorder.Header().Get("Set-Cookie"), sessionCookieName+"=;")
			if isCleared != tt.wantCookieClear {
				t.Fatalf("кука стёрта: %v, ожидалось %v", isCleared, tt.wantCookieClear)
			}
		})
	}
}

func TestLogout(t *testing.T) {
	harness := newSiteLoginHarness(t, true)
	sessionCookie := &http.Cookie{Name: sessionCookieName, Value: harness.sessions.open(t, time.Hour)}
	logout := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/auth/logout", nil)
	logout.Header.Set("Origin", testPublicURL)

	recorder := harness.do(t, logout, sessionCookie)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("код %d, ожидался 204", recorder.Code)
	}
	if cleared := responseCookie(t, recorder, sessionCookieName); cleared.MaxAge >= 0 {
		t.Fatalf("кука сессии не стёрта: %+v", cleared)
	}
	if len(harness.sessions.sessions) != 0 {
		t.Fatalf("сессия осталась в хранилище")
	}
	me := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/me", nil)
	if code := harness.do(t, me, sessionCookie).Code; code != http.StatusUnauthorized {
		t.Fatalf("/api/me после выхода: код %d, ожидался 401", code)
	}
}

func TestLogoutWithoutSession(t *testing.T) {
	harness := newSiteLoginHarness(t, true)

	recorder := harness.do(t, httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/auth/logout", nil))

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("код %d, ожидался 204", recorder.Code)
	}
}
