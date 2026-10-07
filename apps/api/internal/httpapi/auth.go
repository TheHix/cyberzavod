package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const bearerScheme = "bearer"

// authorizedHandler — обработчик, которому нужен вошедший автор.
type authorizedHandler func(w http.ResponseWriter, r *http.Request, user gallery.User)

// githubAuth отдаёт CLI client_id OAuth-приложения для входа через GitHub по device flow.
func (a *api) githubAuth(w http.ResponseWriter, _ *http.Request) {
	if a.deps.GitHubClientID == "" {
		writeError(w, http.StatusServiceUnavailable, codeAuthUnavailable, "Вход через GitHub на этом сервере не настроен")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"clientId": a.deps.GitHubClientID})
}

// authorized пускает к next только автора с токеном, который принял GitHub, и заводит
// или обновляет его в хранилище: логин на GitHub могут сменить.
func (a *api) authorized(next authorizedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
}

// bearerToken достаёт токен из заголовка Authorization вида "Bearer <токен>".
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
