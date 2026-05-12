import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const sections = ['features', 'ai', 'pricing', 'faq'];
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
  ];
}
