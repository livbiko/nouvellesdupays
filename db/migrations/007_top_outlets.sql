-- "À la une" featured strip (CountryPanel Actualités tab): a small,
-- curated set of a country's leading outlets get a horizontal strip of
-- their latest headline above the normal article list. Editorial
-- importance (circulation, reach) is a human curation call, not something
-- derivable from existing columns -- hence a flag + explicit ordering,
-- authored the same deliberate way as editorial_profiles rather than
-- inferred from feed activity or article volume.

ALTER TABLE publishers ADD COLUMN IF NOT EXISTS is_top_outlet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE publishers ADD COLUMN IF NOT EXISTS top_outlet_rank SMALLINT;

CREATE INDEX IF NOT EXISTS idx_publishers_top_outlet ON publishers (country_id, top_outlet_rank) WHERE is_top_outlet;
