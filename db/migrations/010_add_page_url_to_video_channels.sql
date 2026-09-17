-- channel_url is the source the player actually loads (a YouTube channel
-- page for platform='youtube', or a raw HLS manifest for platform='streaming'
-- -- not something a person should be sent to by clicking the channel name).
-- page_url is optional and only for that click-through: the outlet's own
-- watch page, when there is a nicer one than channel_url to send a viewer to.
ALTER TABLE video_channels ADD COLUMN IF NOT EXISTS page_url TEXT;
