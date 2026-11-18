-- CR-2026-11-18-07 reverse, CHANNELS ONLY: video_channel_category_links was EMPTY before the import (0 rows at
-- 11-18 ~23:25; the import at 23:26:12 wrote 320 rows for 212 channels), so undoing the channel part = removing every
-- row. Rehearsed 23:28 (DELETE 320, rolled back).
-- The 25 approved creators' categories were ALSO replaced at 23:26:12 and are NOT restored by this file: their
-- previous creator_category_links must come from a database dump taken before 23:26 (separate rollback CR).
-- After running: restart the API (directory cache) - kubectl -n nouvellesdupays rollout restart deploy/nouvellesdupays-api.
BEGIN;
DELETE FROM video_channel_category_links;
COMMIT;
