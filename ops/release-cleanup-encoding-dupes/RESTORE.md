# Restore: encoding-duplicate clean-up (2026-11-06)
- Part 1 deleted rows: full rows as CSV between ===DELETED-ROWS-CSV-BEGIN/END=== in `part1-output.txt` (recovery point folder copy too). Restore with `\copy articles FROM 'rows.csv' WITH CSV HEADER` (same columns, ids kept).
- Part 2 old headlines: `id,headline` CSV between ===OLD-HEADLINES-CSV-BEGIN/END=== in `part2-output.txt`. Restore by loading into a temp table and `UPDATE articles a SET headline = t.headline FROM t WHERE a.id = t.id`.
- Full DB dump: recovery point `2026-11-06_00-17-18_before-clean-up-broken-accent-duplicates` (pg_restore needs a window).
