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

// NewSlug выдаёт случайную секретную ссылку на запись: slugLength символов [a-z0-9]
// из криптографического генератора, чтобы ссылку нельзя было подобрать.
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
