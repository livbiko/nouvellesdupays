import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from '@/i18n';
import { LOCALE_HEADER, routeYoutube } from '@/i18n/routing';

// CR-2026-11-26-01: language addresses of the /youtube pages (rules in routeYoutube). Runs only on /youtube and
// /<lang>/youtube paths; everything else of the site is untouched.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const route = routeYoutube(pathname, search, request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get('accept-language'));
  if (route.action === 'redirect') {
    return NextResponse.redirect(new URL(route.to, request.url), route.permanent ? 308 : 307);
  }
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, route.locale);
  if (route.action === 'rewrite') {
    const url = request.nextUrl.clone();
    url.pathname = route.path;
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/youtube', '/youtube/:path*', '/:lang([a-z]{2})/youtube', '/:lang([a-z]{2})/youtube/:path*'],
};
