// Package migrations хранит SQL-миграции и вшивает их в бинарник API.
// Новая миграция — новый файл NNNNN_описание.sql с секциями goose Up и Down.
package migrations

import "embed"

// FS — SQL-миграции, вшитые в бинарник.
//
//go:embed *.sql
var FS embed.FS
