// End-to-end QA for the tracking + YouTube landing-page flow, run against a
// LOCAL stack (Postgres + API on :4000 + `next start` on :3000) seeded with
// an approved video at /youtube/video-01 (and video-02). See
// docs/ANALYTICS-TRACKING.md section 10 for the exact setup.
//
//   NODE_PATH=<repo>/node_modules node docs/qa/e2e-landing.js
//
// Requires the `playwright` package (not a project dependency) and a
// Chromium binary (PLAYWRIGHT_BROWSERS_PATH / executablePath below).
// WARNING: truncates analytics tables + leads in the target DB; refuses to
// run against anything but localhost.
const { chromium, devices } = require('playwright');
const { Client } = require('pg');
const SHOTS = process.env.E2E_SHOTS || require('path').join(__dirname);
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const DB_URL = process.env.E2E_DATABASE_URL || 'postgres://nouvellesdupays:changeme@localhost:5432/nouvellesdupays';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB_URL) || !/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error('Refusing to run: this script TRUNCATES analytics tables and must only target a local stack.');
  process.exit(2);
}
const AD = '/youtube/video-01?utm_source=facebook&utm_medium=paid_social&utm_campaign=africa_news_test&utm_content=video_01&fbclid=IwAR_e2e_123';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const db = new Client({ connectionString: DB_URL });
  await db.connect();
  await db.query('TRUNCATE analytics_events, analytics_sessions, analytics_visitors, leads CASCADE');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

  // 1. Facebook ad visit on a phone: nothing before consent, full journey after.
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|net::/.test(m.text())) consoleErrors.push(m.text()); });
  await page.goto(BASE + AD);
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: `${SHOTS}/landing-mobile-consent.png`, fullPage: false });
  check('consent banner shown on first visit', true);
  await sleep(2500);
  let n = (await db.query('SELECT count(*)::int n FROM analytics_events')).rows[0].n;
  check('no events stored before consent', n === 0, `${n} events`);
  const storageBefore = await page.evaluate(() => Object.keys(localStorage));
  check('nothing written to localStorage before consent', storageBefore.length === 0, JSON.stringify(storageBefore));

  await page.getByRole('button', { name: 'Tout accepter' }).click();
  await sleep(3500);
  const evs = (await db.query('SELECT event_name, utm_campaign, utm_content, landing_page, channel, is_facebook, meta_status FROM analytics_events ORDER BY id')).rows;
  const names = evs.map((e) => e.event_name);
  check('PageView + LandingPageView + YouTubeLandingPageView after consent', ['PageView', 'LandingPageView', 'YouTubeLandingPageView'].every((x) => names.includes(x)), names.join(','));
  check('Facebook attribution captured', evs.every((e) => e.utm_campaign === 'africa_news_test' && e.utm_content === 'video_01' && e.channel === 'paid_social' && e.is_facebook), JSON.stringify(evs[0]));
  const sess = (await db.query('SELECT fbclid, landing_page FROM analytics_sessions')).rows[0];
  check('fbclid + landing page stored on session', sess.fbclid === 'IwAR_e2e_123' && sess.landing_page === '/youtube/video-01', JSON.stringify(sess));
  await page.screenshot({ path: `${SHOTS}/landing-mobile.png`, fullPage: true });

  await page.getByRole('button', { name: /Lire la vidéo/ }).click();
  await sleep(500);
  await page.getByRole('link', { name: /Rejoindre NouvellesDuPays/ }).first().click();
  await page.fill('#youtube-landing-email', 'e2e.reader@example.com');
  await page.check('text=J’accepte la');
  await sleep(2600);
  await page.getByRole('button', { name: /Rejoindre NouvellesDuPays — gratuit/ }).click();
  await page.getByText('Votre inscription est confirmée').waitFor({ timeout: 10000 });
  check('registration succeeds from landing page', true);
  await sleep(3000);
  const conv = (await db.query(`SELECT event_name, source, utm_content FROM analytics_events WHERE event_name IN ('VideoThumbnailClick','RegisterStarted','RegistrationStarted','RegistrationCompleted') ORDER BY id`)).rows;
  check('VideoThumbnailClick, RegisterStarted, RegistrationStarted, RegistrationCompleted recorded', ['VideoThumbnailClick', 'RegisterStarted', 'RegistrationStarted', 'RegistrationCompleted'].every((x) => conv.some((c) => c.event_name === x)), conv.map((c) => `${c.event_name}(${c.source})`).join(','));
  check('RegistrationCompleted recorded server-side with ad attribution', conv.some((c) => c.event_name === 'RegistrationCompleted' && c.source === 'server' && c.utm_content === 'video_01'));
  const lead = (await db.query(`SELECT utm_campaign, utm_content, source_page, video_id FROM leads WHERE email = 'e2e.reader@example.com'`)).rows[0];
  check('lead row carries campaign attribution', lead && lead.utm_content === 'video_01' && lead.video_id !== null, JSON.stringify(lead));

  // Navigate to another page: same session, attribution kept.
  await page.goto(BASE + '/register');
  await sleep(3000);
  const sessions = (await db.query('SELECT count(*)::int n FROM analytics_sessions')).rows[0].n;
  const reg = (await db.query(`SELECT utm_campaign FROM analytics_events WHERE page_path = '/register' AND event_name = 'PageView'`)).rows[0];
  check('navigation keeps one session and the original attribution', sessions === 1 && reg?.utm_campaign === 'africa_news_test', `sessions=${sessions} ${JSON.stringify(reg)}`);
  check('no unexpected console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await ctx.close();

  // 2. Refusal: nothing collected.
  const ctx2 = await browser.newContext({ ...devices['Pixel 7'] });
  const p2 = await ctx2.newPage();
  const before = (await db.query('SELECT count(*)::int n FROM analytics_events')).rows[0].n;
  await p2.goto(BASE + '/youtube/video-01?utm_source=google&utm_medium=organic');
  await p2.getByRole('button', { name: 'Tout refuser' }).click();
  await p2.getByRole('button', { name: /Lire la vidéo/ }).click();
  await sleep(3000);
  const after = (await db.query('SELECT count(*)::int n FROM analytics_events')).rows[0].n;
  const keys = await p2.evaluate(() => Object.keys(localStorage));
  check('refusing consent: no events, only the consent choice stored', after === before && keys.join() === 'ndp_consent', `events +${after - before}, keys=${keys}`);
  await ctx2.close();

  // 2b. Headless/bot user agents are never tracked.
  const ctxBot = await browser.newContext();
  const pb = await ctxBot.newPage();
  const beforeBot = (await db.query('SELECT count(*)::int n FROM analytics_events')).rows[0].n;
  await pb.goto(BASE + '/youtube/video-01');
  await pb.getByRole('button', { name: 'Tout accepter' }).click();
  await sleep(3000);
  const afterBot = (await db.query('SELECT count(*)::int n FROM analytics_events')).rows[0].n;
  check('HeadlessChrome user agent is filtered as a bot', afterBot === beforeBot, `+${afterBot - beforeBot}`);
  await ctxBot.close();

  // 3. Organic visit is not Facebook.
  const ctx3 = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '/youtube/video-01');
  await p3.getByRole('button', { name: 'Tout accepter' }).click();
  await sleep(3000);
  const org = (await db.query(`SELECT channel, is_facebook FROM analytics_sessions ORDER BY started_at DESC LIMIT 1`)).rows[0];
  check('direct/organic visit classified as non-Facebook', org.channel === 'direct' && org.is_facebook === false, JSON.stringify(org));
  await p3.screenshot({ path: `${SHOTS}/landing-desktop.png`, fullPage: true });
  await p3.goto(BASE + '/youtube/video-02');
  await p3.screenshot({ path: `${SHOTS}/landing-missing-metadata-desktop.png`, fullPage: false });
  check('video with no thumbnail/description renders', await p3.getByRole('heading', { level: 1 }).isVisible());
  await ctx3.close();

  // 4. Tablet + slow 3G.
  const ctx4 = await browser.newContext({ ...devices['iPad Mini'] }); // screenshot taken under slow 3G, i.e. possibly pre-hydration
  const p4 = await ctx4.newPage();
  const cdp = await ctx4.newCDPSession(p4);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
  const t0 = Date.now();
  await p4.goto(BASE + '/youtube/video-01', { waitUntil: 'domcontentloaded' });
  await p4.getByRole('heading', { level: 1 }).waitFor();
  const headlineMs = Date.now() - t0;
  check('slow 3G (400 kbps, 400 ms RTT): headline visible quickly', headlineMs < 8000, `${headlineMs} ms`);
  const perf = await p4.evaluate(() => {
    const r = performance.getEntriesByType('resource');
    return { requests: r.length, kb: Math.round(r.reduce((s, x) => s + (x.transferSize || 0), 0) / 1024), youtube: r.filter((x) => /youtube/.test(x.name)).length };
  });
  check('no YouTube requests before the visitor clicks play', perf.youtube === 0, JSON.stringify(perf));
  await p4.screenshot({ path: `${SHOTS}/landing-tablet.png`, fullPage: false });
  await ctx4.close();

  // 5. Mobile layout: no horizontal scroll on new public pages.
  const ctx5 = await browser.newContext({ ...devices['iPhone SE'] });
  const p5 = await ctx5.newPage();
  for (const path of ['/youtube/video-01', '/register-publisher', '/submit-video', '/register', '/youtube', '/privacy', '/contact']) {
    await p5.goto(BASE + path);
    const overflow = await p5.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal overflow at 375px: ${path}`, overflow <= 0, `${overflow}px`);
  }
  await p5.goto(BASE + '/register-publisher');
  await p5.screenshot({ path: `${SHOTS}/register-publisher-mobile.png`, fullPage: true });
  await ctx5.close();

  // 6. Admin dashboard + live console.
  const ctx6 = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } });
  const p6 = await ctx6.newPage();
  await p6.goto(BASE + '/admin/login');
  await p6.fill('input[type=password]', 'local-admin');
  await p6.click('button[type=submit]');
  await p6.waitForURL(BASE + '/admin');
  await p6.goto(BASE + '/admin/analytics');
  await p6.getByText('Vue d’ensemble').waitFor();
  await sleep(1000);
  await p6.screenshot({ path: `${SHOTS}/admin-analytics.png`, fullPage: true });
  const tile = await p6.getByText('Visiteurs uniques', { exact: true }).locator('..').innerText();
  check('dashboard shows real unique visitors (2: ad visitor + organic visitor)', /\b2\b/.test(tile), tile.replace(/\n/g, ' '));
  await p6.goto(BASE + '/admin/analytics/live');
  await p6.getByText('RegistrationCompleted').first().waitFor();
  await p6.screenshot({ path: `${SHOTS}/admin-live-console.png`, fullPage: false });
  check('live console lists RegistrationCompleted', true);
  await ctx6.close();

  await browser.close();
  await db.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
