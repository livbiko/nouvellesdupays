-- Removes exactly the national_tv rows add_national_tv.sql inserted (none of
-- these 21 channels existed as national_tv before - the inserts are NOT EXISTS-guarded).
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM video_channels WHERE category = 'national_tv' AND youtube_channel_id IN ('UCY4OPgqs3SGZ9m-lUaPHHfA','UCE8NLIaNMwDy-LKUTcCU-5g','UCkBbxR5jbO6qXHkswmdKKJg','UClDOmbCeOYJ10g-D0K-aADA','UCVSdMOzC-V1baALMe5HaKiQ','UCTjGk6smzE1z4P_nI8dUqJw','UCLvNYrmd889CSKCRTJ6upmw','UCi5fZhV7tPitSjnhEHJirGA','UCXG4tODjjS58Rd-zkdRUGzg','UCQqwwww6kzwr1vcBn1Q5UEA','UCP96oGcCyOlgLTMD07cmv6A','UCpPhzhCfud9ctQSJJv4Kqlw','UCIezoDoTPTETVTc9HRC05xg','UCyavCS_0nMefzngu9AN3C8w','UCYwjVaOlm2D8SeQMokIAjhw','UCQhdHZkL2eOBu66gNMCawag','UCahkGh2kwtpnZQTtcJECxOQ','UCgWzoWsF7GFUIE7tiBK9xug','UCEtHh4-TrhA-4BYgoGyCONQ','UCaquwJdQ-Ud6f7upWUQjDPQ','UCyRvjnhiC0MOXWS-7COPtyQ');
SELECT count(*) AS national_tv_rows_left FROM video_channels WHERE category = 'national_tv';
COMMIT;
