package gallery

import (
	"regexp"
	"testing"
)

func TestNewSlug(t *testing.T) {
	slugPattern := regexp.MustCompile(`^[a-z0-9]{12}$`)

	first, firstErr := NewSlug()
	second, secondErr := NewSlug()

	if firstErr != nil || secondErr != nil {
		t.Fatalf("ошибки %v, %v", firstErr, secondErr)
	}
	if !slugPattern.MatchString(first) {
		t.Fatalf("ссылка %q не из 12 символов [a-z0-9]", first)
	}
	if first == second {
		t.Fatalf("две ссылки подряд совпали: %q", first)
	}
}
