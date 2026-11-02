const test = require('node:test');
const assert = require('node:assert/strict');
const { slugBase, slugCandidates, assignPublisherSlug } = require('../src/publisherSlug');

test('slugBase: accents removed, punctuation to dashes (same rule as migration 016)', () => {
  assert.equal(slugBase('Tuổi Trẻ', 'tuoitre.vn'), 'tuoi-tre');
  assert.equal(slugBase("Diari d'Andorra", 'diariandorra.ad'), 'diari-d-andorra');
  assert.equal(slugBase('Réalités Sénégal', 'realites-senegal.sn'), 'realites-senegal');
  assert.equal(slugBase('Novinite (Sofia News Agency)', 'novinite.com'), 'novinite-sofia-news-agency');
  assert.equal(slugBase('  --Le Point Sur--  ', 'lepointsur.com'), 'le-point-sur');
});

test('slugBase: letters NFD does not decompose are mapped like the SQL translate()', () => {
  assert.equal(slugBase('Đà Nẵng Online', 'x.vn'), 'da-nang-online');
  assert.equal(slugBase('Østlendingen', 'x.no'), 'ostlendingen');
  assert.equal(slugBase('Głos Łodzi', 'x.pl'), 'glos-lodzi');
  assert.equal(slugBase('Straße Æble', 'x.de'), 'strase-able');
});

test('slugBase: no Latin letters in the name -> domain', () => {
  assert.equal(slugBase('صحة 24', 'seha24.net'), '24');
  assert.equal(slugBase('اليوم السابع', 'youm7.com'), 'youm7-com');
  assert.equal(slugBase('人民网', 'www.people.com.cn'), 'www-people-com-cn');
  assert.equal(slugBase('', ''), '');
});

test('slugCandidates: base, base-iso, base-id; 90 chars max', () => {
  assert.deepEqual(slugCandidates('efe', 'ES', 9631), ['efe', 'efe-es', 'efe-9631']);
  assert.deepEqual(slugCandidates('efe', null, 7), ['efe', 'efe-7']);
  assert.deepEqual(slugCandidates('', 'TM', 5), ['publisher-5', 'publisher-5-tm', 'publisher-5-5']);
  assert.ok(slugCandidates('a'.repeat(120), 'ZW', 1).every((s) => s.length <= 90));
});

// Minimal fake pg: publishers with slugs; UPDATE succeeds only when the candidate is free.
function fakeDb(rows) {
  return {
    async query(sql, params) {
      if (/^\s*SELECT/i.test(sql)) {
        const p = rows.find((r) => r.id === params[0]);
        return { rows: p ? [{ name: p.name, domain: p.domain, slug: p.slug, iso_code: p.iso }] : [] };
      }
      const [id, slug] = params;
      const me = rows.find((r) => r.id === id);
      if (!me || me.slug || rows.some((r) => r.slug === slug && r.id !== id)) return { rowCount: 0 };
      me.slug = slug;
      return { rowCount: 1 };
    },
  };
}

test('assignPublisherSlug: free base is used', async () => {
  const db = fakeDb([{ id: 1, name: 'Kazinform', domain: 'qazinform.com', slug: null, iso: 'KZ' }]);
  assert.equal(await assignPublisherSlug(db, 1), 'kazinform');
});

test('assignPublisherSlug: collisions fall through to -iso then -id', async () => {
  const db = fakeDb([
    { id: 1, name: 'Daily News', domain: 'a.com', slug: 'daily-news', iso: 'EG' },
    { id: 2, name: 'Daily News', domain: 'b.com', slug: null, iso: 'TZ' },
    { id: 3, name: 'Daily News', domain: 'c.com', slug: 'daily-news-lk', iso: 'LK' },
    { id: 4, name: 'Daily News', domain: 'd.com', slug: null, iso: 'LK' },
  ]);
  assert.equal(await assignPublisherSlug(db, 2), 'daily-news-tz');
  assert.equal(await assignPublisherSlug(db, 4), 'daily-news-4');
});

test('assignPublisherSlug: an existing slug is never changed', async () => {
  const db = fakeDb([{ id: 9, name: 'Renamed Paper', domain: 'x.com', slug: 'old-slug', iso: 'GH' }]);
  assert.equal(await assignPublisherSlug(db, 9), 'old-slug');
});

test('assignPublisherSlug: unknown publisher throws', async () => {
  await assert.rejects(assignPublisherSlug(fakeDb([]), 42), /not found/);
});
