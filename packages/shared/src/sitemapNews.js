const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({ ignoreAttributes: false });

// Parses a Google News Sitemap (the <news:news> extension to the standard
// sitemap protocol -- https://www.google.com/schemas/sitemap-news/0.9)
// into {title, link, publishedAt} items. Always returns an array (empty if
// nothing usable) -- only throws on genuine XML parse failure, matching
// how apps/worker/src/poll.js's RSS path treats "zero items" as a
// verification failure rather than an error.
//
// This is deliberately narrow: an entry only counts if it has a real
// <news:news><news:title> -- a plain sitemap.xml with no news markup at
// all parses fine as XML but yields zero items here, same outcome as an
// RSS feed with zero <item>s.
function parseSitemapNews(xml) {
  let doc;
  try {
    doc = xmlParser.parse(xml);
  } catch (err) {
    throw new Error(`Not valid XML: ${err.message}`);
  }

  const urlset = doc.urlset;
  if (!urlset || !urlset.url) return [];

  const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
  const items = [];
  for (const entry of urls) {
    const news = entry['news:news'];
    if (!news || !news['news:title'] || !entry.loc) continue;
    items.push({
      title: String(news['news:title']),
      link: String(entry.loc),
      publishedAt: news['news:publication_date'] ? String(news['news:publication_date']) : null,
    });
  }
  return items;
}

module.exports = { parseSitemapNews };
