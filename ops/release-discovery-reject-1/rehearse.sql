-- Build #191 (MEDIUM): reject the 8 discovery candidates proposed for rejection in the Build #128 review (11-02).
-- Same as the admin PATCH /api/admin/discovered-sources/:id {status: 'rejected'}; the reason is prefixed to notes in
-- the existing "rejected <date>: <reason>" style. Owner: "reject the 8". rehearse.sql is this file with ROLLBACK.
\set ON_ERROR_STOP on
SET lock_timeout = '10s';
SET statement_timeout = '60s';
BEGIN;
CREATE TEMP TABLE tgt (id int PRIMARY KEY, domain text NOT NULL, reason text NOT NULL);
INSERT INTO tgt VALUES
  (601, 'euronews.com', 'pan-European outlet, filed under Congo (CG)'),
  (893, 'businessdailyafrica.com', 'Kenyan business paper, filed under Tanzania (TZ)'),
  (776, 'isoceltelecom.com', 'telecom company, not news'),
  (591, 'edita.com.eg', 'food company, not news'),
  (111, 'afp.com', 'feed stale since 2021'),
  (142, 'bns.ee', 'feed stale since 2019'),
  (653, 'afis.africa', 'conference platform, not news'),
  (584, 'visiongroup.co.ug', 'corporate site, feed stale');
\echo ===BEFORE===
SELECT ds.id, ds.status, ds.domain, left(ds.name, 40) FROM discovered_sources ds JOIN tgt t ON t.id = ds.id ORDER BY ds.id;
DO $do$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM discovered_sources ds JOIN tgt t ON t.id = ds.id AND t.domain = ds.domain WHERE ds.status = 'under_review';
  IF n <> 8 THEN RAISE EXCEPTION 'Expected 8 under_review candidates with matching domains, found % - nothing changed', n; END IF;
END $do$;
UPDATE discovered_sources ds SET status = 'rejected',
    notes = 'rejected 2026-11-07: ' || t.reason || coalesce(E'\n' || nullif(ds.notes, ''), ''), updated_at = now()
  FROM tgt t WHERE ds.id = t.id;
\echo ===AFTER===
SELECT ds.id, ds.status, ds.domain, left(ds.notes, 70) FROM discovered_sources ds JOIN tgt t ON t.id = ds.id ORDER BY ds.id;
ROLLBACK;
