// Creator directory agents (owner brief 2026-11-11; schema db/migrations/018_creators.sql).
//
// planDiscovery  - the 'global' agent: queues one YouTube discovery job per country, West Africa first (owner's
//                  priority countries at the head), then the rest of Africa, then the world; a country is searched
//                  again at most weekly.
// runYoutubeAgent - the 'youtube' agent: (1) refreshes the public statistics of creator YouTube accounts daily,
//                  (2) works through queued discovery jobs. Every API unit is counted against a rolling 24 h budget
//                  (discovery_agents.daily_quota_units) and logged in agent_runs.
//
// Both do nothing while their agent is paused (all start paused) and the YouTube agent needs YOUTUBE_API_KEY.
// What a run may and may not do:
//  - numbers come only from the YouTube Data API (audience_metrics source 'youtube_data_api'), never estimated;
//  - a channel found by search becomes a *candidate* creator (REQUIRES_REVIEW): nothing here approves, publishes or
//    marks an account verified - an API saying a channel exists is not evidence of who owns it;
//  - channels whose own declared country (snippet.country) is the searched country are kept under that country;
//    channels declaring another country are not, so a country's list is not filled with foreign channels that are
//    merely popular there;
//  - channels declaring no country (~75 % of search results, 11-11) are kept without a country, under the region of
//    the search and their language (owner decision 11-11, Build #223) - never approved without review.
const { slugBase, slugCandidates } = require('@nouvellesdupays/shared/src/publisherSlug');
const { normalizeSocialProfileUrl } = require('@nouvellesdupays/shared/src/discovery');

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const COST = { channels: 1, search: 100 };
// Phase order (brief section 3). Countries not listed are ordered by region below.
const PRIORITY_ISO = ['CI', 'NG', 'GH', 'SN', 'GN', 'ML', 'BF', 'BJ', 'TG'];
const REGION_ORDER = ['West Africa', 'Central Africa', 'East Africa', 'North Africa', 'Southern Africa'];
const RESEARCH_DAYS = 7;
const REFRESH_HOURS = 20;
// Search version 2 (Build #221). Version 1 searched each country without a query: YouTube then returns the channels
// most viewed *in* the country - global ones - and the own-country filter kept 3 of ~460 (first run, 11-11 07:25).
// Version 2 searches for the country itself, in its language. Jobs of an older version do not count as a recent
// search, so countries searched the old way are queued again.
// Version 3 (Build #223) keeps channels with no declared country, so countries searched by version 2 are searched
// again.
const SEARCH_VERSION = 3;
const MAX_QUERIES = 3;
// Terms that find a country's own creators: where they are (main city, which is not always the capital) and who
// they are (demonym), in the language they publish in. Other countries fall back to name and capital.
const COUNTRY_TERMS = {
  CI: ['Abidjan', 'ivoirien', "Côte d'Ivoire"], NG: ['Lagos', 'Nigerian', 'Naija'], GH: ['Accra', 'Ghanaian', 'Kumasi'],
  SN: ['Dakar', 'sénégalais', 'Sénégal'], GN: ['Conakry', 'guinéen', 'Guinée'], ML: ['Bamako', 'malien', 'Mali'],
  BF: ['Ouagadougou', 'burkinabè', 'Burkina'], BJ: ['Cotonou', 'béninois', 'Bénin'], TG: ['Lomé', 'togolais', 'Togo'],
  CV: ['Cabo Verde', 'cabo-verdiano', 'Praia'], CM: ['Douala', 'camerounais', 'Cameroun'], CD: ['Kinshasa', 'congolais', 'RDC'],
  // Build #226: the rest of Africa, so searches stop landing on official channels and capitals that are not the main city.
  NE: ['Niamey', 'nigérien', 'Niger'], MR: ['Nouakchott', 'mauritanien', 'Mauritanie'], GM: ['Banjul', 'Gambian', 'Gambia'],
  SL: ['Freetown', 'Salone', 'Sierra Leonean'], LR: ['Monrovia', 'Liberian', 'Liberia'], GW: ['Bissau', 'guineense', 'Guiné-Bissau'],
  GA: ['Libreville', 'gabonais', 'Gabon'], CG: ['Brazzaville', 'Congo-Brazza', 'congolais'], TD: ["N'Djamena", 'tchadien', 'Tchad'],
  CF: ['Bangui', 'centrafricain', 'Centrafrique'], GQ: ['Malabo', 'ecuatoguineano', 'Guinea Ecuatorial'],
  KE: ['Nairobi', 'Kenyan', 'Mombasa'], TZ: ['Dar es Salaam', 'Tanzania', 'Bongo'], UG: ['Kampala', 'Ugandan', 'Uganda'],
  RW: ['Kigali', 'Rwandan', 'Rwanda'], ET: ['Addis Ababa', 'Ethiopian', 'Ethiopia'], SO: ['Mogadishu', 'Somali', 'Hargeisa'],
  SS: ['Juba', 'South Sudanese', 'South Sudan'], BI: ['Bujumbura', 'burundais', 'Burundi'],
  MA: ['Casablanca', 'marocain', 'المغرب'], DZ: ['Alger', 'algérien', 'الجزائر'], TN: ['Tunis', 'tunisien', 'تونس'],
  EG: ['القاهرة', 'مصري', 'Egypt'], LY: ['طرابلس', 'ليبي', 'Libya'], SD: ['الخرطوم', 'سوداني', 'Sudan'],
  ZA: ['Johannesburg', 'South African', 'Cape Town'], ZM: ['Lusaka', 'Zambian', 'Zambia'], ZW: ['Harare', 'Zimbabwean', 'Zimbabwe'],
  MZ: ['Maputo', 'moçambicano', 'Moçambique'], AO: ['Luanda', 'angolano', 'Angola'], MG: ['Antananarivo', 'malagasy', 'Madagascar'],
};
// countries.languages holds English language names; YouTube's relevanceLanguage wants ISO 639-1.
const LANG_CODE = {
  French: 'fr', English: 'en', Portuguese: 'pt', Arabic: 'ar', Spanish: 'es', Swahili: 'sw', Hausa: 'ha', Yoruba: 'yo',
  Igbo: 'ig', Amharic: 'am', Wolof: 'wo', German: 'de', Italian: 'it', Russian: 'ru', Turkish: 'tr', Japanese: 'ja',
  Chinese: 'zh', Korean: 'ko', Hindi: 'hi', Indonesian: 'id', Dutch: 'nl', Persian: 'fa', Afrikaans: 'af', Somali: 'so',
};

// The discovery job's search plan for one country.
function searchPlan(country) {
  const queries = COUNTRY_TERMS[country.iso_code.trim()] || [country.name, country.capital].filter(Boolean);
  const language = (country.languages || []).map((l) => LANG_CODE[l]).find(Boolean) || null;
  return { v: SEARCH_VERSION, queries: [...new Set(queries)].slice(0, MAX_QUERIES), language, min_subscribers: 10000 };
}
// YouTube topic (Wikipedia article name) -> our category slug. A suggestion for the reviewer, never final.
const TOPIC_CATEGORY = {
  Music: 'music', Hip_hop_music: 'music', Pop_music: 'music', Humour: 'comedy', Entertainment: 'entertainment',
  Politics: 'politics', Society: 'social-issues', Sport: 'other-sports', Association_football: 'football',
  Basketball: 'basketball', Boxing: 'boxing-combat', Video_game_culture: 'gaming', Technology: 'technology',
  Food: 'food-cooking', Fashion: 'fashion', Physical_attractiveness: 'beauty', Tourism: 'travel',
  Religion: 'religion-spirituality', Television_program: 'tv-radio', Film: 'movies-cinema', Knowledge: 'education',
  Business: 'business-finance', 'Lifestyle_(sociology)': 'lifestyle', Health: 'personal-development',
};

class QuotaExhausted extends Error {}

// Minimal YouTube Data API client. Every call is charged to `budget` before it is made; the key is only ever in the
// request URL, never in a log line or an error message.
function youtubeClient(apiKey, fetchImpl, budget) {
  async function call(kind, params) {
    if (budget.used + COST[kind] > budget.limit) throw new QuotaExhausted(`quota budget reached (${budget.used}/${budget.limit})`);
    budget.used += COST[kind];
    const qs = new URLSearchParams({ ...params, key: apiKey });
    const res = await fetchImpl(`${API_BASE}/${kind}?${qs}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // quotaExceeded / dailyLimitExceeded: stop for this run, whatever our own budget says.
      if (res.status === 403 && /quota|dailyLimit/i.test(body)) throw new QuotaExhausted(`YouTube API quota exceeded (HTTP 403)`);
      throw new Error(`YouTube ${kind} HTTP ${res.status}: ${body.replace(/key=[^&\s"]+/g, 'key=***').slice(0, 200)}`);
    }
    return res.json();
  }
  return {
    channelsByIds: (ids) => call('channels', { part: 'snippet,statistics,topicDetails', id: ids.join(','), maxResults: '50' }),
    channelByHandle: (handle) => call('channels', { part: 'snippet,statistics,topicDetails', forHandle: handle }),
    searchChannels: (regionCode, q, pageToken, language) => call('search', {
      part: 'snippet', type: 'channel', regionCode, order: 'viewCount', maxResults: '50',
      ...(q ? { q } : {}), ...(language ? { relevanceLanguage: language } : {}), ...(pageToken ? { pageToken } : {}),
    }),
  };
}

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

async function saveChannel(db, accountId, item, now) {
  const s = item.snippet || {};
  await db.query(
    `UPDATE social_accounts SET platform_account_id = $2, handle = coalesce($3, handle), display_name = $4,
       profile_image_url = $5, status = 'active', last_checked_at = $6, updated_at = $6
     WHERE id = $1`,
    [accountId, item.id, (s.customUrl || '').replace(/^@/, '') || null, s.title || null,
      s.thumbnails?.default?.url || null, now]
  );
  const st = item.statistics || {};
  const metrics = [['subscribers', st.hiddenSubscriberCount ? null : num(st.subscriberCount)],
    ['total_views', num(st.viewCount)], ['video_count', num(st.videoCount)]];
  for (const [metric, value] of metrics) {
    if (value === null) continue; // hidden or missing: no row, never a guess
    await db.query(
      `INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at) VALUES ($1, $2, $3, 'youtube_data_api', $4)`,
      [accountId, metric, value, now]
    );
  }
}

// (1) Daily statistics for creator accounts that are not rejected or dead.
async function refreshCreatorAccounts(pool, yt, now, log) {
  const { rows } = await pool.query(
    `SELECT sa.id, sa.url, sa.handle, sa.platform_account_id
     FROM social_accounts sa JOIN creators cr ON cr.id = sa.creator_id
     WHERE sa.platform = 'youtube' AND sa.status <> 'dead' AND sa.verification <> 'rejected'
       AND cr.review_status IN ('candidate', 'approved')
       AND (sa.last_checked_at IS NULL OR sa.last_checked_at < $1::timestamptz - interval '${REFRESH_HOURS} hours')
     ORDER BY sa.last_checked_at NULLS FIRST LIMIT 500`, [now]);
  let updated = 0;
  let dead = 0;
  const byId = new Map();
  const byHandle = [];
  for (const a of rows) {
    const n = normalizeSocialProfileUrl('youtube', a.url);
    const id = a.platform_account_id || (n.ok && n.accountId);
    if (id) byId.set(id, a);
    else byHandle.push({ a, handle: a.handle || (n.ok && n.handle) });
  }
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await yt.channelsByIds(batch);
    const found = new Map((data.items || []).map((it) => [it.id, it]));
    for (const id of batch) {
      const acc = byId.get(id);
      if (found.has(id)) {
        await saveChannel(pool, acc.id, found.get(id), now);
        updated++;
      } else {
        await pool.query(`UPDATE social_accounts SET status = 'dead', last_checked_at = $2 WHERE id = $1`, [acc.id, now]);
        dead++;
      }
    }
  }
  for (const { a, handle } of byHandle) {
    if (!handle) {
      await pool.query(`UPDATE social_accounts SET last_checked_at = $2 WHERE id = $1`, [a.id, now]);
      log(`  account ${a.id}: no channel id or handle in ${a.url}`);
      continue;
    }
    const data = await yt.channelByHandle(handle);
    const item = data.items && data.items[0];
    if (item) {
      await saveChannel(pool, a.id, item, now);
      updated++;
    } else {
      await pool.query(`UPDATE social_accounts SET status = 'dead', last_checked_at = $2 WHERE id = $1`, [a.id, now]);
      dead++;
    }
  }
  return { updated, dead };
}

async function assignCreatorSlug(client, id, name, iso) {
  for (const slug of slugCandidates(slugBase(name, null) || `creator-${id}`, iso ? iso.toLowerCase() : null, id)) {
    const { rowCount } = await client.query(
      'UPDATE creators SET slug = $2 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM creators WHERE slug = $2 AND id <> $1)', [id, slug]);
    if (rowCount) return slug;
  }
  throw new Error(`No free slug for creator ${id}`);
}

// A channel from search -> candidate creator + account + first statistics. Skipped when the channel is already known
// (any owner: publisher, discovery candidate or creator), so a re-run never duplicates.
// `country` is null for a channel that declares none: it is then filed under `searched.region` and the search language.
async function addCandidate(pool, item, country, job, now, q, searched = country) {
  const url = `https://youtube.com/channel/${item.id}`;
  const { rows: known } = await pool.query(
    `SELECT 1 FROM social_accounts WHERE platform = 'youtube' AND (platform_account_id = $1
       OR regexp_replace(lower(rtrim(url, '/')), '^https?://(www\\.|m\\.)?', '') = lower($2)
       OR ($3::text IS NOT NULL AND lower(handle) = lower($3)))`,
    [item.id, url.replace(/^https:\/\//, ''), (item.snippet?.customUrl || '').replace(/^@/, '') || null]);
  if (known.length) return false;
  const s = item.snippet || {};
  const lang = /^[a-z]{2,3}/.exec((s.defaultLanguage || '').toLowerCase()) || (country ? null : /^[a-z]{2,3}/.exec(job.params.language || ''));
  const topics = (item.topicDetails?.topicCategories || []).map((u) => decodeURIComponent(u.split('/wiki/')[1] || ''));
  const categories = [...new Set(topics.map((t) => TOPIC_CATEGORY[t]).filter(Boolean))].slice(0, 3);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [cr] } = await client.query(
      `INSERT INTO creators (slug, display_name, country_id, region, languages, bio, discovered_from)
       VALUES ('pending-' || md5(random()::text), $1, $2, $3, $4, $5, $6) RETURNING id`,
      [String(s.title || item.id).slice(0, 200), country ? country.id : null, country ? null : searched.region || null,
        lang ? [lang[0]] : [], s.description ? String(s.description).slice(0, 1000) : null,
        `youtube agent: search ${searched.iso_code.trim()}${q ? ` "${q}"` : ''} (job ${job.id})${country ? '' : ' - country not declared'}`]);
    await assignCreatorSlug(client, cr.id, s.title || item.id, country ? country.iso_code : null);
    for (const [i, slug] of categories.entries()) {
      await client.query(
        `INSERT INTO creator_category_links (creator_id, category_id, is_primary)
         SELECT $1, id, $3 FROM creator_categories WHERE slug = $2`, [cr.id, slug, i === 0]);
    }
    const { rows: [sa] } = await client.query(
      `INSERT INTO social_accounts (creator_id, platform, url, platform_account_id, verification, discovered_from)
       VALUES ($1, 'youtube', $2, $3, 'unverified', 'youtube agent search') RETURNING id`, [cr.id, url, item.id]);
    await saveChannel(client, sa.id, item, now);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Why a channel from search was not added. Kept per job (discovery_jobs.result) so the search can be tuned from
// evidence: v1's 3-in-460 yield was only explainable after the fact.
// no_country counts channels without a declared country that were not added when the job ran before Build #223.
const REJECTIONS = ['no_country', 'foreign', 'hidden', 'small', 'known'];

// (2) One discovery job: for each query, search pages (checkpointed per query and page), then one channels.list per
// page for each channel's own country and statistics. Version-1 jobs (params.q, no queries) still run.
async function runDiscoverJob(pool, yt, job, now, log) {
  const { rows: [country] } = await pool.query('SELECT id, iso_code, name, region FROM countries WHERE id = $1', [job.country_id]);
  const iso = country.iso_code.trim();
  const queries = Array.isArray(job.params.queries) && job.params.queries.length ? job.params.queries.slice(0, MAX_QUERIES)
    : [job.params.q || null];
  const pages = Math.min(Number(job.params.pages) || 1, 5);
  const minSubs = Number(job.params.min_subscribers) || 10000;
  const cp = { qi: 0, page: 0, pageToken: null, seen: 0, added: 0, added_no_country: 0, ...(job.checkpoint || {}) };
  cp.added_no_country = cp.added_no_country || 0;
  // Version-1/2 jobs still skip channels without a declared country (their counts are compared against that rule).
  const keepNoCountry = Number(job.params.v) >= 3;
  cp.rejected = Object.fromEntries(REJECTIONS.map((r) => [r, (cp.rejected || {})[r] || 0]));
  while (cp.qi < queries.length) {
    const q = queries[cp.qi];
    const res = await yt.searchChannels(iso, q, cp.pageToken, job.params.language);
    const ids = [...new Set((res.items || []).map((r) => r.id?.channelId || r.snippet?.channelId).filter(Boolean))];
    if (ids.length) {
      const data = await yt.channelsByIds(ids);
      for (const item of data.items || []) {
        cp.seen++;
        const own = (item.snippet?.country || '').toUpperCase();
        const subs = item.statistics?.hiddenSubscriberCount ? null : num(item.statistics?.subscriberCount);
        const reason = !own && !keepNoCountry ? 'no_country' : own && own !== iso ? 'foreign'
          : subs === null ? 'hidden' : subs < minSubs ? 'small' : null;
        if (reason) cp.rejected[reason]++;
        else if (await addCandidate(pool, item, own ? country : null, job, now, q, country)) {
          cp.added++;
          if (!own) cp.added_no_country++;
        } else cp.rejected.known++;
      }
    }
    cp.page++;
    cp.pageToken = res.nextPageToken || null;
    if (!cp.pageToken || cp.page >= pages) {
      cp.qi++;
      cp.page = 0;
      cp.pageToken = null;
    }
    await pool.query('UPDATE discovery_jobs SET checkpoint = $2 WHERE id = $1', [job.id, cp]);
  }
  const r = cp.rejected;
  log(`  ${iso}: ${cp.seen} channel(s) checked, ${cp.added} new candidate(s) (${cp.added_no_country} without declared country); `
    + `not added: ${r.foreign} foreign, ${r.no_country} no country, `
    + `${r.small} under ${minSubs} subscribers, ${r.hidden} hidden count, ${r.known} already known`);
  return { ...cp, queries: queries.length };
}

async function claimJob(pool, workerId) {
  const { rows: [job] } = await pool.query(
    `UPDATE discovery_jobs SET status = 'running', locked_by = $1, locked_at = now(), started_at = coalesce(started_at, now()),
       attempts = attempts + 1
     WHERE id = (SELECT id FROM discovery_jobs WHERE agent = 'youtube' AND job_type = 'discover' AND status = 'queued'
                   AND next_run_at <= now() ORDER BY next_run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING *`, [workerId]);
  return job || null;
}

async function agentState(pool, agent) {
  const { rows: [a] } = await pool.query('SELECT * FROM discovery_agents WHERE agent = $1', [agent]);
  return a;
}

async function runYoutubeAgent(pool, { apiKey = process.env.YOUTUBE_API_KEY, fetchImpl = (...a) => fetch(...a), log = console.log,
  now = new Date(), workerId = `youtube-${process.pid}` } = {}) {
  const agent = await agentState(pool, 'youtube');
  if (!agent || agent.paused) return { skipped: 'paused' };
  if (!apiKey) return { skipped: 'no YOUTUBE_API_KEY' };

  // A job left 'running' by a killed pod is queued again (its checkpoint lets it resume where it stopped).
  await pool.query(
    `UPDATE discovery_jobs SET status = 'queued', locked_by = NULL WHERE agent = 'youtube' AND status = 'running'
       AND locked_at < now() - interval '30 minutes'`);
  const { rows: [{ used }] } = await pool.query(
    `SELECT coalesce(sum(quota_units), 0)::int AS used FROM agent_runs WHERE agent = 'youtube' AND started_at > $1::timestamptz - interval '24 hours'`,
    [now]);
  const budget = { used: 0, limit: Math.max(agent.daily_quota_units - used, 0) };
  if (budget.limit < COST.channels) return { skipped: `quota budget used (${used}/${agent.daily_quota_units} in 24 h)` };

  const { rows: [run] } = await pool.query(`INSERT INTO agent_runs (agent) VALUES ('youtube') RETURNING id`);
  const yt = youtubeClient(apiKey, fetchImpl, budget);
  const out = { refreshed: 0, dead: 0, jobs: 0, added: 0, seen: 0, stopped: null };
  let status = 'ok';
  try {
    const r = await refreshCreatorAccounts(pool, yt, now, log);
    out.refreshed = r.updated;
    out.dead = r.dead;
    let job;
    while (budget.limit - budget.used >= COST.search + COST.channels && (job = await claimJob(pool, workerId))) {
      const before = budget.used;
      try {
        const cp = await runDiscoverJob(pool, yt, job, now, log);
        await pool.query(
          `UPDATE discovery_jobs SET status = 'done', finished_at = now(), locked_by = NULL, result = $2,
             quota_units_used = quota_units_used + $3 WHERE id = $1`,
          [job.id, { seen: cp.seen, added: cp.added, added_no_country: cp.added_no_country, rejected: cp.rejected, queries: cp.queries }, budget.used - before]);
        out.jobs++;
        out.added += cp.added;
        out.seen += cp.seen;
      } catch (err) {
        // Running out of quota is not the job's fault: it is queued again for the next run (resuming from its
        // checkpoint) without using up an attempt. Other errors retry with a growing delay, then fail.
        const quota = err instanceof QuotaExhausted;
        const retry = quota || job.attempts < job.max_attempts;
        await pool.query(
          `UPDATE discovery_jobs SET status = $2, locked_by = NULL, last_error = $3,
             next_run_at = now() + ($4 || ' minutes')::interval, quota_units_used = quota_units_used + $5,
             attempts = attempts - $6::int WHERE id = $1`,
          [job.id, retry ? 'queued' : 'failed', err.message.slice(0, 500), quota ? 60 : 30 * job.attempts,
            budget.used - before, quota ? 1 : 0]);
        if (err instanceof QuotaExhausted) throw err;
        log(`  job ${job.id} failed (attempt ${job.attempts}/${job.max_attempts}): ${err.message}`);
      }
    }
  } catch (err) {
    if (err instanceof QuotaExhausted) {
      out.stopped = err.message;
    } else {
      status = 'failed';
      out.stopped = err.message;
    }
  } finally {
    await pool.query(
      `UPDATE agent_runs SET finished_at = now(), status = $2, quota_units = $3, items_seen = $4, items_new = $5, message = $6 WHERE id = $1`,
      [run.id, status, budget.used, out.seen + out.refreshed, out.added,
        `refreshed ${out.refreshed}, dead ${out.dead}, jobs ${out.jobs}, new candidates ${out.added}${out.stopped ? `; stopped: ${out.stopped}` : ''}`.slice(0, 1000)]);
  }
  log(`[creators/youtube] refreshed ${out.refreshed}, dead ${out.dead}, jobs ${out.jobs}, new candidates ${out.added}, quota ${budget.used}${out.stopped ? ` (stopped: ${out.stopped})` : ''}`);
  return { ...out, quota: budget.used, status };
}

// The 'global' agent: decides which countries the YouTube agent searches next.
async function planDiscovery(pool, { log = console.log, now = new Date(), maxJobs = 10 } = {}) {
  const agent = await agentState(pool, 'global');
  if (!agent || agent.paused) return { skipped: 'paused' };
  const { rows: [{ open }] } = await pool.query(
    `SELECT count(*)::int AS open FROM discovery_jobs WHERE agent = 'youtube' AND status IN ('queued', 'running')`);
  const room = Math.max(maxJobs - open, 0);
  // A country is due when it has no open job and no recent search of the current version.
  const { rows: countries } = await pool.query(
    `SELECT c.id, c.iso_code, c.name, c.capital, c.languages FROM countries c
     WHERE NOT EXISTS (SELECT 1 FROM discovery_jobs j WHERE j.agent = 'youtube' AND j.job_type = 'discover' AND j.country_id = c.id
                         AND (j.status IN ('queued', 'running')
                              OR (j.created_at > $1::timestamptz - interval '${RESEARCH_DAYS} days'
                                  AND coalesce((j.params->>'v')::int, 1) >= $5)))
     ORDER BY coalesce(array_position($2::text[], c.iso_code::text), 1000),
              coalesce(array_position($3::text[], c.region), 100), c.name
     LIMIT $4`, [now, PRIORITY_ISO, REGION_ORDER, room, SEARCH_VERSION]);
  const day = now.toISOString().slice(0, 10);
  let queued = 0;
  for (const c of countries) {
    const { rowCount } = await pool.query(
      `INSERT INTO discovery_jobs (agent, job_type, country_id, params, idempotency_key)
       VALUES ('youtube', 'discover', $1, $2, $3) ON CONFLICT (idempotency_key) DO NOTHING`,
      [c.id, searchPlan(c), `youtube:discover:v${SEARCH_VERSION}:${c.iso_code.trim()}:${day}`]);
    queued += rowCount;
  }
  await pool.query(
    `INSERT INTO agent_runs (agent, finished_at, status, items_new, message) VALUES ('global', now(), 'ok', $1, $2)`,
    [queued, `queued ${queued} YouTube discovery job(s): ${countries.map((c) => c.iso_code.trim()).join(' ') || 'none due'}`]);
  log(`[creators/global] queued ${queued} job(s)${countries.length ? `: ${countries.map((c) => c.iso_code.trim()).join(' ')}` : ''}`);
  return { queued };
}

module.exports = { planDiscovery, runYoutubeAgent, youtubeClient, searchPlan, TOPIC_CATEGORY, QuotaExhausted };
