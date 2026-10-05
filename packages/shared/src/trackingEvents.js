// Canonical tracking-event catalogue. The browser client
// (apps/web/src/lib/trackingEvents.ts) mirrors this list -- the API test
// suite asserts the two stay identical -- and POST /api/track rejects any
// name not listed here, so a typo can never silently create a new metric.
//
// category: 'page' | 'engagement' | 'conversion'
// meta:     how the event is forwarded to Meta (Pixel + Conversions API),
//           or null when it stays first-party only.
//           { type: 'standard'|'custom', name }
const EVENTS = {
  // Page / traffic
  PageView:               { category: 'page', meta: { type: 'standard', name: 'PageView' } },
  LandingPageView:        { category: 'page', meta: null },
  CountryPageView:        { category: 'page', meta: { type: 'standard', name: 'ViewContent' } },
  PublisherPageView:      { category: 'page', meta: null },
  YouTubeLandingPageView: { category: 'page', meta: { type: 'standard', name: 'ViewContent' } },

  // Engagement
  NewsArticleClick:       { category: 'engagement', meta: null },
  ExternalPublisherClick: { category: 'engagement', meta: null },
  YouTubeClick:           { category: 'engagement', meta: { type: 'custom', name: 'YouTubeClick' } },
  YouTubePlay:            { category: 'engagement', meta: { type: 'custom', name: 'YouTubePlay' } },
  YouTubeWatch:           { category: 'engagement', meta: null },
  VideoThumbnailClick:    { category: 'engagement', meta: null },
  WatchOnYouTube:         { category: 'engagement', meta: { type: 'custom', name: 'WatchOnYouTube' } },
  RelatedVideoClick:      { category: 'engagement', meta: null },
  Search:                 { category: 'engagement', meta: { type: 'standard', name: 'Search' } },
  CountrySelected:        { category: 'engagement', meta: null },
  CategorySelected:       { category: 'engagement', meta: null },
  Share:                  { category: 'engagement', meta: { type: 'custom', name: 'Share' } },
  RegisterStarted:        { category: 'engagement', meta: null },

  // Lead / conversion
  RegistrationStarted:            { category: 'conversion', meta: { type: 'custom', name: 'RegistrationStarted' } },
  RegistrationCompleted:          { category: 'conversion', meta: { type: 'standard', name: 'CompleteRegistration' } },
  PublisherRegistrationStarted:   { category: 'conversion', meta: null },
  PublisherRegistrationCompleted: { category: 'conversion', meta: { type: 'standard', name: 'SubmitApplication' } },
  YouTubeSubmissionStarted:       { category: 'conversion', meta: null },
  YouTubeSubmissionCompleted:     { category: 'conversion', meta: { type: 'standard', name: 'SubmitApplication' } },
  ContactSubmitted:               { category: 'conversion', meta: { type: 'standard', name: 'Contact' } },
};

const EVENT_NAMES = Object.keys(EVENTS);

// A "lead" is a completed, meaningful conversion -- never a page visit.
const LEAD_EVENTS = [
  'RegistrationCompleted',
  'PublisherRegistrationCompleted',
  'YouTubeSubmissionCompleted',
  'ContactSubmitted',
];

const CLICK_EVENTS = [
  'NewsArticleClick', 'ExternalPublisherClick', 'YouTubeClick', 'VideoThumbnailClick',
  'WatchOnYouTube', 'RelatedVideoClick',
];

const VIDEO_INTERACTION_EVENTS = ['VideoThumbnailClick', 'YouTubePlay', 'YouTubeWatch', 'YouTubeClick', 'WatchOnYouTube'];

const OUTBOUND_YOUTUBE_EVENTS = ['YouTubeClick', 'WatchOnYouTube'];

// "Website engagement" for the funnel: any interaction beyond the video
// itself (video events are their own stage).
const SITE_ENGAGEMENT_EVENTS = [
  'NewsArticleClick', 'ExternalPublisherClick', 'RelatedVideoClick', 'Search',
  'CountrySelected', 'CategorySelected', 'Share', 'CountryPageView', 'PublisherPageView',
];

module.exports = {
  EVENTS,
  EVENT_NAMES,
  LEAD_EVENTS,
  CLICK_EVENTS,
  VIDEO_INTERACTION_EVENTS,
  OUTBOUND_YOUTUBE_EVENTS,
  SITE_ENGAGEMENT_EVENTS,
};
