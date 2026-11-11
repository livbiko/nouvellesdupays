-- Build #227: the same "suggested reject" note the worker now writes, on the 11 existing candidates it matches.
-- Only candidates whose note is still empty and whose name is the one checked on 11-11; status never changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(id, name, kind) AS (VALUES
  (12, 'Betano-The Next Titan Nigeria', 'paris sportifs'), (31, '1xbet sénégal', 'paris sportifs'),
  (18, 'Ghana Investment Promotion Authority', 'institution publique'), (20, 'Parliament of Ghana', 'institution publique'),
  (21, 'Visit Ghana', 'institution publique'), (34, 'Présidence Togolaise', 'institution publique'),
  (36, 'UN Mission in the Central African Republic - MINUSCA', 'institution publique'),
  (38, 'Office of the Prime Minister - Ethiopia', 'institution publique'),
  (41, 'OPPO Kenya', 'entreprise'), (45, 'Pam Golding Properties Kenya', 'entreprise'),
  (49, 'Corporate Staffing Services Kenya', 'entreprise'))
UPDATE creators c SET reviewer_note = 'Suggestion : rejeter (' || t.kind || ') - détecté sur le nom, à confirmer', updated_at = now()
  FROM t WHERE c.id = t.id AND c.display_name = t.name AND c.review_status = 'candidate' AND c.reviewer_note IS NULL;
SELECT id, display_name, review_status, reviewer_note FROM creators WHERE reviewer_note LIKE 'Suggestion : rejeter%' ORDER BY id;
COMMIT;
