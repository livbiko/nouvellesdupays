const { getPool } = require('../../packages/shared/src/db');
const { COUNTRIES, PUBLISHERS } = require('./data');

function domainFromUrl(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

async function main() {
  const pool = getPool();

  const countryIdByIso = {};
  for (const c of COUNTRIES) {
    const res = await pool.query(
      `INSERT INTO countries (iso_code, name, region, capital, population, languages, timezone, flag_url, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (iso_code) DO UPDATE SET
         name = EXCLUDED.name, region = EXCLUDED.region, capital = EXCLUDED.capital,
         population = EXCLUDED.population, languages = EXCLUDED.languages,
         timezone = EXCLUDED.timezone, flag_url = EXCLUDED.flag_url, lat = EXCLUDED.lat, lng = EXCLUDED.lng
       RETURNING id`,
      [c.iso_code, c.name, c.region, c.capital, c.population, c.languages, c.timezone, c.flag_url, c.lat, c.lng]
    );
    countryIdByIso[c.iso_code] = res.rows[0].id;
    console.log(`Country ${c.name} -> id ${res.rows[0].id}`);
  }

  for (const p of PUBLISHERS) {
    const countryId = countryIdByIso[p.country];
    const pubRes = await pool.query(
      `INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language)
       VALUES ($1,$2,$3,$4,'active',$5)
       ON CONFLICT (country_id, name) DO UPDATE SET
         homepage_url = EXCLUDED.homepage_url, domain = EXCLUDED.domain,
         feed_status = 'active', language = EXCLUDED.language
       RETURNING id`,
      [countryId, p.name, p.homepage_url, domainFromUrl(p.homepage_url), p.language]
    );
    const publisherId = pubRes.rows[0].id;

    await pool.query(
      `INSERT INTO feeds (publisher_id, feed_url, feed_type)
       VALUES ($1,$2,'rss')
       ON CONFLICT (feed_url) DO NOTHING`,
      [publisherId, p.feed_url]
    );
    console.log(`Publisher ${p.name} (${p.country}) -> id ${publisherId}, feed registered`);
  }

  console.log('Seed complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
