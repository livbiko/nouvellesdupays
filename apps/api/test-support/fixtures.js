// Fixture setup/teardown for the API test suite. Runs against a dedicated
// local database (nouvellesdupays_test), never the dev or production DB --
// DATABASE_URL must be set to that test DB before running (see package.json
// "test" script). Truncates and reseeds a small, deterministic fixture set
// on every run rather than relying on the full 190-country dataset.
const { getPool } = require('@nouvellesdupays/shared/src/db');

async function resetFixtures() {
  const pool = getPool();

  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) {
    throw new Error(
      'Refusing to run: DATABASE_URL does not point at nouvellesdupays_test. ' +
      'Tests truncate tables and must never run against dev or production data.'
    );
  }

  await pool.query('TRUNCATE articles, feeds, publishers, countries RESTART IDENTITY CASCADE');

  const { rows: countries } = await pool.query(
    `INSERT INTO countries (iso_code, name, region, capital, population, languages, timezone, flag_url, lat, lng)
     VALUES
       ('CI', 'Côte d''Ivoire', 'West Africa', 'Yamoussoukro', 29000000, ARRAY['French'], 'Africa/Abidjan', 'https://flagcdn.com/w320/ci.png', 7.54, -5.5471),
       ('NG', 'Nigeria', 'West Africa', 'Abuja', 223800000, ARRAY['English'], 'Africa/Lagos', 'https://flagcdn.com/w320/ng.png', 9.0765, 7.3986)
     RETURNING id, iso_code`
  );
  const ci = countries.find((c) => c.iso_code === 'CI').id;
  const ng = countries.find((c) => c.iso_code === 'NG').id;

  const { rows: publishers } = await pool.query(
    `INSERT INTO publishers (country_id, name, homepage_url, domain, feed_status, language)
     VALUES
       ($1, 'Test Publisher CI', 'https://example.com/ci', 'example.com/ci', 'active', 'fr'),
       ($2, 'Test Publisher NG', 'https://example.com/ng', 'example.com/ng', 'active', 'en')
     RETURNING id, country_id`,
    [ci, ng]
  );
  const pubCi = publishers.find((p) => p.country_id === ci).id;
  const pubNg = publishers.find((p) => p.country_id === ng).id;

  const { rows: feeds } = await pool.query(
    `INSERT INTO feeds (publisher_id, feed_url)
     VALUES ($1, 'https://example.com/ci/feed'), ($2, 'https://example.com/ng/feed')
     RETURNING id, publisher_id`,
    [pubCi, pubNg]
  );
  const feedCi = feeds.find((f) => f.publisher_id === pubCi).id;
  const feedNg = feeds.find((f) => f.publisher_id === pubNg).id;

  await pool.query(
    `INSERT INTO articles (feed_id, publisher_id, country_id, headline, summary, original_url, category, published_at, dedup_hash)
     VALUES
       ($1, $3, $5, 'CI Article One', 'summary one', 'https://example.com/ci/1', 'politics', now() - interval '1 hour', 'ci-hash-1'),
       ($1, $3, $5, 'CI Article Two', 'summary two', 'https://example.com/ci/2', 'sports', now() - interval '2 hours', 'ci-hash-2'),
       ($2, $4, $6, 'NG Article One', 'summary three', 'https://example.com/ng/1', 'other', now() - interval '1 hour', 'ng-hash-1')`,
    [feedCi, feedNg, pubCi, pubNg, ci, ng]
  );

  return { countryIds: { ci, ng }, publisherIds: { pubCi, pubNg } };
}

module.exports = { resetFixtures };
