-- Build #229: owner decision 11-11 - keep the 18 media-brand candidates, typed creator_kind 'media_brand'.
-- Status stays 'candidate' (approval stays in /admin/creators). Guard: id + exact name + candidate + not yet media_brand.
-- Expected: UPDATE 18; candidates = 18 media_brand + 16 individual.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name) AS (VALUES
  (28, '2stvsenegal'), (24, 'Dakar Matin'), (23, 'DAKAR PLUS'), (29, 'RTS2 Sénégal'), (25, 'AMINE TV DAKAR'),
  (26, 'Le Journal de Dakar'), (27, 'Dakar En Ligne'), (30, 'Grand Place Sénégal'),
  (47, 'Tuko / Tuco - Kenya'), (46, 'Kenya News Alerts TV'), (39, 'Metropol TV Kenya'), (44, 'Nation FM Kenya'),
  (48, 'Gukena FM Kenya'), (6, 'Refresh Nigeria'), (9, 'WebTV Nigeria'), (8, 'News Agency of Nigeria'),
  (17, 'ABN GHANA ( Angel Broadcasting Network )'), (22, 'Ghana''s Most Beautiful Official'))
UPDATE creators c SET creator_kind = 'media_brand', updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Marque média (propriétaire, 2026-11-11, ancien type : ' || c.creator_kind || ')'
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate' AND c.creator_kind <> 'media_brand';
SELECT review_status, creator_kind, count(*) FROM creators GROUP BY 1, 2 ORDER BY 1, 2;
COMMIT;
