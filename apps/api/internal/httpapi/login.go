package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
	"github.com/bysavelii/cyberzavod/apps/api/internal/session"
)

const (
	loginPath    = "/api/auth/github/login"
	callbackPath = "/api/auth/github/callback"

	// stateCookieName is the cookie with the sign-in state and return path; only on sign-in paths.
	stateCookieName = "cz_oauth_state"
	stateCookiePath = "/api/auth/github"
	// stateLifetime is how long to wait for the return from GitHub: plenty of time for the consent.
	stateLifetime = 10 * time.Minute
	// stateSeparator separates state and return path in the cookie: base64url never contains it.
	stateSeparator = "."

	// sessionCookieName is the cookie with the site sign-in session id.
	sessionCookieName = "cz_session"
	sessionCookiePath = "/"

	returnQueryParam   = "return"
	defaultReturnPath  = "/"
	maxReturnPathBytes = 512
	// loginResultParam and loginFailedValue are the mark in the return address by which the site
	// shows that sign-in failed.
	loginResultParam = "login"
	loginFailedValue = "failed"
)

// errSiteLoginUnavailable means sign-in on the site is not configured: no client_id or secret.
var errSiteLoginUnavailable = errors.New("вход на сайте не настроен")

// loginState is what the browser keeps in a cookie between leaving for GitHub and coming back.
type loginState struct {
	state      string
	returnPath string
}

// githubLogin sends the browser to the GitHub consent page, remembering in a cookie the state
// and the path to return to after sign-in.
func (a *api) githubLogin(w http.ResponseWriter, r *http.Request) {
	if a.deps.OAuth == nil {
		writeError(w, http.StatusServiceUnavailable, codeAuthUnavailable, "Вход через GitHub на этом сайте не настроен")
		return
	}

	state, err := session.RandomToken()
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	saved := loginState{state: state, returnPath: safeReturnPath(r.URL.Query().Get(returnQueryParam))}
	http.SetCookie(w, newCookie(stateCookieName, encodeLoginState(saved), stateCookiePath, stateLifetime))

	authorizeURL := a.deps.OAuth.AuthorizeURL(state, a.callbackURL())
	http.Redirect(w, r, authorizeURL, http.StatusFound)
}

// githubCallback receives the browser from GitHub: it checks state, finds the author by the code,
// opens a session and returns to the saved path.
func (a *api) githubCallback(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, expiredCookie(stateCookieName, stateCookiePath))

	returnPath, isConfirmed := confirmLogin(r)
	if !isConfirmed {
		redirectLoginFailed(w, r, returnPath)
		return
	}

	user, err := a.signIn(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		a.deps.Logger.WarnContext(r.Context(), "вход через GitHub не удался", "err", err)
		redirectLoginFailed(w, r, returnPath)
		return
	}

	token, err := a.openSession(r.Context(), user)
	if err != nil {
		a.deps.Logger.ErrorContext(r.Context(), "сессия не открылась", "err", err)
		redirectLoginFailed(w, r, returnPath)
		return
	}

	http.SetCookie(w, newCookie(sessionCookieName, token, sessionCookiePath, session.Lifetime))
	http.Redirect(w, r, returnPath, http.StatusFound)
}

// confirmLogin checks that the browser came back from GitHub with a code for a sign-in that started
// in this same browser: the state from the address matches the cookie. It returns the saved return
// path, even on failure, to bring the human back to the same page; without a cookie, the home page.
func confirmLogin(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(stateCookieName)
	if err != nil {
		return defaultReturnPath, false
	}

	saved, isDecoded := decodeLoginState(cookie.Value)
	if !isDecoded {
		return defaultReturnPath, false
	}

	query := r.URL.Query()
	isGranted := query.Get("error") == "" && query.Get("code") != ""
	isSameState := subtle.ConstantTimeCompare([]byte(query.Get("state")), []byte(saved.state)) == 1

	return saved.returnPath, isGranted && isSameState
}

// signIn exchanges the code for a GitHub token, finds its author and creates them in the store.
// The token does not live on: the session rests on its own identifier.
func (a *api) signIn(ctx context.Context, code string) (gallery.User, error) {
	if a.deps.OAuth == nil {
		return gallery.User{}, errSiteLoginUnavailable
	}

	token, err := a.deps.OAuth.ExchangeCode(ctx, code, a.callbackURL())
	if err != nil {
		return gallery.User{}, err
	}

	user, err := a.deps.Tokens.Verify(ctx, token)
	if err != nil {
		return gallery.User{}, fmt.Errorf("проверка токена после входа: %w", err)
	}

	if err := a.deps.Galleries.SaveUser(ctx, user); err != nil {
		return gallery.User{}, err
	}

	return user, nil
}

// openSession opens a session for the author and returns its identifier for the cookie.
func (a *api) openSession(ctx context.Context, user gallery.User) (string, error) {
	token, created, err := session.New(user.GitHubID, a.now())
	if err != nil {
		return "", err
	}

	if err := a.deps.Sessions.CreateSession(ctx, created); err != nil {
		return "", err
	}

	return token, nil
}

// logout closes the browser session. Without a session there is nothing to close: also 204.
func (a *api) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if !a.isTrustedOrigin(r) {
		writeForbiddenOrigin(w)
		return
	}

	if err := a.deps.Sessions.DeleteSession(r.Context(), session.HashToken(cookie.Value)); err != nil {
		a.failInternal(w, r, err)
		return
	}

	http.SetCookie(w, expiredCookie(sessionCookieName, sessionCookiePath))
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) callbackURL() string {
	return a.deps.PublicURL + callbackPath
}

func redirectLoginFailed(w http.ResponseWriter, r *http.Request, returnPath string) {
	http.Redirect(w, r, loginFailedURL(returnPath), http.StatusFound)
}

// loginFailedURL adds the failed sign-in mark to the return path. The path is already checked by
// safeReturnPath; if it still does not parse, the human lands on the home page with the mark.
func loginFailedURL(returnPath string) string {
	target, err := url.Parse(returnPath)
	if err != nil {
		target = &url.URL{Path: defaultReturnPath}
	}

	query := target.Query()
	query.Set(loginResultParam, loginFailedValue)
	target.RawQuery = query.Encode()

	return target.String()
}

// safeReturnPath keeps the return path only if it leads to this same site; otherwise "/".
// Backslash and control characters are forbidden because the browser turns "/\host"
// and "/\t/host" into "//host", the address of another site.
func safeReturnPath(path string) string {
	isRooted := strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "//")
	hasBackslash := strings.Contains(path, `\`)
	hasControl := strings.ContainsFunc(path, unicode.IsControl)
	isShort := len(path) <= maxReturnPathBytes
	isSafe := isRooted && !hasBackslash && !hasControl && isShort
	if !isSafe {
		return defaultReturnPath
	}

	return path
}

func encodeLoginState(saved loginState) string {
	return saved.state + stateSeparator + base64.RawURLEncoding.EncodeToString([]byte(saved.returnPath))
}

// decodeLoginState parses the sign-in cookie. The return path is checked again: the cookie
// came from the browser.
func decodeLoginState(value string) (loginState, bool) {
	state, encodedReturn, hasSeparator := strings.Cut(value, stateSeparator)
	returnPath, err := base64.RawURLEncoding.DecodeString(encodedReturn)
	isValid := hasSeparator && state != "" && err == nil
	if !isValid {
		return loginState{}, false
	}

	return loginState{state: state, returnPath: safeReturnPath(string(returnPath))}, true
}

// newCookie builds a sign-in cookie: inaccessible to scripts, HTTPS only, and not sent
// with cross-site requests except link navigations.
func newCookie(name, value, path string, lifetime time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		MaxAge:   int(lifetime.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

// expiredCookie builds a cookie that tells the browser to erase cookie name on path path.
func expiredCookie(name, path string) *http.Cookie {
	cookie := newCookie(name, "", path, 0)
	cookie.MaxAge = -1

	return cookie
}
