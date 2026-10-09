-- Body size of each recording: the shared gallery storage cap is enforced on the sum of sizes.

-- +goose Up
-- DEFAULT 0 keeps the previous API version's inserts valid while it still runs during rollout.
ALTER TABLE recordings ADD COLUMN body_bytes bigint NOT NULL DEFAULT 0;

UPDATE recordings SET body_bytes = octet_length(body::text);

-- +goose Down
ALTER TABLE recordings DROP COLUMN body_bytes;
