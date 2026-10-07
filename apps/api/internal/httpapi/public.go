package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/bysavelii/cyberzavod/apps/api/internal/badge"
	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

const (
	badgeSuffix = ".svg"
	// publicCacheControl — бейдж и сводку можно держать в кэше браузера и CDN пять минут:
	// они меняются редко, а показываются в чужих README и на каждой странице аналитики.
	publicCacheControl = "public, max-age=300"
)

type galleriesResponse struct {
	Galleries []gallery.Overview `json:"galleries"`
}

// galleries отдаёт список открытых галерей.
func (a *api) galleries(w http.ResponseWriter, r *http.Request) {
	overviews, err := a.deps.Galleries.PublicGalleries(r.Context())
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, galleriesResponse{Galleries: overviews})
}

// publicGallery отдаёт открытую галерею автора; закрытую не отличить от несуществующей.
func (a *api) publicGallery(w http.ResponseWriter, r *http.Request) {
	found, err := a.deps.Galleries.PublicGallery(r.Context(), r.PathValue("login"))
	if errors.Is(err, gallery.ErrNotFound) {
		writeNotFound(w, "Галереи нет или она закрыта")
		return
	}

	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, found)
}

// sharedRecording отдаёт запись по секретной ссылке, даже из закрытой галереи.
func (a *api) sharedRecording(w http.ResponseWriter, r *http.Request) {
	shared, err := a.deps.Galleries.SharedRecording(r.Context(), r.PathValue("slug"))
	if errors.Is(err, gallery.ErrNotFound) {
		writeNotFound(w, "Записи по этой ссылке нет")
		return
	}

	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, shared)
}

// badge отдаёт SVG-бейдж галереи по адресу /api/badges/<login>.svg. Закрытая и
// несуществующая галерея получают серый бейдж с кодом 200: картинка в README не ломается.
func (a *api) badge(w http.ResponseWriter, r *http.Request) {
	login, isSVG := strings.CutSuffix(r.PathValue("file"), badgeSuffix)
	if !isSVG || login == "" {
		writeNotFound(w, "Бейдж — по адресу /api/badges/<логин>.svg")
		return
	}

	svg, err := a.badgeImage(r.Context(), login)
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", publicCacheControl)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(svg))
}

// badgeImage рисует бейдж открытой галереи или, если её не нашли, серый «private».
func (a *api) badgeImage(ctx context.Context, login string) (string, error) {
	found, err := a.deps.Galleries.PublicGallery(ctx, login)
	if errors.Is(err, gallery.ErrNotFound) {
		return badge.Private(login), nil
	}

	if err != nil {
		return "", err
	}

	return badge.Builds(found.Login, len(found.Recordings)), nil
}

// stats отдаёт сводку по записям открытых галерей.
func (a *api) stats(w http.ResponseWriter, r *http.Request) {
	stats, err := a.deps.Galleries.Stats(r.Context())
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	w.Header().Set("Cache-Control", publicCacheControl)
	writeJSON(w, http.StatusOK, stats)
}
