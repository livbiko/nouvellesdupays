-- Reverses Build #167: the 11 publishers back to active, the 7 extra feeds re-enabled. Feed error state was not changed.
\set ON_ERROR_STOP on
BEGIN;
UPDATE publishers SET feed_status = 'active' WHERE slug IN ('arab-news', 'baltic-times', 'cnc3', 'defimedia', 'el-pais-uy', 'err-ee', 'err-news',
  'information-dk', 'medias24', 'national-post', 'sloboden-pecat') AND feed_status = 'unavailable';
UPDATE feeds SET enabled = true WHERE id IN (9527, 9531, 9258, 9176, 9308, 9317, 9246);
COMMIT;
