// Package migrations stores SQL migrations and embeds them in the API binary.
// A new migration is a new file NNNNN_description.sql with goose Up and Down sections.
package migrations

import "embed"

// FS holds the SQL migrations embedded in the binary.
//
//go:embed *.sql
var FS embed.FS
