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
	// publicCacheControl lets browsers and CDNs cache the badge and the summary for five minutes:
	// they change rarely, but are shown in other people's READMEs and on every analytics page.
	publicCacheControl = "public, max-age=300"
)

type galleriesResponse struct {
	Galleries []gallery.Overview `json:"galleries"`
}

// galleries returns the list of public galleries.
func (a *api) galleries(w http.ResponseWriter, r *http.Request) {
	overviews, err := a.deps.Galleries.PublicGalleries(r.Context())
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, galleriesResponse{Galleries: overviews})
}

// publicGallery returns the author's public gallery; a private one looks like a missing one.
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

// sharedRecording returns a recording by its secret link, even from a private gallery.
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

// badge returns the gallery SVG badge at /api/badges/<login>.svg. A private and a
// nonexistent gallery get a grey badge with code 200: the image in a README does not break.
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

// badgeImage draws the badge of a public gallery or, if it was not found, a grey "private" one.
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

// stats returns the summary of recordings in public galleries.
func (a *api) stats(w http.ResponseWriter, r *http.Request) {
	stats, err := a.deps.Galleries.Stats(r.Context())
	if err != nil {
		a.failInternal(w, r, err)
		return
	}

	w.Header().Set("Cache-Control", publicCacheControl)
	writeJSON(w, http.StatusOK, stats)
}
