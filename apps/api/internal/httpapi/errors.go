package httpapi

import "net/http"

// Коды ошибок API: по ним клиент решает, что делать; message — для человека.
const (
	codeUnauthorized      = "unauthorized"
	codeForbiddenOrigin   = "forbidden_origin"
	codeAuthUnavailable   = "auth_unavailable"
	codeGitHubUnavailable = "github_unavailable"
	codeTooLarge          = "too_large"
	codeInvalidRecord     = "invalid_record"
	codeIDMismatch        = "id_mismatch"
	codeLimitReached      = "limit_reached"
	codeStorageFull       = "storage_full"
	codeTooManyRequests   = "too_many_requests"
	codeNotFound          = "not_found"
	codeInvalidRequest    = "invalid_request"
	codeInternal          = "internal"
)

// apiError — тело ответа с ошибкой.
type apiError struct {
	Code    string `json:"error"`
	Message string `json:"message"`
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, apiError{Code: code, Message: message})
}

func writeNotFound(w http.ResponseWriter, message string) {
	writeError(w, http.StatusNotFound, codeNotFound, message)
}

// failInternal пишет ошибку в журнал и отвечает 500, не раскрывая подробностей клиенту.
func (a *api) failInternal(w http.ResponseWriter, r *http.Request, err error) {
	a.deps.Logger.ErrorContext(r.Context(), "ошибка запроса", "route", r.Pattern, "err", err)
	writeError(w, http.StatusInternalServerError, codeInternal, "Внутренняя ошибка сервера, попробуйте позже")
}
