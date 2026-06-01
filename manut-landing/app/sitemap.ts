import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const sections = ['about-manut', 'features', 'ai', 'pricing', 'faq'];
  const legalPages = [
    'terms-of-service',
    'privacy-policy',
    'legal/terms',
    'legal/privacy',
    'legal/data-deletion-instructions',
  ];
  return [
    {
      url: siteConfig.url,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...sections.map(s => ({
      url: `${siteConfig.url}/#${s}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...legalPages.map(path => ({
      url: `${siteConfig.url}/${path}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];
}
