-- Build #228: owner decision 11-11 - reject 18 candidates (6 public institutions, 5 companies, 1 sports federation,
-- 2 betting, 4 religious). Same effect as the admin page's reject (review_status, approved_at NULL) plus a note.
-- Guarded by id + exact name + still 'candidate'. Expected: 18 rejected, 34 candidates.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name, kind) AS (VALUES
  (18, 'Ghana Investment Promotion Authority', 'institution publique'), (20, 'Parliament of Ghana', 'institution publique'),
  (21, 'Visit Ghana', 'institution publique'), (34, 'Présidence Togolaise', 'institution publique'),
  (36, 'UN Mission in the Central African Republic - MINUSCA', 'institution publique'),
  (38, 'Office of the Prime Minister - Ethiopia', 'institution publique'),
  (4, 'Dolidol Côte d''Ivoire', 'entreprise'), (11, 'Meristem Nigeria', 'entreprise'), (41, 'OPPO Kenya', 'entreprise'),
  (45, 'Pam Golding Properties Kenya', 'entreprise'), (49, 'Corporate Staffing Services Kenya', 'entreprise'),
  (35, 'Comunicação FCF', 'fédération sportive'),
  (12, 'Betano-The Next Titan Nigeria', 'paris sportifs'), (31, '1xbet sénégal', 'paris sportifs'),
  (37, 'ICC KINSHASA TV', 'religieux'), (50, 'AIC Milimani, Nairobi KE', 'religieux'),
  (51, 'ICC Nairobi Worship', 'religieux'), (52, 'MASJIDUL HIDAYA EASTLEIGH NAIROBI-KENYA', 'religieux'))
UPDATE creators c SET review_status = 'rejected', approved_at = NULL, updated_at = now(),
       reviewer_note = coalesce(c.reviewer_note || ' | ', '') || 'Rejeté par le propriétaire le 2026-11-11 (' || t.kind || ')'
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate';
SELECT review_status, count(*) FROM creators GROUP BY 1 ORDER BY 1;
SELECT id, display_name, review_status, reviewer_note FROM creators WHERE review_status = 'rejected' ORDER BY id;
COMMIT;
