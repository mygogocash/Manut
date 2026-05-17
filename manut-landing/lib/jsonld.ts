import { faqs, siteConfig } from '@/lib/site';

interface Schema {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

function organizationSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    legalName: siteConfig.organization.legalName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/apple-icon.png`,
    sameAs: [siteConfig.github],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: siteConfig.email,
      availableLanguage: ['en'],
    },
  };
}

function websiteSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: siteConfig.name },
  };
}

function softwareApplicationSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    operatingSystem: 'Web, macOS, Windows, Linux',
    applicationCategory: 'BusinessApplication',
    description: siteConfig.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '1240',
    },
  };
}

function faqSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

export function allSchemas(): ReadonlyArray<Schema> {
  return [
    organizationSchema(),
    websiteSchema(),
    softwareApplicationSchema(),
    faqSchema(),
  ];
}
