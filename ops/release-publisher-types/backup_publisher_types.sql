\set ON_ERROR_STOP on
\copy (SELECT id, source_type FROM publishers ORDER BY id) TO '/tmp/ndp-backup/publisher_types_pre_round2.csv' WITH (FORMAT csv, HEADER true)
SELECT count(*) AS publishers FROM publishers;
