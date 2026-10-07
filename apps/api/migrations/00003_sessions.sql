-- Сессии входа на сайте: браузер держит случайный идентификатор в куке, в базе — только его sha256.

-- +goose Up
CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (github_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

-- Просроченные сессии удаляются при создании новой: индекс находит их без полного прохода.
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- +goose Down
DROP TABLE sessions;
