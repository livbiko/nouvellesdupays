// CR-2026-11-17-01: no "latest video" lookup. It read YouTube's per-channel Atom feed (/feeds/videos.xml), which
// youtube.com/robots.txt disallows for every user agent (and which has answered 404 for most channels since 2026-10).
// latest_video stays in the response as null so the web and its types are unchanged: VideoSequence plays the
// channel's uploads playlist in the IFrame player instead. A latest video can come back from the official Data API
// (playlistItems) once the quota decision is made.
async function withLatestVideos(rows) {
  return rows.map((r) => ({ ...r, latest_video: null }));
}

module.exports = { withLatestVideos };
