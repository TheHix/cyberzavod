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

	// stateCookieName — кука с state входа и путём возврата; живёт только на путях входа.
	stateCookieName = "cz_oauth_state"
	stateCookiePath = "/api/auth/github"
	// stateLifetime — сколько ждать возвращения с GitHub: на согласие хватает с запасом.
	stateLifetime = 10 * time.Minute
	// stateSeparator разделяет state и путь возврата в куке: в base64url его не бывает.
	stateSeparator = "."

	// sessionCookieName — кука с идентификатором сессии входа на сайте.
	sessionCookieName = "cz_session"
	sessionCookiePath = "/"

	returnQueryParam   = "return"
	defaultReturnPath  = "/"
	maxReturnPathBytes = 512
	// loginResultParam и loginFailedValue — отметка в адресе возврата, по которой сайт
	// показывает, что вход не удался.
	loginResultParam = "login"
	loginFailedValue = "failed"
)

// errSiteLoginUnavailable — вход на сайте не настроен: нет client_id или секрета.
var errSiteLoginUnavailable = errors.New("вход на сайте не настроен")

// loginState — то, что браузер держит в куке между уходом на GitHub и возвращением.
type loginState struct {
	state      string
	returnPath string
}

// githubLogin ведёт браузер на страницу согласия GitHub, запомнив в куке state и путь,
// куда вернуть после входа.
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

// githubCallback принимает браузер с GitHub: проверяет state, узнаёт автора по коду,
// открывает сессию и возвращает на сохранённый путь.
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

// confirmLogin проверяет, что браузер вернулся с GitHub с кодом на вход, который начался
// в нём же: state из адреса совпадает с кукой. Возвращает сохранённый путь возврата —
// и при неудаче, чтобы вернуть человека на ту же страницу; без куки — главную.
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

// signIn меняет код на токен GitHub, узнаёт по нему автора и заводит его в хранилище.
// Токен дальше не живёт: сессия держится на своём идентификаторе.
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

// openSession открывает сессию автора и возвращает её идентификатор для куки.
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

// logout закрывает сессию браузера. Без сессии отвечать нечего — тоже 204.
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

// loginFailedURL добавляет к пути возврата отметку о неудачном входе. Путь уже проверен
// safeReturnPath; если он всё же не разбирается, человек попадает на главную с отметкой.
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

// safeReturnPath оставляет путь возврата, только если он ведёт на этот же сайт; иначе — "/".
// Обратная косая и управляющие символы запрещены, потому что браузер превращает "/\host"
// и "/\t/host" в "//host" — адрес чужого сайта.
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

// decodeLoginState разбирает куку входа. Путь возврата проверяется заново: кука пришла
// от браузера.
func decodeLoginState(value string) (loginState, bool) {
	state, encodedReturn, hasSeparator := strings.Cut(value, stateSeparator)
	returnPath, err := base64.RawURLEncoding.DecodeString(encodedReturn)
	isValid := hasSeparator && state != "" && err == nil
	if !isValid {
		return loginState{}, false
	}

	return loginState{state: state, returnPath: safeReturnPath(string(returnPath))}, true
}

// newCookie собирает куку входа: недоступна скриптам, только по HTTPS и не уходит
// с межсайтовыми запросами, кроме переходов по ссылке.
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

// expiredCookie собирает куку, которая велит браузеру стереть куку name на пути path.
func expiredCookie(name, path string) *http.Cookie {
	cookie := newCookie(name, "", path, 0)
	cookie.MaxAge = -1

	return cookie
}
