package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/bysavelii/cyberzavod/apps/api/internal/gallery"
)

// publicEventsSQL selects public galleries' recordings and all their session events. The server
// does not check the event format: whatever the recording holds is counted, and values of
// the wrong type are skipped.
const publicEventsSQL = `
	WITH public_recordings AS (
		SELECT r.owner_id, r.body
		FROM recordings r
		JOIN users u ON u.github_id = r.owner_id
		WHERE u.gallery_public
	), events AS (
		SELECT event
		FROM public_recordings
		CROSS JOIN LATERAL jsonb_array_elements(body -> 'data' -> 'events') AS event
	)`

// statsSnapshot makes all summary queries see the same database state.
var statsSnapshot = pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly}

// eventCount is how many events of one type fell on one field value.
type eventCount struct {
	Value string
	Count int
}

// Stats computes the summary of recordings in public galleries.
func (s *Store) Stats(ctx context.Context) (gallery.Stats, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	var stats gallery.Stats
	err := pgx.BeginTxFunc(ctx, s.pool, statsSnapshot, func(tx pgx.Tx) error {
		var err error
		stats, err = readStats(ctx, tx)

		return err
	})
	if err != nil {
		return gallery.Stats{}, fmt.Errorf("сводка по галереям: %w", err)
	}

	return stats, nil
}

func readStats(ctx context.Context, tx pgx.Tx) (gallery.Stats, error) {
	stats, err := readTotals(ctx, tx)
	if err != nil {
		return gallery.Stats{}, err
	}

	returns, err := countEventsBy(ctx, tx, "stage_fail", "stage")
	if err != nil {
		return gallery.Stats{}, err
	}

	interventions, err := countEventsBy(ctx, tx, "intervention", "reason")
	if err != nil {
		return gallery.Stats{}, err
	}

	stats.Returns = stageReturns(returns)
	stats.Interventions = reasonInterventions(interventions)

	return stats, nil
}

// readTotals counts recordings, authors, tokens and build outcomes.
func readTotals(ctx context.Context, tx pgx.Tx) (gallery.Stats, error) {
	var stats gallery.Stats
	err := tx.QueryRow(ctx, publicEventsSQL+`
		SELECT
			(SELECT count(*) FROM public_recordings),
			(SELECT count(DISTINCT owner_id) FROM public_recordings),
			(SELECT coalesce(sum(
				CASE WHEN jsonb_typeof(event -> 'tokens') = 'number'
					THEN (event ->> 'tokens')::numeric END
			), 0)::bigint FROM events WHERE event ->> 'type' = 'usage'),
			(SELECT count(*) FROM events
				WHERE event ->> 'type' = 'build_end' AND event -> 'ok' = 'true'::jsonb),
			(SELECT count(*) FROM events
				WHERE event ->> 'type' = 'build_end' AND event -> 'ok' = 'false'::jsonb)`,
	).Scan(&stats.Recordings, &stats.Authors, &stats.Tokens, &stats.Outcomes.OK, &stats.Outcomes.Failed)
	if err != nil {
		return gallery.Stats{}, fmt.Errorf("итоги по записям: %w", err)
	}

	return stats, nil
}

// countEventsBy counts events of type eventType by the values of field, most frequent first.
func countEventsBy(ctx context.Context, tx pgx.Tx, eventType, field string) ([]eventCount, error) {
	rows, err := tx.Query(ctx, publicEventsSQL+`
		SELECT event ->> $2::text AS value, count(*)
		FROM events
		WHERE event ->> 'type' = $1 AND event ->> $2::text IS NOT NULL
		GROUP BY value
		ORDER BY count(*) DESC, value`,
		eventType, field)
	if err != nil {
		return nil, fmt.Errorf("подсчёт событий %s: %w", eventType, err)
	}

	counts, err := pgx.CollectRows(rows, pgx.RowToStructByPos[eventCount])
	if err != nil {
		return nil, fmt.Errorf("подсчёт событий %s: %w", eventType, err)
	}

	return counts, nil
}

func stageReturns(counts []eventCount) []gallery.StageReturns {
	returns := make([]gallery.StageReturns, 0, len(counts))
	for _, count := range counts {
		returns = append(returns, gallery.StageReturns{Stage: count.Value, Count: count.Count})
	}

	return returns
}

func reasonInterventions(counts []eventCount) []gallery.ReasonInterventions {
	interventions := make([]gallery.ReasonInterventions, 0, len(counts))
	for _, count := range counts {
		interventions = append(interventions, gallery.ReasonInterventions{Reason: count.Value, Count: count.Count})
	}

	return interventions
}
