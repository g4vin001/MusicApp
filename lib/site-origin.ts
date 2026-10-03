import { variable } from './server';

// Use an operator-controlled origin rather than forwarded request headers.
export function parseSiteOrigin(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return new URL(url.origin);
  } catch {
    return null;
  }
}

export function siteOrigin(): URL | null {
  return parseSiteOrigin(variable('PUBLIC_SITE_URL'));
}
