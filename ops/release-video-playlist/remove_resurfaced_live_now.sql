-- Removes 19 Live Now rows that still point at the wrong/dead YouTube channels
-- Build #25 removed or replaced at National TV level. They were invisible
-- then (the API hides a Live Now row when the same channel is the country's
-- National TV) and resurfaced once those National TV rows were gone.
-- Guarded: a row is deleted only if BOTH its id and its channel id match.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE resurfaced (id int, youtube_channel_id text);
INSERT INTO resurfaced VALUES
  (22, 'UCeuxaJ7_Nwurp_QzRtb0Z7w'),
  (40, 'UCLxXBaaQCvcTh-y1Zs-D0fg'),
  (47, 'UC2ECZNH-9vlzd0N4SgUoFiA'),
  (49, 'UC9O6ps0KkDc_7JpTbrYTraw'),
  (53, 'UCyN1Hc5TIXDFYUZwcrjhPzQ'),
  (61, 'UC2zqgQ95SesyZcaCRJR_Pkg'),
  (68, 'UCjDZRYl4upMQa-yx8S60qWQ'),
  (72, 'UCqGuHziHMf9mbBcyff-e8rw'),
  (77, 'UCbdsMND7bX8t8CCnAWtZIhg'),
  (79, 'UCo1iNgax_kAx6j4I9ZipoZQ'),
  (81, 'UCs-9OhU54pkXUPOtxI-UN8Q'),
  (85, 'UCUig12TPMw4hJc2TqUrDANQ'),
  (87, 'UCP4v6n3oC1B7D_8oAKUGcrg'),
  (93, 'UC6FwwsJhFb_jY1ZxYpqLpNQ'),
  (95, 'UCyUN85xQZceZMCTx7Fxb5RQ'),
  (103, 'UCXL0-ia1HOHHi7mjKC8uxkg'),
  (105, 'UCq1WXzBPUaUiJ60tMJ0lAsw'),
  (117, 'UCJZ8w7PB3YpxX0E9U3ooePw'),
  (124, 'UCxdnDDqiMLYJwG_HWWxzMsg');
DELETE FROM video_channels v USING resurfaced r
 WHERE v.id = r.id AND v.youtube_channel_id = r.youtube_channel_id AND v.category = 'live_now';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM video_channels v JOIN resurfaced r ON r.youtube_channel_id = v.youtube_channel_id
             WHERE v.category = 'live_now') THEN RAISE EXCEPTION 'resurfaced live_now rows remain'; END IF;
END $$;
SELECT count(*) AS live_now_rows_left FROM video_channels WHERE category = 'live_now';
COMMIT;
