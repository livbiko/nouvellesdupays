-- Reverses Build #258: cancels the targeted CI jobs that have not run. Candidates they already added stay candidates
-- (never public unless approved); reject them in /admin/creators if unwanted.
\set ON_ERROR_STOP on
BEGIN;
UPDATE discovery_jobs SET status = 'cancelled' WHERE idempotency_key LIKE 'youtube:discover:v3:CI:targeted-%:2026-11-15' AND status = 'queued';
SELECT id, status FROM discovery_jobs WHERE idempotency_key LIKE 'youtube:discover:v3:CI:targeted-%:2026-11-15' ORDER BY id;
COMMIT;
