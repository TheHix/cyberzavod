-- Галереи: авторы, вошедшие через GitHub, и записи сессий, которые они загрузили.

-- +goose Up
CREATE TABLE users (
    github_id bigint PRIMARY KEY,
    login text NOT NULL,
    gallery_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- Последняя перемена галереи: логин, видимость, загрузка или удаление записи.
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Логин GitHub не различает регистр, поэтому и адрес галереи и бейджа его не различает.
CREATE UNIQUE INDEX users_login_key ON users (lower(login));

CREATE TABLE recordings (
    owner_id bigint NOT NULL REFERENCES users (github_id) ON DELETE CASCADE,
    record_id text NOT NULL,
    slug text NOT NULL UNIQUE,
    project_id text NOT NULL,
    title text NOT NULL,
    language text NOT NULL,
    started_at timestamptz NOT NULL,
    body jsonb NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, record_id)
);

-- +goose Down
DROP TABLE recordings;
DROP TABLE users;
