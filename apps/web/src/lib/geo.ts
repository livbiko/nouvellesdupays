const STORAGE_KEY = 'nouvellesdupays:country';

export function getSavedCountry(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage can throw in private-browsing/blocked-storage contexts
  }
}

export function saveCountry(iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, iso);
  } catch {
    // ignore -- not critical if the preference can't persist
  }
}

/**
 * Best-effort detection of the visitor's country, in priority order:
 * IP geolocation, then browser locale region subtag, then timezone-derived
 * country (only for unambiguous single-country timezones). Returns an ISO
 * code or null -- never throws, since this must never block the globe from
 * rendering.
 */
export async function detectVisitorCountry(): Promise<string | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.country_code === 'string' && data.country_code.length === 2) {
        return data.country_code.toUpperCase();
      }
    }
  } catch {
    // IP geolocation blocked/failed (ad-blocker, offline, rate limit) -- fall through
  }

  try {
    const locale = navigator.language || navigator.languages?.[0];
    const region = locale?.split('-')[1];
    if (region && region.length === 2) return region.toUpperCase();
  } catch {
    // ignore
  }

  return null;
}
