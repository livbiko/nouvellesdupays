# Build #196 rollback

1. Turn the allowlist off (the worker reads it on its next */5 run):

   ```sql
   UPDATE feeds SET parser_config = parser_config - 'only_authors' WHERE id = 1020;
   ```

2. Only if the deleted row is wanted back: it is saved as CSV between `===CSV-BEGIN===` and `===CSV-END===` in
   `recovery-points/<id>/build196-apply-output.txt` (first column `action`, then every `articles` column). Load it
   into a temp table with the same columns and `INSERT INTO articles SELECT <columns except action> FROM ...`.

3. Full restore: the recovery point's pg_dump on dr-rke2 (HIGH, needs a window).
