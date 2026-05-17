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
    'Manut is the open-source AI workspace for fast teams: docs, databases, whiteboards, and a permissioned multi-model agent. Free self-host or cloud at manut.xyz.',
  keywords: [
    'AI workspace',
    'open source workspace',
    'Notion alternative',
    'AFFiNE fork',
    'team docs and tasks',
    'AI agent for work',
    'multi-model AI',
    'collaborative whiteboard',
    'self-hosted notes',
    'productivity software',
    'Gen Z productivity',
    'knowledge base',
    'project management',
    'real-time collaboration',
    'Manut',
    'manut.xyz',
  ],
  url: 'https://manut.xyz',
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
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
    { href: '/security', label: 'Security' },
    {
      href: 'https://github.com/gogocash-deploy/manut/blob/main/LICENSE',
      label: 'MIT License',
    },
  ],
};

export const plans: ReadonlyArray<Plan> = [
  {
    id: 'community',
    name: 'Community',
    priceMonthly: 0,
    priceAnnual: 0,
    blurb:
      'Self-host the full Manut workspace. Unlimited seats, every feature, MIT licensed.',
    features: [
      'Unlimited workspaces and members',
      'Docs, databases, whiteboards',
      'CRDT collaboration and offline sync',
      'Self-hosted on your own infrastructure',
      'MIT license — no vendor lock-in',
      'Community Discord support',
    ],
    cta: {
      href: 'https://github.com/gogocash-deploy/manut#self-host',
      label: 'Self-host on GitHub',
    },
  },
  {
    id: 'cloud',
    name: 'Cloud Pro',
    priceMonthly: 10,
    priceAnnual: 8,
    blurb:
      'Hosted Manut with the full AI agent, multi-model routing, and team management.',
    featured: true,
    features: [
      'Everything in Community',
      'Hosted by us — zero ops',
      'Multi-model AI agent (Gemini, Claude, Llama)',
      'Read / Edit / Full Agent modes',
      'AI Auto Tag and database autofill',
      'SSO via Google, GitHub, and email',
      'Priority email support',
    ],
    cta: { href: '/sign-in', label: 'Start free trial' },
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
      'Everything in Cloud Pro',
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
      'Manut is an open-source AI workspace at manut.xyz with docs, databases, whiteboards, and a multi-model AI agent. MIT licensed; self-host or use cloud.',
  },
  {
    question: 'Is Manut free?',
    answer:
      'Yes. The Community edition is $0 to self-host with unlimited seats. Cloud Pro offers a free trial at manut.xyz/sign-in with hosted AI included.',
  },
  {
    question: 'How is Manut different from Notion?',
    answer:
      'Manut is open-source, offers full self-hosting, built-in infinite whiteboards, and an AI agent with explicit Read / Edit / Agent modes across Gemini, Claude, and Llama.',
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
      'Create a workspace at https://manut.xyz/sign-in or deploy from GitHub for self-host.',
  },
];

export const faqs: ReadonlyArray<FaqItem> = [
  {
    question: 'Is Manut really free for self-hosting?',
    answer:
      'Yes. Manut is MIT licensed, every feature works, and there is no seat cap. Run it on your own server, your laptop, or a $5 VPS. You own the data and the deployment.',
  },
  {
    question: 'How is Manut different from AFFiNE?',
    answer:
      'Manut is a friendly fork of AFFiNE. We track the upstream canary branch closely and add our own AI write tools, multi-model auto-routing on Vertex, calendar integrations, and an unlimited-seat policy on top.',
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
      'Every workspace can export to Markdown, JSON, or HTML. The self-hosted build runs against plain Postgres, so a pg_dump is always your escape hatch.',
  },
  {
    question: 'Is Manut good for students and startups?',
    answer:
      'Yes. Unlimited self-hosted seats, fast AI for summaries and task boards, and no vendor lock-in — popular with lean teams who want one tool instead of five subscriptions.',
  },
  {
    question: 'Does Manut work with Google Calendar?',
    answer:
      'Yes. Connect Google Calendar or CalDAV to see events beside docs and let the AI prep agendas.',
  },
];
