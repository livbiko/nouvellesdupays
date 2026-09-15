const Parser = require('rss-parser');

const parser = new Parser({ timeout: 8000 });
const USER_AGENT = 'NouvellesDuPaysBot/0.1 (+https://nouvellesdupays.com; video-channel latest-upload lookup)';

// YouTube exposes a public, keyless Atom feed per channel -- no API key,
// no quota, no cost (this is the "recent videos" approach chosen over the
// YouTube Data API's paid/quota-limited live-status lookup for phase 1;
// see the video-rail proposal thread). rss-parser normalizes Atom <entry>
// the same way it normalizes RSS <item>, so this is the same code path
// apps/worker already trusts for feed ingestion.
function youtubeFeedUrl(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

async function latestVideo(youtubeChannelId) {
  if (!youtubeChannelId) return null;
  try {
    const res = await fetch(youtubeFeedUrl(youtubeChannelId), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const parsed = await parser.parseString(await res.text());
    const item = (parsed.items || [])[0];
    if (!item) return null;
    return {
      title: item.title || null,
      url: item.link || null,
      published_at: item.isoDate || item.pubDate || null,
    };
  } catch {
    // A single unreachable/rate-limited channel must never break the whole
    // tab -- it just renders without a "latest video" line, same graceful-
    // degradation rule as editorial_tags being null for an unassessed publisher.
    return null;
  }
}

// Attaches latest_video to every row in parallel (Promise.allSettled, not
// Promise.all -- one slow/failed lookup must not delay or void the rest).
async function withLatestVideos(rows) {
  const results = await Promise.allSettled(
    rows.map((r) => (r.platform === 'youtube' ? latestVideo(r.youtube_channel_id) : Promise.resolve(null)))
  );
  return rows.map((r, i) => ({ ...r, latest_video: results[i].status === 'fulfilled' ? results[i].value : null }));
}

module.exports = { withLatestVideos };
