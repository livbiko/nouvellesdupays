-- Build #238: owner decision 11-12 - keep 87 (AlQahera News) and 97 (NRJ Egypt) as media brands (creator_kind
-- 'media_brand', status stays candidate), reject 92 (Egypt kedakeda fans: 22 videos, purpose unclear).
-- Guards: id + exact name + candidate (+ not yet media_brand). Expected: UPDATE 2, UPDATE 1; rejected 32 -> 33.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name) AS (VALUES (87, 'AlQahera News -  القاهرة الإخبارية'), (97, 'NRJ Egypt'))
UPDATE creators c SET creator_kind = 'media_brand', updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Marque média (propriétaire, 2026-11-12, ancien type : ' || c.creator_kind || ')'
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate' AND c.creator_kind <> 'media_brand';
UPDATE creators c SET review_status = 'rejected', approved_at = NULL, updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Rejeté par le propriétaire le 2026-11-12 (objet incertain)'
 WHERE c.id = 92 AND c.display_name = ' Egypt kedakeda fanś' AND c.review_status = 'candidate';
SELECT review_status, creator_kind, count(*) FROM creators GROUP BY 1, 2 ORDER BY 1, 2;
SELECT id, review_status, creator_kind, reviewer_note FROM creators WHERE id IN (87, 92, 97) ORDER BY id;
COMMIT;
