-- Build #226 apply: queries of the 10 queued YouTube discovery jobs (ids 40-49).
-- Only jobs still queued and still on the old queries change; nothing else.
BEGIN;
SET LOCAL lock_timeout = '5s';
WITH t(iso, q) AS (VALUES
  ('RW', '["Kigali", "Rwandan", "Rwanda"]'::jsonb),
  ('SO', '["Mogadishu", "Somali", "Hargeisa"]'::jsonb),
  ('SS', '["Juba", "South Sudanese", "South Sudan"]'::jsonb),
  ('SD', '["الخرطوم", "سوداني", "Sudan"]'::jsonb),
  ('TZ', '["Dar es Salaam", "Tanzania", "Bongo"]'::jsonb),
  ('UG', '["Kampala", "Ugandan", "Uganda"]'::jsonb),
  ('DZ', '["Alger", "algérien", "الجزائر"]'::jsonb),
  ('EG', '["القاهرة", "مصري", "Egypt"]'::jsonb),
  ('LY', '["طرابلس", "ليبي", "Libya"]'::jsonb),
  ('MA', '["Casablanca", "marocain", "المغرب"]'::jsonb))
UPDATE discovery_jobs j SET params = jsonb_set(j.params, '{queries}', t.q)
  FROM countries c, t
 WHERE j.id BETWEEN 40 AND 49 AND j.status = 'queued' AND c.id = j.country_id AND trim(c.iso_code) = t.iso
   AND j.params->'queries' = (SELECT q FROM (VALUES
  ('RW', '["Rwanda", "Kigali"]'::jsonb),
  ('SO', '["Somalia", "Mogadishu"]'::jsonb),
  ('SS', '["South Sudan", "Juba"]'::jsonb),
  ('SD', '["Sudan", "Khartoum"]'::jsonb),
  ('TZ', '["Tanzania", "Dodoma"]'::jsonb),
  ('UG', '["Uganda", "Kampala"]'::jsonb),
  ('DZ', '["Algeria", "Algiers"]'::jsonb),
  ('EG', '["Egypt", "Cairo"]'::jsonb),
  ('LY', '["Libya", "Tripoli"]'::jsonb),
  ('MA', '["Morocco", "Rabat"]'::jsonb)) o(iso, q) WHERE o.iso = t.iso);
SELECT j.id, c.iso_code, j.status, j.params->>'v' AS v, j.params->'queries' AS queries
  FROM discovery_jobs j JOIN countries c ON c.id = j.country_id WHERE j.id BETWEEN 40 AND 49 ORDER BY j.id;
COMMIT;
