import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/insights', '/licenses'] },
    ...(origin ? { sitemap: new URL('/sitemap.xml', origin).href } : {}),
  };
}
