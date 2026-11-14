-- Build #250: owner decision 11-14 on Group B (TV/radio/agency brands) - reject the 9 that are not news channels
-- (music/entertainment radio and TV, events, a pageant show, a political mobilisation channel). Same effect as the admin
-- page's reject (review_status, approved_at NULL) plus a note. Guarded by id + exact name + still 'candidate'.
-- Expected: UPDATE 9 (rehearsed 11-14 07:5x: rejected 33 -> 42, candidates 269 -> 260; reverse.sql restores notes exactly). 2STV (28) stays a candidate (owner's call pending).
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name, kind) AS (VALUES
  (29, 'RTS2 Sénégal', 'divertissement ; la RTS est une source à activer'),
  (6, 'Refresh Nigeria', 'mobilisation politique, pas de l''information'),
  (97, 'NRJ Egypt', 'radio musicale'), (23, 'DAKAR PLUS', 'musique et événementiel'),
  (27, 'Dakar En Ligne', 'musique et lifestyle'), (25, 'AMINE TV DAKAR', 'événementiel et religion'),
  (22, 'Ghana''s Most Beautiful Official', 'téléréalité'), (48, 'Gukena FM Kenya', 'radio de divertissement'),
  (44, 'Nation FM Kenya', 'radio musicale'))
UPDATE creators c SET review_status = 'rejected', approved_at = NULL, updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Rejeté par le propriétaire le 2026-11-14 (groupe B : ' || t.kind || ')'
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate';
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
SELECT id, display_name, review_status, reviewer_note FROM creators WHERE id IN (29, 6, 97, 23, 27, 25, 22, 48, 44, 28) ORDER BY id;
COMMIT;
