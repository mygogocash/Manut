export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  priceLabel?: string;
  blurb: string;
  features: ReadonlyArray<string>;
  featured?: boolean;
  cta: { href: string; label: string };
}

interface NavItem {
  href: string;
  label: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

export const siteConfig = {
  name: 'Manut',
  tagline: 'The AI workspace that actually ships with you',
  description:
    'Manut is the AI cloud workspace for fast teams: docs, databases, whiteboards, and a permissioned multi-model agent. Start free in 30 seconds at manut.xyz.',
  keywords: [
    'AI workspace',
    'cloud AI workspace',
    'Notion alternative',
    'team docs and tasks',
    'AI agent for work',
    'multi-model AI',
    'collaborative whiteboard',
    'productivity software',
    'Gen Z productivity',
    'knowledge base',
    'project management',
    'real-time collaboration',
    'Manut',
    'manut.xyz',
  ],
  url: 'https://manut.xyz',
  appUrl: 'https://app.manut.xyz',
  domain: 'manut.xyz',
  locale: 'en_US',
  twitter: '@manut',
  github: 'https://github.com/gogocash-deploy/manut',
  email: 'hello@manut.xyz',
  ogImageAlt:
    'Manut — the open-source AI workspace that thinks with you. Docs, databases, whiteboards, and a real agent.',
  organization: {
    legalName: 'GoGoCash',
  },
} as const;

export const primaryNav: ReadonlyArray<NavItem> = [
  { href: '#features', label: 'Features' },
  { href: '#ai', label: 'AI' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export const footerNav: Record<string, ReadonlyArray<NavItem>> = {
  Product: [
    { href: '#features', label: 'Features' },
    { href: '#ai', label: 'AI agent' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ],
  Resources: [
    { href: 'https://github.com/gogocash-deploy/manut', label: 'GitHub' },
    {
      href: 'https://github.com/gogocash-deploy/manut/releases',
      label: 'Changelog',
    },
    {
      href: 'https://github.com/gogocash-deploy/manut#readme',
      label: 'Documentation',
    },
    { href: '/llms.txt', label: 'LLMs.txt (AEO)' },
    { href: '#faq', label: 'Help center' },
  ],
  Company: [
    { href: 'mailto:hello@manut.xyz', label: 'Contact' },
    { href: 'mailto:careers@manut.xyz', label: 'Careers' },
    { href: 'mailto:press@manut.xyz', label: 'Press' },
    { href: 'mailto:partners@manut.xyz', label: 'Partners' },
  ],
  Legal: [
    { href: '/privacy-policy', label: 'Privacy' },
    { href: '/terms-of-service', label: 'Terms' },
    { href: '/legal/data-deletion-instructions', label: 'Data deletion' },
    { href: '/security', label: 'Security' },
    {
      href: 'https://github.com/gogocash-deploy/manut/blob/main/LICENSE',
      label: 'MIT License',
    },
  ],
};

export const plans: ReadonlyArray<Plan> = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: 0,
    blurb:
      'Everything you need to spin up a workspace. Unlimited members, real AI included.',
    features: [
      'Unlimited workspace members',
      '2 GB storage',
      '$5 of AI usage per month',
      'Docs, databases, whiteboards',
      'CRDT collaboration and offline sync',
      'Community support',
    ],
    cta: {
      href: siteConfig.appUrl,
      label: 'Start free',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 20,
    priceAnnual: 16,
    blurb:
      'For teams that live in Manut. Higher AI cap, more storage, premium routing.',
    featured: true,
    features: [
      'Everything in Free',
      '100 GB storage',
      '$50 of AI usage per month (configurable)',
      'Multi-model AI agent (Gemini, Claude, Llama)',
      'Read / Edit / Full Agent modes',
      'SSO via Google, GitHub, and email',
      'Priority email support',
    ],
    cta: { href: siteConfig.appUrl, label: 'Start free trial' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 0,
    priceAnnual: 0,
    priceLabel: 'Custom',
    blurb:
      'For teams with hard security, compliance, and procurement requirements.',
    features: [
      'Everything in Pro',
      'SAML SSO and SCIM provisioning',
      'Audit logs and access controls',
      'HIPAA-ready handling, SOC 2 posture',
      'Dedicated environment and SLA',
      'White-glove onboarding',
    ],
    cta: { href: 'mailto:sales@manut.xyz', label: 'Talk to sales' },
  },
];

export const trustLogos: ReadonlyArray<string> = [
  'GoGoCash',
  'DataCo Asia',
  'MedTech',
  'BuildFast',
  'Bangkok Bank Labs',
  'Northstar AI',
];

export const stats = {
  stars: '40k+',
  release: 'v1.12.1',
};

/** Short factual blocks for AEO / answer engines (also rendered on-page). */
export const quickAnswers: ReadonlyArray<FaqItem> = [
  {
    question: 'What is Manut?',
    answer:
      'Manut is an AI cloud workspace at manut.xyz with docs, databases, whiteboards, and a multi-model AI agent. Built in the open, hosted by us.',
  },
  {
    question: 'Is Manut free?',
    answer:
      'Yes. The Free tier includes unlimited members, 2 GB of storage, and $5 of AI usage per month. Upgrade to Pro at $20 per user / month for higher limits.',
  },
  {
    question: 'How is Manut different from Notion?',
    answer:
      'Manut ships a real multi-model AI agent with explicit Read / Edit / Full Agent modes, infinite whiteboards, and unlimited team members on the Free tier.',
  },
  {
    question: 'Which AI models does Manut use?',
    answer:
      'Gemini 2.5 Flash and Pro, Claude Sonnet and Opus, and Llama — routed on Google Vertex with auto-selection per task.',
  },
  {
    question: 'Can I use Manut offline?',
    answer:
      'Yes. CRDT editing works offline; changes sync when you reconnect.',
  },
  {
    question: 'Where do I sign up?',
    answer:
      'Create a free workspace at https://app.manut.xyz — Google or email, 30 seconds to your first doc.',
  },
];

export const faqs: ReadonlyArray<FaqItem> = [
  {
    question: 'How do I get started?',
    answer:
      'Sign up at app.manut.xyz with Google or email. Your workspace is ready in 30 seconds — no credit card, no setup wizard you can’t skip.',
  },
  {
    question: 'What’s included in the Free tier?',
    answer:
      'Unlimited workspace members, 2 GB of storage, $5 of AI usage per month, every editor feature, and the full multi-model AI agent. No seat cap, no premium-feature paywall on the basics.',
  },
  {
    question: 'How is Manut different from AFFiNE?',
    answer:
      'Manut is a friendly fork of AFFiNE focused on the cloud product. We track the upstream canary branch closely and add our own AI write tools, multi-model auto-routing on Vertex, calendar integrations, and an unlimited-member Free tier on top.',
  },
  {
    question: 'Which AI models does Manut use?',
    answer:
      'Gemini 2.5 Flash and Pro, Claude Sonnet and Opus, and Llama 3.1 / 4 — all on Google Vertex AI. The auto-router picks the right model per task: fast tiers for tagging, frontier tiers for reasoning.',
  },
  {
    question: 'Can the AI edit my documents without permission?',
    answer:
      'No. The Mode picker controls what the AI can do. Read-only mode lets it summarize but never write. Edit mode lets it modify the active doc. Full Agent mode lets it create docs and update databases. You pick before each conversation.',
  },
  {
    question: 'Does Manut work offline?',
    answer:
      'Yes. The editor is CRDT-based, so you can keep writing offline and changes merge cleanly when you reconnect. Real-time presence and cursors come back automatically.',
  },
  {
    question: 'How do I move my data out?',
    answer:
      'Every workspace can export to Markdown, JSON, or HTML. Your data is yours — export the whole workspace anytime, no friction.',
  },
  {
    question: 'Is Manut good for students and startups?',
    answer:
      'Yes. Unlimited workspace members on the Free tier, fast AI for summaries and task boards — popular with lean teams who want one tool instead of five subscriptions.',
  },
  {
    question: 'Does Manut work with Google Calendar?',
    answer:
      'Yes. Connect Google Calendar or CalDAV to see events beside docs and let the AI prep agendas.',
  },
];
