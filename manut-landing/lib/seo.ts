import type { Metadata } from 'next';

import { siteConfig } from '@/lib/site';

/** Primary landing metadata — tuned for SEO snippet length (~155 chars). */
export const homeDescription =
  'Manut is the free, open-source AI workspace for Gen Z teams: docs, databases, whiteboards, and a real multi-model agent. Self-host or use cloud at manut.xyz.';

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name} — ${siteConfig.tagline}`,
      template: `%s — ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: [...siteConfig.keywords],
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.organization.legalName, url: siteConfig.url }],
    creator: siteConfig.organization.legalName,
    publisher: siteConfig.organization.legalName,
    category: 'technology',
    alternates: {
      canonical: siteConfig.url,
      languages: { 'en-US': siteConfig.url },
    },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      title: `${siteConfig.name} — ${siteConfig.tagline}`,
      description: homeDescription,
      url: siteConfig.url,
      locale: siteConfig.locale,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: siteConfig.ogImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteConfig.name} — ${siteConfig.tagline}`,
      description: homeDescription,
      site: siteConfig.twitter,
      creator: siteConfig.twitter,
      images: ['/opengraph-image'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    icons: {
      icon: '/icon.png',
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.webmanifest',
    formatDetection: { email: false, address: false, telephone: false },
    other: {
      'apple-mobile-web-app-title': siteConfig.name,
    },
  };
}

export function buildHomeMetadata(): Metadata {
  return {
    title: `${siteConfig.name} — AI workspace for docs, tasks & teams`,
    description: homeDescription,
    alternates: { canonical: siteConfig.url },
    openGraph: {
      title: `${siteConfig.name} — AI workspace for docs, tasks & teams`,
      description: homeDescription,
      url: siteConfig.url,
    },
  };
}
