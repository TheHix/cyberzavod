-- Размер тела каждой записи: по сумме размеров держится общий потолок хранилища галерей.

-- +goose Up
-- DEFAULT 0 оставляет в силе вставки прежней версии API, пока она ещё работает при выкатке.
ALTER TABLE recordings ADD COLUMN body_bytes bigint NOT NULL DEFAULT 0;

UPDATE recordings SET body_bytes = octet_length(body::text);

-- +goose Down
ALTER TABLE recordings DROP COLUMN body_bytes;
