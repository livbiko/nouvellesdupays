// Browser mirror of packages/shared/src/trackingEvents.js (apps/web is a
// standalone Next.js project and can't import the workspace package). The
// API test suite asserts both lists are identical, and POST /api/track
// rejects any name not in the server catalogue.

export const EVENT_NAMES = [
  // Page / traffic
  'PageView',
  'LandingPageView',
  'CountryPageView',
  'NewsArticleView',
  'PublisherPageView',
  'YouTubeLandingPageView',
  // Engagement
  'NewsArticleClick',
  'ExternalPublisherClick',
  'YouTubeClick',
  'YouTubePlay',
  'YouTubeWatch',
  'VideoThumbnailClick',
  'WatchOnYouTube',
  'RelatedVideoClick',
  'Search',
  'CountrySelected',
  'CategorySelected',
  'Share',
  'RegisterStarted',
  // Lead / conversion
  'RegistrationStarted',
  'RegistrationCompleted',
  'PublisherRegistrationStarted',
  'PublisherRegistrationCompleted',
  'YouTubeSubmissionStarted',
  'YouTubeSubmissionCompleted',
  'ContactSubmitted',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

// How each event is forwarded to the Meta Pixel (null = first-party only).
// Must match the `meta` mapping in the shared catalogue so the Pixel and
// the Conversions API report the same event name for deduplication.
export const META_EVENT_MAP: Partial<Record<EventName, { type: 'standard' | 'custom'; name: string }>> = {
  PageView: { type: 'standard', name: 'PageView' },
  CountryPageView: { type: 'standard', name: 'ViewContent' },
  YouTubeLandingPageView: { type: 'standard', name: 'ViewContent' },
  YouTubeClick: { type: 'custom', name: 'YouTubeClick' },
  YouTubePlay: { type: 'custom', name: 'YouTubePlay' },
  WatchOnYouTube: { type: 'custom', name: 'WatchOnYouTube' },
  Search: { type: 'standard', name: 'Search' },
  Share: { type: 'custom', name: 'Share' },
  RegistrationStarted: { type: 'custom', name: 'RegistrationStarted' },
  RegistrationCompleted: { type: 'standard', name: 'CompleteRegistration' },
  PublisherRegistrationCompleted: { type: 'standard', name: 'SubmitApplication' },
  YouTubeSubmissionCompleted: { type: 'standard', name: 'SubmitApplication' },
  ContactSubmitted: { type: 'standard', name: 'Contact' },
};
