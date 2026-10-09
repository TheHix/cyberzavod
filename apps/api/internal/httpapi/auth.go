package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
	"github.com/bysavelii/cyberzavod/apps/api/internal/session"
)

const bearerScheme = "bearer"

// authorizedHandler is a handler that needs a signed-in author.
type authorizedHandler func(w http.ResponseWriter, r *http.Request, user gallery.User)

// githubAuth gives the CLI the client_id of the OAuth app for GitHub sign-in via device flow.
func (a *api) githubAuth(w http.ResponseWriter, _ *http.Request) {
	if a.deps.GitHubClientID == "" {
		writeError(w, http.StatusServiceUnavailable, codeAuthUnavailable, "Вход через GitHub на этом сервере не настроен")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"clientId": a.deps.GitHubClientID})
}

// authorized lets only a signed-in author through to next: by the GitHub token in the
// Authorization header (CLI) or, if there is no header, by the session cookie (site).
func (a *api) authorized(next authorizedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Responses carry author data: neither the browser nor proxies may store them.
		w.Header().Set("Cache-Control", "no-store")

		hasAuthorization := r.Header.Get("Authorization") != ""
		if hasAuthorization {
			a.authorizeByToken(w, r, next)
			return
		}

		a.authorizeBySession(w, r, next)
	}
}

// authorizeByToken lets in an author whose token GitHub accepted, and creates or updates
// them in the store: the GitHub login can change.
func (a *api) authorizeByToken(w http.ResponseWriter, r *http.Request, next authorizedHandler) {
	token, hasToken := bearerToken(r.Header.Get("Authorization"))
	if !hasToken {
		writeUnauthorized(w, "Нужен заголовок Authorization: Bearer <токен GitHub>")
		return
	}

	user, err := a.deps.Tokens.Verify(r.Context(), token)
	if errors.Is(err, gallery.ErrTokenRejected) {
		writeUnauthorized(w, "GitHub не принял токен, войдите заново")
		return
	}

	if err != nil {
		a.deps.Logger.WarnContext(r.Context(), "GitHub не проверил токен", "err", err)
		writeError(w, http.StatusBadGateway, codeGitHubUnavailable, "GitHub не ответил, попробуйте позже")
		return
	}

	if err := a.deps.Galleries.SaveUser(r.Context(), user); err != nil {
		a.failInternal(w, r, err)
		return
	}

	next(w, r, user)
}

// authorizeBySession lets in an author with a live session from the cookie. Changing requests by
// cookie are accepted only from the site's own pages: otherwise another site could forge them.
func (a *api) authorizeBySession(w http.ResponseWriter, r *http.Request, next authorizedHandler) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		writeUnauthorized(w, "Войдите через GitHub или передайте заголовок Authorization: Bearer <токен GitHub>")
		return
	}

	if !a.isTrustedOrigin(r) {
		writeForbiddenOrigin(w)
		return
	}

	user, err := a.deps.Sessions.SessionUser(r.Context(), session.HashToken(cookie.Value))
	if errors.Is(err, session.ErrNotFound) {
		http.SetCookie(w, expiredCookie(sessionCookieName, sessionCookiePath))
		writeUnauthorized(w, "Сессия истекла, войдите заново")
		return
	}

	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	next(w, r, user)
}

// isTrustedOrigin reports whether a cookie request may run: reads always, everything else
// only if Origin matches the site address.
func (a *api) isTrustedOrigin(r *http.Request) bool {
	isReading := r.Method == http.MethodGet || r.Method == http.MethodHead
	origin := r.Header.Get("Origin")
	isSiteOrigin := origin != "" && origin == a.deps.PublicURL

	return isReading || isSiteOrigin
}

// bearerToken extracts the token from an Authorization header of the form "Bearer <token>".
func bearerToken(header string) (string, bool) {
	scheme, credentials, hasSeparator := strings.Cut(header, " ")
	isBearer := hasSeparator && strings.EqualFold(scheme, bearerScheme)
	token := strings.TrimSpace(credentials)
	if !isBearer || token == "" {
		return "", false
	}

	return token, true
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, http.StatusUnauthorized, codeUnauthorized, message)
}

func writeForbiddenOrigin(w http.ResponseWriter) {
	writeError(w, http.StatusForbidden, codeForbiddenOrigin, "Запрос пришёл не со страницы сайта")
}
