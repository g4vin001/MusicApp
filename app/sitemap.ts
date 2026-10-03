import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  return ['', '/find', '/for-creators', '/how-it-works', '/privacy', '/terms', '/support']
    .map(path => ({ url: new URL(path || '/', origin).href }));
}
