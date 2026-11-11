-- Reverse Build #222 (after deleting CronJob nouvellesdupays-robots-check): turn back on feeds the job turned off
-- after the release (marked robots_blocked after 2026-11-11 11:00 UTC, not the 4 Build #220 feeds), and turn off
-- again feeds it turned back on (robots_cleared). Review the SELECT before COMMIT if anything is listed.
\set ON_ERROR_STOP on
BEGIN;
SELECT id, enabled, last_status, last_error_at FROM feeds WHERE last_status IN ('robots_blocked', 'robots_cleared') ORDER BY id;
UPDATE feeds SET enabled = true, last_status = NULL
  WHERE last_status = 'robots_blocked' AND NOT enabled AND id NOT IN (268, 627, 967, 1064);
UPDATE feeds SET enabled = false, last_status = 'robots_blocked' WHERE last_status = 'robots_cleared' AND enabled;
COMMIT;
