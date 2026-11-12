-- Reverse: put jobs 40/41/43 back to their Build #241 due time (only while not yet run).
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE discovery_jobs SET next_run_at = '2026-11-12 14:15:28.425675+00' WHERE id IN (40, 41, 43) AND status = 'queued' AND attempts = 0;
COMMIT;
