-- Schema starting point. No tables yet: build recordings live in the site's static files.
-- The migration makes the whole path work from the first deploy: goose → version table → API.

-- +goose Up
SELECT 1;

-- +goose Down
SELECT 1;
