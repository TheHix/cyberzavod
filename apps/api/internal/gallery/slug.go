package gallery

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

const (
	slugAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
	slugLength   = 12
)

// NewSlug issues a random secret link to a recording: slugLength characters [a-z0-9]
// from a cryptographic generator, so the link cannot be guessed.
func NewSlug() (string, error) {
	alphabetSize := big.NewInt(int64(len(slugAlphabet)))
	slug := make([]byte, slugLength)
	for position := range slug {
		index, err := rand.Int(rand.Reader, alphabetSize)
		if err != nil {
			return "", fmt.Errorf("случайная ссылка на запись: %w", err)
		}

		slug[position] = slugAlphabet[index.Int64()]
	}

	return string(slug), nil
}
