-- Build #237: owner decision 11-12 - reject 14 of the candidates found 11-12 (2 YouTube auto-generated Topic channels,
-- 6 religious, 2 state/institutional, 2 schools, 2 companies). Same effect as the admin page's reject plus a note.
-- Guarded by id + exact name + still 'candidate'. Expected: 14 updated, rejected 18 -> 32.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name, kind) AS (VALUES
  (55, 'Diamond Platnumz - Topic', 'chaîne Topic générée par YouTube'),
  (107, 'Queen Naija - Topic', 'chaîne Topic générée par YouTube'),
  (56, 'KSIJ Dar es Salaam', 'religieux'),
  (61, 'Praise and Worship Uganda', 'religieux'),
  (62, 'Ugandan Catholics Online', 'religieux'),
  (63, 'Uganda Catholic Television', 'religieux'),
  (86, 'مسجد ال الرسول بغداد - حي القاهرة', 'religieux'),
  (90, 'قناة العلم والإيمان - الشيخ محمد مصري العاملي', 'religieux'),
  (78, 'المؤسسة العمومية للتلفزيون الجزائري', 'média d''État'),
  (83, 'أخبـــــار قطــــــاع التربيــــة فــي الجزائــــر', 'actualité institutionnelle, éducation'),
  (89, 'كلية التجارة-جامعة القاهرة', 'établissement d''enseignement'),
  (101, 'Université Mundiapolis de Casablanca', 'établissement d''enseignement'),
  (94, 'Loacker Egypt', 'entreprise'),
  (99, 'Almarai Egypt', 'entreprise'))
UPDATE creators c SET review_status = 'rejected', approved_at = NULL, updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Rejeté par le propriétaire le 2026-11-12 (' || t.kind || ')'
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate';
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
SELECT id, review_status, reviewer_note FROM creators WHERE reviewer_note LIKE '%le 2026-11-12 (%' ORDER BY id;
COMMIT;
