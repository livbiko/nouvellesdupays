SELECT cr.id, cr.review_status, cr.confidence, cr.creator_kind, c.iso_code, cr.publisher_id, cr.slug,
       (SELECT string_agg(CASE WHEN l.is_primary THEN '*' ELSE '' END || cc.slug, '+' ORDER BY l.is_primary DESC, cc.slug)
          FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id WHERE l.creator_id = cr.id) AS cats,
       (SELECT count(*) FROM creator_verifications v WHERE v.creator_id = cr.id AND v.evidence_kind = 'reviewer') AS rev_ev
  FROM creators cr LEFT JOIN countries c ON c.id = cr.country_id
 WHERE cr.id IN (47,87,46,17,8,39,9,30,26,140,227,226,191,170,206,193,28,3) ORDER BY cr.id;
SELECT c.iso_code, count(*) FROM creators cr JOIN countries c ON c.id = cr.country_id
 WHERE cr.review_status = 'approved' GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) FILTER (WHERE review_status='approved') approved, count(*) FILTER (WHERE review_status='candidate') candidates FROM creators;
