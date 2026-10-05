# Analytics, Meta ad tracking, publisher onboarding and YouTube landing pages

Implementation report for the "Meta/Facebook advertising measurement" work on
NouvellesDuPays.com. Sections follow the requested deliverables (1–12), plus
the Facebook ad test structure (Phase 15) at the end.

---

## 1. Technical audit

### What existed before this change

| Area | Finding |
|---|---|
| Frontend | Next.js 16.2 (App Router, Turbopack), React 19, Tailwind 4, TypeScript. Standalone project in `apps/web` (own lockfile, not in the npm workspace). Home page is a single client-side route: 3D globe (`react-globe.gl`) + `CountryPanel` + `VideoPanel`. UI in French, dark theme. |
| Backend | Node 20 + Fastify 5 (`apps/api`), `@fastify/cors` allow-list, `@fastify/rate-limit` (100/min global, 5/h on publisher registration). |
| Database | PostgreSQL. Plain-SQL migrations in `db/migrations`, run **all, every time** by `db/migrate.js` (no tracking table), so every migration must be idempotent. |
| Worker | `apps/worker`: Kubernetes CronJob every 5 min polling RSS/Atom and Google News sitemaps into `articles`. |
| Auth | One admin password (`ADMIN_PASSWORD_HASH`, scrypt) → HMAC-signed Bearer token (`ADMIN_TOKEN_SECRET`), checked by `requireAdmin`. **No visitor accounts, no roles.** |
| Admin | `/admin` (feed submissions), `/admin/publishers`, `/admin/invitations`, `/admin/editorial`. |
| Analytics | **None.** No GA4, no Google Tag Manager, no Meta Pixel, no event table, no consent banner. (Searched the whole repo for gtag/GTM/fbq/pixel/analytics/consent.) |
| News feeds | `publishers` → `feeds` (rss/atom/sitemap-news) → `articles`. Public registration required a working RSS/Atom feed. "No scraping" rule documented in `docs/PRD-ARCHITECTURE.md`. |
| YouTube | `video_channels` table: hand-curated Live Now / Voices / National TV rail; latest upload via keyless per-channel Atom feed. No submissions, no per-video pages. |
| Deployment | OKE (Kubernetes) on OCI: api (2 replicas), web (2 replicas), worker CronJob, Postgres StatefulSet, ingress-nginx routing `/api` → api and `/` → web on the same host. |

### Pre-existing problems found (and fixed, since this work depended on them)

1. **Migration 008 was not re-runnable** (`CREATE TABLE` without `IF NOT EXISTS`). Because `db/migrate.js` re-applies every file, *any* new migration would have failed on an existing database. Fixed by making 008 idempotent.
2. **`npm test` did not run on Node ≥ 21** (`node --test test/` treats the directory as a file). Scripts now use `test/*.test.js` (works on Node 20 and 22).

Noted but intentionally not changed: the home page calls `ipapi.co` (third-party IP geolocation) on load without consent. It is now disclosed on `/privacy`; consider gating it behind consent or replacing it with an ingress-provided country header.

### Decisions where the brief assumed things that don't exist

* **"Registration" / "existing user accounts":** there were none. A *registration* is implemented as a consented visitor sign-up (`leads` table: email + optional name/country/interests). It is a real conversion stored in the existing database, not a password account; a future account system can link to `leads`.
* **Admin roles:** reused the existing single-admin auth; no RBAC was added.
* **Logo upload:** no object storage exists, so the form accepts a logo **URL**.
* **Meta ad spend:** not pulled from the Marketing API (needs `ads_read` + app review). Admins enter daily spend (and optionally Meta-reported clicks) in `/admin/campaigns`; cost per lead is computed only when that data exists.

---

## 2. Architecture

```
Browser (Next.js)
  ├─ TrackingProvider ── consent banner ── lib/tracking.ts
  │     visitor_id / session_id (random UUIDs, localStorage, only after consent)
  │     attribution captured from the landing URL (utm_*, fbclid, referrer, landing page)
  │     events queued → batched POST /api/track (text/plain JSON, keepalive / sendBeacon)
  │     Meta Pixel loaded only after *advertising* consent; fbq(..., {eventID})
  └─ forms (register, publisher, video, contact) send `tracking` context
        ↓
API (Fastify)
  ├─ POST /api/track        validate → upsert visitor + session → insert events
  ├─ form endpoints         store the record → record the conversion event SERVER-SIDE
  └─ metaCapi.js            async batched Graph API call, same event_id as the Pixel
        ↓                                  ↓
PostgreSQL                               Meta (Pixel + Conversions API, deduplicated)
  analytics_visitors / analytics_sessions / analytics_events (+ leads, campaigns…)
        ↓
Admin
  /admin/analytics (dashboard, funnel, export) · /admin/analytics/live (test console)

YouTube: submit → oEmbed / Data API metadata → moderation → approved
         → /youtube/<slug> (server-rendered landing) → events → analytics
Feed-less websites: submit → review → approve (creates publisher + crawl source)
         → activate → worker crawler (robots.txt, bounded) → articles
```

Design choices:

* **One tracking system, first-party.** No GA4/GTM was present, so nothing is duplicated; events live in the project's own Postgres.
* **Conversions are recorded server-side** in the same request that stores the registration/submission, so ad-blockers can't hide them. The browser fires only the Pixel for those, with the server's `event_id`.
* **Attribution is denormalised** onto every event row, so all dashboard queries are single-table scans on indexed columns.
* **Nothing blocks rendering:** tracking is asynchronous and batched; the CAPI sender is a background queue; the YouTube player isn't loaded until the visitor clicks.

---

## 3. Files changed

### New
| File | Purpose |
|---|---|
| `db/migrations/011_analytics_tracking.sql` | visitors, sessions, events, campaigns, campaign_spend, leads, contact_messages, app_settings |
| `db/migrations/012_publisher_onboarding_no_feed.sql` | feed-less submissions + workflow statuses, crawl controls on `feeds` |
| `db/migrations/013_youtube_submissions.sql` | youtube_channels, youtube_videos |
| `packages/shared/src/trackingEvents.js` | canonical event catalogue + Meta mapping |
| `packages/shared/src/urlSafety.js` | URL validation / SSRF guard |
| `packages/shared/src/robots.js` | robots.txt parser (RFC 9309 subset) |
| `packages/shared/src/crawler.js` | bounded crawler for sitemap/html sources |
| `apps/api/src/tracking.js` | `/api/track`, `/api/tracking/config`, channel classification, server conversions |
| `apps/api/src/metaCapi.js` | Meta Conversions API sender |
| `apps/api/src/analytics.js` | dashboard, funnel, live console, export, campaign spend |
| `apps/api/src/leads.js` | `/api/leads`, `/api/contact` |
| `apps/api/src/youtube.js` | YouTube submissions, metadata, landing payload, moderation |
| `apps/api/src/settings.js` | admin-editable runtime settings |
| `apps/api/src/security.js` | sanitising, spam checks, Origin/JSON guards |
| `apps/api/src/origins.js` | CORS allow-list (shared) |
| `apps/web/src/lib/tracking.ts`, `trackingEvents.ts`, `serverApi.ts` | browser tracker, event mirror, SSR API client |
| `apps/web/src/components/TrackingProvider.tsx` | PageViews + consent banner |
| `apps/web/src/components/{FormKit,LeadForm,LitePlayer,LandingActions,Tracked,SafeImg,SiteFooter,VideoDirectory,ConsentSettingsButton,AdminNav}.tsx`, `components/admin/Charts.tsx` | UI building blocks |
| `apps/web/src/app/youtube/[slug]/page.tsx`, `youtube/page.tsx`, `watch/[videoId]/page.tsx` | landing pages, index, redirect |
| `apps/web/src/app/{register,submit-video,contact,privacy}/page.tsx` | public pages |
| `apps/web/src/app/admin/{analytics,analytics/live,youtube,campaigns,leads,settings}/page.tsx` | admin pages |
| `apps/api/test/{tracking,leads,publisher-registration,youtube,analytics,meta-capi}.test.js`, `apps/api/test-support/helpers.js`, `packages/shared/test/crawler.test.js` | automated tests |
| `docs/qa/e2e-landing.js` + screenshots | browser E2E script and evidence |

### Modified
`apps/api/src/{app,routes,admin,publisherRegistration}.js`, `apps/worker/src/poll.js`, `apps/api/test-support/fixtures.js`, `db/migrations/008_video_channels.sql`, `db/review-submissions.js`, `apps/web/src/app/{layout,page,robots,sitemap}.tsx`, `apps/web/src/app/register-publisher/page.tsx`, `apps/web/src/app/admin/{page,publishers/page,invitations/page,editorial/page}.tsx`, `apps/web/src/components/{CountryPanel,FeaturedStrip,SourceCardGrid,Titrologie,VideoPanel,VideoSequence}.tsx`, `apps/web/src/lib/{api,adminApi,types}.ts`, package `test` scripts, `.env.example`, `infra/k8s/{01-configmap.yaml,02-create-secret.ps1,05-api.yaml,07-web.yaml}`.

---

## 4. Database changes

All three migrations are idempotent and additive (no column dropped, no data rewritten except backfills).

**011 – analytics**
* `analytics_visitors(id uuid PK, first_seen_at, last_seen_at, first_utm_*, first_fbclid, first_landing_page, first_referrer, first_channel)` – first-touch, written once.
* `analytics_sessions(id uuid PK, visitor_id FK, started_at, last_activity_at, landing_page, referrer, utm_*, fbclid, channel, is_facebook, is_paid, device_class, page_views, event_count)` – session attribution, first write wins.
* `analytics_events(id bigserial, event_id uuid UNIQUE, event_name, event_category, occurred_at, visitor_id, session_id, page_path, page_type, country_iso, publisher_id, video_id, article_id, utm_*, channel, is_facebook, is_paid, landing_page, properties jsonb, is_debug, source client|server, meta_status)`.
  Indexes: `occurred_at`; `(event_name, occurred_at)`; `session_id`; `(utm_campaign, occurred_at)`; `(utm_source, occurred_at)`; partial `(country_iso, occurred_at)`, `(publisher_id, occurred_at)`, `(video_id, occurred_at)`; `(landing_page, occurred_at)`.
* `campaigns(utm_campaign UNIQUE, label, platform, objective, status, notes)`, `campaign_spend(campaign_id, utm_content, spend_date, amount, currency, impressions, link_clicks, UNIQUE(campaign_id, utm_content, spend_date))`.
* `leads(email, email_hash UNIQUE, name, country_id, interests[], marketing_consent, privacy_accepted_at, source_page, video_id, visitor_id, session_id, utm_*)`.
* `contact_messages`, `app_settings(key PK, value jsonb)`.

**012 – feed-less publishers**
* `publisher_submissions`: `feed_url`, `feed_type` now nullable; status CHECK = `submitted, pending, approved, active, rejected, suspended` (existing `pending/approved/rejected` rows stay valid); new columns `domain` (backfilled, indexed), `region, city, description, categories[], contact_name, youtube_url, facebook_url, x_url, instagram_url, tiktok_url, api_url, logo_url, sitemap_url, category_urls[], article_url_patterns[], ingestion_method, permission_confirmed, publisher_id, status_changed_at`.
* `publishers`: `feed_status` gains `suspended`; new `x_url, region, city, description`.
* `feeds`: `feed_type` gains `sitemap`, `html`; new `crawl_frequency_minutes` (NULL = every run, i.e. existing behaviour), `enabled`, `allowed_domains[]`, `respect_robots_txt`, `category_urls[]`, `article_url_patterns[]`, `parser_config jsonb`, `last_success_at` (backfilled), `last_error`, `last_error_at`, `consecutive_failures`.
* Index `articles(publisher_id, published_at DESC)`.

**013 – YouTube**
* `youtube_channels(youtube_channel_id UNIQUE, handle, channel_url UNIQUE, name, description, country_id, language, category, contact_email, publisher_id, verification, status, …)`.
* `youtube_videos(youtube_video_id UNIQUE, slug UNIQUE CHECK ^[a-z0-9][a-z0-9-]{0,79}$, title, description, thumbnail_url, channel_id, channel_name, channel_url, country_id, language, category, published_at, publisher_id, contact_email, metadata_source, availability, status, landing_headline, landing_cta_text, is_featured, …)`; indexes on `(status, submitted_at)`, `(country_id, status, approved_at)`, `channel_id`.

Personal data minimisation: no IP and no raw User-Agent are stored anywhere; emails exist only in `leads`, `contact_messages`, `publisher_submissions`, `youtube_*` (admin-only), never in events.

Retention (recommendation, not automated): purge `analytics_events` older than 13 months, e.g. a monthly `DELETE FROM analytics_events WHERE occurred_at < now() - interval '13 months'`.

---

## 5. Environment variables

See `.env.example` (complete, no real values). New variables:

| Variable | Where | Secret | Purpose |
|---|---|---|---|
| `META_PIXEL_ID` | api (configmap) | no | Default Pixel ID (overridable in /admin/settings) |
| `META_ACCESS_TOKEN` | api (secret) | **yes** | Conversions API token |
| `META_TEST_EVENT_CODE` | api (secret, optional) | no* | Routes CAPI events to Events Manager → Test events |
| `META_GRAPH_API_VERSION` | api | no | Default `v21.0` |
| `YOUTUBE_API_KEY` | api (secret, optional) | **yes** | Full metadata (description, publish date). Without it: keyless oEmbed |
| `TRACKING_ENABLED` | api | no | Default `true` |
| `CONSENT_MODE` | api | no | `opt_in` (default, UK/EU) or `opt_out` |
| `TRACKING_DEBUG` | api | no | Log every batch |
| `PUBLIC_SITE_URL` | api | no | Used for CAPI `event_source_url` |
| `API_INTERNAL_URL` | web (runtime) | no | SSR → API over the cluster network |
| `CRAWL_MAX_ARTICLES_PER_RUN`, `CRAWL_DELAY_MS` | worker | no | Crawler bounds (20, 1000 ms) |

\* Not sensitive, but kept out of the configmap because it should only be set during tests.

---

## 6. Tracking event catalogue

Canonical list: `packages/shared/src/trackingEvents.js` (mirrored in `apps/web/src/lib/trackingEvents.ts`; a test asserts they're identical; `/api/track` rejects unknown names).

Common parameters on every event: `event_id` (UUID, Meta dedup key), `occurred_at`, `visitor_id`, `session_id`, `page_path` (no query string), `page_type`, session attribution (`utm_source/medium/campaign/content/term`, `channel`, `is_facebook`, `is_paid`, `landing_page`), optional `country_iso`, `publisher_id`, `video_id`, `article_id`, and `properties` (flat, ≤ 20 keys, PII keys and email-like values stripped).

| Event | Category | Fired when | Meta |
|---|---|---|---|
| PageView | page | every route change (after consent) | PageView |
| LandingPageView | page | first page of each session (auto) | – |
| CountryPageView | page | a country panel loads | ViewContent |
| PublisherPageView | page | the "Médias" (publisher directory) tab opens | – |
| YouTubeLandingPageView | page | a `/youtube/<slug>` page is viewed | ViewContent |
| NewsArticleClick | engagement | click on an article (latest news, "À la une", Titrologie, landing related news) | – |
| ExternalPublisherClick | engagement | click to a publisher site / social profile | – |
| YouTubeClick | engagement | click to a YouTube channel (video rail, source card, landing channel link) | custom |
| VideoThumbnailClick | engagement | landing-page thumbnail clicked (player starts loading) | – |
| YouTubePlay | engagement | first actual playback (IFrame API state PLAYING) | custom |
| YouTubeWatch | engagement | 25 / 50 / 75 / 100 % watched (`percent`) | – |
| WatchOnYouTube | engagement | "Regarder sur YouTube" CTA | custom |
| RelatedVideoClick | engagement | related video on a landing page | – |
| Search | engagement | settled search on `/youtube` (`search_term`, `results`) | Search |
| CountrySelected | engagement | country clicked on the globe / "Explorer ce pays" | – |
| CategorySelected | engagement | topic filter in the Voices video rail | – |
| Share | engagement | share button (`method`) | custom |
| RegisterStarted | engagement | click on a "Rejoindre" CTA | – |
| RegistrationStarted | conversion | first interaction with the registration form | custom |
| RegistrationCompleted | conversion | **server-side**, new lead stored | CompleteRegistration |
| PublisherRegistrationStarted | conversion | first interaction with the publisher form | – |
| PublisherRegistrationCompleted | conversion | **server-side**, submission stored | SubmitApplication |
| YouTubeSubmissionStarted | conversion | first interaction with a video/channel form | – |
| YouTubeSubmissionCompleted | conversion | **server-side**, submission stored (`kind`) | SubmitApplication |
| ContactSubmitted | conversion | **server-side**, message stored | Contact |

**Lead** = any of RegistrationCompleted, PublisherRegistrationCompleted, YouTubeSubmissionCompleted, ContactSubmitted. Page visits are never leads. Registration *starts* are counted once per session (CTA click and/or form focus).

**Channel classification** (session level): `utm_medium` in a paid list (`paid_social, cpc, ppc, paid, cpm, display…`) → `paid_social` when the source is Facebook/Instagram/social, else `paid_search`/`other`; Facebook/Instagram source or referrer or an `fbclid` → `is_facebook`; an `fbclid` **without** UTMs is classed `organic_social` (Meta adds it to organic shares too) – always tag ads with `utm_medium=paid_social`.

---

## 7. Admin dashboard (`/admin/analytics`)

Filters (one row): Today · Yesterday · 7 / 30 / 90 days · Custom (max 366 days), in the admin's browser time zone; country, campaign, source, medium, landing page, publisher, YouTube channel, YouTube video; "include test traffic". Campaign/source/medium/landing page filter on the session's attribution; country/publisher/channel/video select **sessions that touched** that entity.

| Metric | Definition |
|---|---|
| Visiteurs (total) | Σ over days of distinct visitors that day |
| Visiteurs uniques | distinct visitor ids in range |
| Sessions | distinct sessions |
| Pages vues | PageView count |
| Visiteurs Facebook | distinct visitors with an `is_facebook` session (hint: paid vs organic, all channels) |
| Visiteurs YouTube | distinct visitors with a YouTube landing view or video interaction |
| Leads | lead events (see §6) |
| Inscriptions | RegistrationCompleted events (hint: all `leads` rows incl. visitors who refused tracking) |
| Taux de conversion | Inscriptions ÷ visiteurs uniques |
| Clics | click events (§6 engagement clicks) |

Sections: daily trend (visitors vs Facebook visitors, with table view), sessions by channel, **conversion funnel** (Facebook ad clicks as reported by Meta if entered → landing page → video interaction → website engagement → registration started → completed; closed funnel, % from previous and from top; "all traffic" toggle), **campaign performance per ad** (campaign/source/medium/content, visitors, landing views, clicks, registrations, conversion, spend, cost per lead) + per-campaign totals (Meta clicks, cost per lead / per registration), **landing pages**, **YouTube performance** (page views, plays, clicks, outbound YouTube clicks, shares, registrations, conversion), **publisher registration** (submitted/approved/active/pending/rejected/suspended, form starts → completions). **Export** CSV/JSON (events, sessions, campaigns per ad or totals, landing pages, YouTube, funnel) with the same filters; CSV is formula-injection-safe; leads (emails) are never in analytics exports.

Empty data shows "—", never a fabricated 0 %. Debug/test events (`?ndp_debug=1`) are excluded unless requested.

Other admin pages: `/admin/analytics/live` (event test console), `/admin/campaigns` (campaign registry + daily spend/clicks), `/admin/leads` (registrations + contact messages), `/admin/youtube`, `/admin/settings`, and the updated `/admin` and `/admin/publishers`.

---

## 8. Publisher registration workflow

Public form `/register-publisher` ("Inscrivez votre site d’actualités"): name, URL, country, region, city, language, description, categories, logo URL, RSS/Atom or API (optional) **or** sitemap URL + category pages + article URL patterns, YouTube/Facebook/X/Instagram/TikTok, contact name + email, mandatory permission checkbox.

```
With a feed:   verify feed (existing logic) ─► PENDING ─► APPROVED (live immediately, unchanged behaviour)
Without feed:  SUBMITTED ─► PENDING REVIEW ─► APPROVED ─► ACTIVE
               (any open state) ─► REJECTED      APPROVED/ACTIVE ─► SUSPENDED ─► ACTIVE
```

* **Submit:** validated + sanitised; duplicate domain → 409; honeypot / min fill-time / link-count spam checks; 5 per hour per IP. **Nothing is fetched** for feed-less sites at submission.
* **Approve:** creates the publisher (`feed_status = pending`) and a disabled-from-crawling source (`feeds` row of type `sitemap` if a sitemap was given, else `html`), with allowed domains = the site's domain, robots.txt respected, default frequency (60 min).
* **Configure / test (`/admin/publishers` → "Modifier / sources"):** frequency, allowed domains, category pages, article URL patterns, robots.txt (confirm dialog to disable; only with the publisher's written consent), parser config, enable. **Tester** runs a dry run (max 5 article pages) and shows the extracted titles and a log; nothing is written.
* **Activate:** sets the publisher `active`; the worker starts crawling at the configured interval. Refused if no enabled source exists (e.g. API-only submissions, which need manual integration).
* **Crawler guarantees:** robots.txt (incl. Crawl-delay; unreachable robots.txt = don't crawl), allowed domains only, URL patterns (glob, never raw regex), ≤ 20 article pages per run, ≥ 1 s between requests, already-ingested URLs skipped, only link-preview metadata read (OpenGraph / title / description / published time) – same headline + excerpt + link-out model as RSS.
* Publisher list shows a health light (OK / never collected / stale > 24 h / error / pending / suspended), last successful crawl, last error, article count, 30-day click traffic, and inline editing.

The CLI fallback `db/review-submissions.js` now only handles feed-based submissions.

---

## 9. YouTube workflow

```
Submit (/submit-video)            video URL (+ optional channel, title…), country, language, category, contact email
  │  URL parsed (watch, youtu.be, shorts, embed, live) → invalid = 400
  │  metadata from YouTube: Data API (if YOUTUBE_API_KEY) or oEmbed
  │     404 → "deleted / not found" (422) · 401/403 → private/not embeddable (422)
  │     YouTube unreachable → stored with submitter metadata, status SUBMITTED
  │  duplicate video → 409 · channel row upserted · YouTubeSubmissionCompleted recorded
  ▼
Review (/admin/youtube)           SUBMITTED / PENDING → APPROVED | REJECTED; APPROVED → SUSPENDED
  │  "Revérifier sur YouTube" refreshes metadata; a video deleted later is auto-suspended
  │  landing settings: slug (e.g. video-01), headline, CTA text, featured
  ▼
Landing page                      /youtube/<slug> (also /watch/<youtube-id> → 307, query string kept)
  │  server-rendered, OpenGraph + VideoObject JSON-LD, thumbnail as LCP, player loads on click
  │  (youtube-nocookie), CTAs "Rejoindre" + "Regarder sur YouTube", trust signals, inline
  │  registration form, related videos, related news, country info, publisher, share buttons
  ▼
Tracking                          YouTubeLandingPageView, VideoThumbnailClick, YouTubePlay, YouTubeWatch,
  │                               WatchOnYouTube, RelatedVideoClick, Share, RegisterStarted,
  │                               RegistrationStarted, RegistrationCompleted (server) – all with the session's ad attribution
  ▼
Analytics                         YouTube performance table, landing-page table, funnel, campaign table
```

Channels can also be submitted on their own (tab "Une chaîne"): `/channel/UC…` verified through the public Atom feed, `@handle` through the channel page (or the Data API), 404 → rejected.

---

## 10. Testing

### Automated (`npm test` – needs a local `nouvellesdupays_test` database, see `apps/api/test-support/env.js`)

**123 tests, 123 passing** (48 pre-existing, all still passing + 75 new):

| Suite | Covers |
|---|---|
| `tracking.test.js` (15) | catalogue parity web↔server; public config hides secrets; channel classification (FB paid / organic / fbclid-only / search / direct / email / paid search); PII stripping; device class; **Facebook landing visit** (session + events + first-touch); **navigation keeps attribution**; **organic visit**; **fbclid attribution**; **session can't be hijacked**; duplicate event ids; unknown events; query strings stripped; no consent / bots / foreign origin dropped; sendBeacon bodies; tracking kill switch |
| `leads.test.js` (8) | valid registration + server-side conversion with attribution; repeat email not a 2nd conversion; no-consent registration; **invalid email**; **spam** (honeypot, too fast, missing timing); **CSRF** (foreign Origin 403, form-encoded 415); **XSS** stripped; contact form |
| `publisher-registration.test.js` (12) | SSRF/malicious URLs; **valid publisher without feed**; **duplicate website**; **invalid URL / private IP / invalid email / wrong social host / off-site URLs / bad patterns / categories / permission**; **spam** before any fetch; feed flow unchanged + failed verification; **admin approval → activation → suspension → reactivation**; **rejection**; activation without a source refused; source config validation; **test endpoint is a dry run**; publisher list health fields |
| `youtube.test.js` (12) | URL parsing; slugs; **valid video**; **invalid / deleted / private / duplicate video**; YouTube unreachable; **valid channel (id, handle)**, **invalid channel**, invalid channel URL, duplicate; landing only after approval, no private fields; campaign slugs; deleted-after-approval auto-suspend |
| `analytics.test.js` (13) | auth; **every overview metric against a hand-computed journey set**; debug exclusion; per-ad campaign table + **cost per lead**; landing pages; YouTube table; **Facebook funnel stages and %**; all filters; date ranges + validation + "no fake 0 %"; CSV/JSON export; live console; filter options; settings validation |
| `meta-capi.test.js` (5) | Graph API payload (shared event_id, hashed external id, fbc/fbp, IP/UA, test code), mapping; no advertising consent → nothing sent; CompleteRegistration with **hashed email only**; API failure recorded; CAPI disable switch |
| `shared/crawler.test.js` (10) | robots.txt semantics; glob patterns can't become regex; metadata extraction; sitemap/sitemap-index; link extraction (bug found & fixed: links with `#fragment` were skipped); crawler honours robots.txt, domains, known URLs and per-run cap; unreachable robots.txt = no crawl; unsafe start URL refused |

### End-to-end browser QA (`docs/qa/e2e-landing.js`, Chromium via Playwright, real API + DB + production Next build)

**27 / 27 checks passed**, including: consent banner shown; **nothing stored or sent before consent**; after "Tout accepter" PageView + LandingPageView + YouTubeLandingPageView with the Facebook campaign attribution and fbclid; thumbnail click → registration from the landing page → server-side RegistrationCompleted with `utm_content=video_01` and the lead row attributed; navigating to another page keeps one session and the original attribution; refusing consent stores only the choice; headless user agents are filtered as bots; direct visit classified non-Facebook; video with **missing thumbnail and description** renders; **slow 3G** (400 kbps / 400 ms): headline visible in ≈ 2 s, 29 KB transferred, **zero YouTube requests before play**; **no horizontal overflow at 375 px** on all 7 new public pages; **mobile (iPhone 13, iPhone SE, Pixel 7), tablet (iPad Mini), desktop (1366, 1440)**; admin dashboard shows the real numbers; live console shows RegistrationCompleted. Screenshots: `docs/qa/*.png`.

Found and fixed during QA: image fallbacks didn't trigger for images that failed before hydration (now `SafeImg` / mount check); registration starts were double-counted when a visitor both clicked the CTA and focused the form.

To reproduce locally: start Postgres, `npm run migrate && npm run seed`, insert an approved `youtube_videos` row with slug `video-01` (and `video-02`), run the API (`ADMIN_PASSWORD_HASH`, `ADMIN_TOKEN_SECRET` set) and `next build && next start` with `API_INTERNAL_URL=http://localhost:4000`, then `NODE_PATH=node_modules node docs/qa/e2e-landing.js` (needs the `playwright` package).

### Manual test plan (before the first paid campaign)

1. Open `/youtube/video-01?utm_source=facebook&utm_medium=paid_social&utm_campaign=africa_news_test&utm_content=video_01&ndp_debug=1` on a real phone; accept cookies; play the video; watch past 25 %; click "Regarder sur YouTube"; share via WhatsApp; register. Check each event in `/admin/analytics/live`.
2. Same URL in a private window, **refuse** cookies → console shows nothing; `connect.facebook.net` never requested (DevTools → Network).
3. Accept only "Mesure d’audience" → events appear with `meta_status = no_consent`; Pixel not loaded.
4. Submit a publisher without feed, with a feed, a duplicate, and spam (fill the hidden field via DevTools) → expected outcomes as above; walk one through review → approve → configure → **Tester** → activate; check the next worker run in the publisher list.
5. Submit a valid, a private, a deleted and a duplicate YouTube video and an invalid channel.
6. Check landing pages in Lighthouse (mobile): LCP is the thumbnail image; no third-party scripts before interaction (except the Pixel after consent).
7. Admin: change the range/filters, export CSV and JSON, enter a day of spend, confirm cost per lead.

---

## 11. Deployment (existing OKE setup)

1. **Build images** as today (Kaniko jobs in `infra/k8s/ci`); the web image still takes `--build-arg NEXT_PUBLIC_API_URL=https://nouvellesdupays.com`. No new build args.
2. **Secrets** (only if you use CAPI / YouTube Data API now – both optional):
   ```powershell
   $env:META_ACCESS_TOKEN = "<Conversions API token>"
   $env:YOUTUBE_API_KEY   = "<key>"            # optional
   pwsh infra/k8s/02-create-secret.ps1          # keeps existing DB/admin values
   ```
3. **Config:** set `META_PIXEL_ID` in `infra/k8s/01-configmap.yaml` (or later in /admin/settings), then
   `kubectl apply -f infra/k8s/01-configmap.yaml`.
4. **Migrate** (011–013; 008 is now re-runnable):
   ```
   kubectl delete job nouvellesdupays-migrate -n nouvellesdupays
   kubectl apply -f infra/k8s/04-migrate-job.yaml
   kubectl wait --for=condition=complete job/nouvellesdupays-migrate -n nouvellesdupays --timeout=120s
   ```
   The job also re-runs the seed (idempotent, as before). Take a recovery point first (`ops/scripts/New-RecoveryPoint.ps1`) per `ops/CHANGE_MGMT.md`.
5. **Roll out:** `kubectl apply -f infra/k8s/05-api.yaml -f infra/k8s/07-web.yaml` then
   `kubectl rollout restart deployment/nouvellesdupays-api deployment/nouvellesdupays-web -n nouvellesdupays`. The worker CronJob picks up its new image on its next run.
6. **Verify:** `curl https://nouvellesdupays.com/api/tracking/config`; open a landing page; check `/admin/analytics/live`; check `/admin/settings` shows "META_ACCESS_TOKEN ✓".
7. **Rollback:** previous images via `ops/scripts/Invoke-Rollback.ps1`. The migrations are additive, so the old code keeps working against the new schema; no down-migration is needed.

Notes: the API runs 2 replicas – the CAPI queue and the settings cache (30 s) are per pod, which is fine; rate limits are per pod (as before).

---

## 12. Verifying events reach Meta

1. **Events Manager → Data sources → your Pixel → Test events.** Copy the test code (e.g. `TEST12345`) into `/admin/settings → Code d’événement de test` (or `META_TEST_EVENT_CODE`).
2. Install **Meta Pixel Helper** (Chrome). Open `https://nouvellesdupays.com/youtube/video-01?utm_source=facebook&utm_medium=paid_social&utm_campaign=africa_news_test&utm_content=video_01&ndp_debug=1`, click **Tout accepter**.
   * Pixel Helper should show `PageView` and `ViewContent`, each with an **Event ID**.
3. In **Test events** you should see each event twice – *Browser* and *Server* – merged as **"Deduplicated"** (same `event_name` + `event_id`). Register on the page → `CompleteRegistration` appears from the server (and browser) with matching ids; check the parameters: `em` (hashed), `external_id`, `fbc` (when arriving with an fbclid), `fbp`, IP, user agent.
4. In `/admin/analytics/live`, the **Meta** column should read `sent` for mapped events (`queued` for ≤ 2 s). `failed` → API logs contain Meta's error message (`[meta-capi] Graph API returned …`); `disabled` → token/Pixel ID missing or CAPI switched off; `no_consent` → visitor refused advertising.
5. **Clear the test event code** when done (otherwise production events keep going to the test tool).
6. Check **Event Match Quality** for CompleteRegistration after a few days; aim for "Good" or better.
7. In Ads Manager, optimise the campaign for **CompleteRegistration** (or Lead, if you add a custom conversion) and compare Meta's reported results with `/admin/analytics`. Expect them to differ: Meta models conversions and attributes by its own windows, while this dashboard counts only visitors who accepted analytics.

---

## 15. Recommended Facebook ad test structure

Keep the application unchanged; vary only ads, URLs and UTM tags so each variant is separately identifiable.

```
Campaign:  africa_news_test            (objective: Leads / Conversions → CompleteRegistration)
  Ad set:  ivory_coast_news            (CI, 18–45, FR, mobile placements, same budget per ad)
    Ad: video_01 → https://nouvellesdupays.com/youtube/video-01?utm_source=facebook&utm_medium=paid_social&utm_campaign=africa_news_test&utm_content=video_01&utm_term=ivory_coast_news
    Ad: video_02 → …/youtube/video-02?…&utm_content=video_02&utm_term=ivory_coast_news
    Ad: video_03 → …/youtube/video-03?…&utm_content=video_03&utm_term=ivory_coast_news
```

Setup steps:
1. Approve the three videos in `/admin/youtube` and set their slugs to `video-01`, `video-02`, `video-03` ("Configurer la page de destination"); set a headline that matches each ad's creative (no misleading claims).
2. Declare `africa_news_test` in `/admin/campaigns`; each day, enter spend and Meta "link clicks" per `utm_content`.
3. In Meta, use the URL parameters field: `utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}` with campaign/ad set/ad names exactly as above.
4. Read results in `/admin/analytics` → "Performance des campagnes" (one row per `utm_content`) and the Facebook funnel filtered by campaign; compare cost per lead per ad.
5. Run each variant until it has at least ~50 landing sessions before judging; change one variable at a time (creative, then audience, then CTA text via the landing settings).
