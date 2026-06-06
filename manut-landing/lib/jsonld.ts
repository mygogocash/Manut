import { faqs, plans, quickAnswers, siteConfig, stats } from '@/lib/site';

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
    logo: `${siteConfig.url}/icon.png`,
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
    inLanguage: 'en-US',
    publisher: { '@type': 'Organization', name: siteConfig.name },
    potentialAction: {
      '@type': 'ReadAction',
      target: siteConfig.appUrl,
      name: 'Start free workspace',
    },
  };
}

function webPageSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${siteConfig.url}/#webpage`,
    url: siteConfig.url,
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    isPartOf: { '@id': `${siteConfig.url}/#website` },
    about: { '@type': 'SoftwareApplication', name: siteConfig.name },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['#hero-heading', '.seo-glance', '#faq-heading'],
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${siteConfig.url}/opengraph-image`,
    },
  };
}

function softwareApplicationSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: siteConfig.name,
    operatingSystem: 'Web, macOS, Windows, Linux',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'ProductivityApplication',
    description: siteConfig.description,
    url: siteConfig.url,
    downloadUrl: siteConfig.github,
    softwareVersion: stats.release,
    offers: plans.map(plan => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.priceMonthly,
      priceCurrency: 'USD',
      description: plan.blurb,
      url: plan.cta.href,
    })),
    featureList: [
      'Collaborative docs',
      'Databases and kanban',
      'Infinite whiteboard',
      'Multi-model AI agent',
      'Offline CRDT sync',
      'Real-time multiplayer editing',
    ],
  };
}

function faqEntities() {
  const seen = new Set<string>();
  const items = [...quickAnswers, ...faqs];
  return items
    .filter(f => {
      if (seen.has(f.question)) return false;
      seen.add(f.question);
      return true;
    })
    .map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    }));
}

function faqSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntities(),
  };
}

export function allSchemas(): ReadonlyArray<Schema> {
  return [
    organizationSchema(),
    websiteSchema(),
    webPageSchema(),
    softwareApplicationSchema(),
    faqSchema(),
  ];
}
