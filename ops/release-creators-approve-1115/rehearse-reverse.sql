-- Reverses Build #254 (owner 11-15: "A approved, B: 2STV yes, Pape Cheikh yes, rest no"): the 18 creators approved
-- through the admin API go back to candidate / REQUIRES_REVIEW with the kind, country, categories and publisher link
-- they had before (captured from GET /api/admin/creators/:id just before the change), and the 18 reviewer-decision
-- evidence rows (creator_verifications 10-27) are deleted.
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM creator_verifications WHERE id BETWEEN 10 AND 27 AND evidence_kind = 'reviewer'
   AND creator_id IN (47,87,46,17,8,39,9,30,26,140,227,226,191,170,206,193,28,3);
UPDATE creators SET review_status = 'candidate', approved_at = NULL, confidence = 'REQUIRES_REVIEW', updated_at = now()
 WHERE id IN (47,87,46,17,8,39,9,30,26,140,227,226,191,170,206,193,28,3);
UPDATE creators SET publisher_id = NULL WHERE id = 8;
UPDATE creators SET creator_kind = 'individual' WHERE id IN (227,226,191,170,206,193);
UPDATE creators SET country_id = NULL WHERE id = 170;
-- categories as they were (primary first)
CREATE TEMP TABLE prev_cats (creator_id int, slug text, is_primary boolean) ON COMMIT DROP;
INSERT INTO prev_cats VALUES
 (47,'social-issues',true),(47,'lifestyle',false),
 (39,'education',true),(39,'politics',false),(39,'social-issues',false),
 (9,'education',true),(9,'business-finance',false),(9,'social-issues',false),
 (30,'tv-radio',true),(30,'other-sports',false),(30,'social-issues',false),
 (26,'other-sports',true),(26,'football',false);
DELETE FROM creator_category_links WHERE creator_id IN (47,39,9,30,26);
INSERT INTO creator_category_links (creator_id, category_id, is_primary)
SELECT p.creator_id, cc.id, p.is_primary FROM prev_cats p JOIN creator_categories cc ON cc.slug = p.slug;
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
ROLLBACK;
