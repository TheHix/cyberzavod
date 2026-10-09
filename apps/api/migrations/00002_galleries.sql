-- Galleries: authors signed in through GitHub, and the session recordings they uploaded.

-- +goose Up
CREATE TABLE users (
    github_id bigint PRIMARY KEY,
    login text NOT NULL,
    gallery_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    -- Last change of the gallery: login, visibility, upload or deletion of a recording.
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- GitHub logins are case-insensitive, so gallery and badge addresses are case-insensitive too.
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
