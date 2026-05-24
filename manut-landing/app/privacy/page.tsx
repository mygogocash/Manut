import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { SiteFooter } from '@/components/sections/site-footer';
import { SiteNav } from '@/components/site-nav';
import { siteConfig } from '@/lib/site';

const lastUpdated = 'May 24, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy Policy for ${siteConfig.name} — how we handle personal data on the AI cloud workspace at ${siteConfig.domain}.`,
  alternates: { canonical: `${siteConfig.url}/privacy` },
  robots: { index: true, follow: true },
};

interface Section {
  id: string;
  heading: string;
  body: ReadonlyArray<string>;
}

const SECTIONS: ReadonlyArray<Section> = [
  {
    id: 'overview',
    heading: '1. Overview',
    body: [
      `This Privacy Policy explains how GoGoCash ("Manut", "we", "us") collects, uses, and shares personal data when you use ${siteConfig.name} at ${siteConfig.domain} (the "Service").`,
      'We aim to collect only what we need, be specific about why, and give you meaningful control. Questions: email hello@manut.xyz.',
    ],
  },
  {
    id: 'data-we-collect',
    heading: '2. Data we collect',
    body: [
      'Account data: name, email, password hash, OAuth tokens for connected providers (e.g., Google). Used to authenticate you and personalize the workspace.',
      'Workspace content: docs, databases, whiteboard artifacts, file uploads. Stored encrypted at rest. We do not read your content except as needed to provide the Service (e.g., AI features you trigger, indexing for search you opted into).',
      'Usage telemetry: page views, feature interactions, AI prompts and outputs, error reports. Used to improve the Service and debug issues. You can opt out of optional telemetry in account settings.',
      'Billing data: card details are handled by our payment processor (Stripe) and are not stored on our servers. We retain transaction records for accounting and tax purposes.',
      'Device and log data: IP address, browser type, timestamps. Used for security, fraud prevention, and operational logs.',
    ],
  },
  {
    id: 'google-user-data',
    heading: '3. Google user data and OAuth scopes',
    body: [
      'When you choose to sign in with Google or connect a Google integration, Manut requests only the Google user data needed to provide the feature you selected. Google sign-in uses openid, email, and profile so we can authenticate you, show your account identity, and protect your workspace.',
      'Gmail import and AI Gmail search use https://www.googleapis.com/auth/gmail.readonly for read-only access to message metadata and message content that you explicitly ask Manut to search, summarize, or import into your workspace. Manut does not send email, modify email, delete email, or manage Gmail settings.',
      'Google Drive import uses https://www.googleapis.com/auth/drive.readonly for read-only access to file metadata and file content that you select for preview, search, or import. Manut does not create, modify, share, or delete files in your Google Drive.',
      'Google Calendar uses https://www.googleapis.com/auth/calendar.readonly for read-only access to calendars and events so Manut can show upcoming meetings beside your docs and let AI help prepare agendas. Manut does not create, modify, invite attendees to, or delete calendar events through this scope.',
      'We store Google OAuth access tokens and refresh tokens encrypted and use them only to call the Google APIs needed for the connected feature. You can revoke Google access from your Google Account permissions page or disconnect Google integrations in Manut settings.',
      'We do not sell Google user data, share it with advertisers, or use it for cross-context behavioral advertising. We do not use Google user data to train generalized AI models. We may process selected Google user data through AI providers only when you ask Manut to summarize, search, draft from, or import that data, and only to provide that requested feature.',
      'Manut use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    id: 'legal-bases',
    heading: '4. Legal bases (GDPR)',
    body: [
      'We process personal data on the following legal bases under the GDPR: (a) contract — to provide the Service you signed up for; (b) legitimate interests — to secure the Service, prevent abuse, and improve features; (c) consent — for optional telemetry, marketing emails, and any AI features you opt into; (d) legal obligation — to comply with tax, accounting, and lawful requests.',
    ],
  },
  {
    id: 'ccpa',
    heading: '5. California residents (CCPA / CPRA)',
    body: [
      'If you are a California resident, you have the right to know what personal information we collect about you, request deletion, correct inaccuracies, and opt out of "sale" or "sharing" of personal information. We do not sell personal information.',
      'Submit a request by emailing privacy@manut.xyz from the address associated with your account.',
    ],
  },
  {
    id: 'ai',
    heading: '6. AI processing',
    body: [
      'When you use AI features, your prompts and the relevant workspace context are sent to third-party model providers (Google Vertex AI, Anthropic, and others) for inference. These providers process your data under their own terms; we have configured them to not retain or train on your prompts where that option is available.',
      'AI outputs are stored alongside your workspace content. You can delete AI conversations and their outputs at any time.',
    ],
  },
  {
    id: 'sharing',
    heading: '7. How we share data',
    body: [
      'We share data only with: (a) service providers acting on our behalf under contract (hosting, payments, analytics, AI model providers, email delivery); (b) collaborators in your own workspace (the people you invite); (c) authorities when legally required.',
      'We do not sell personal data. We do not share data with advertisers.',
    ],
  },
  {
    id: 'retention',
    heading: '8. Retention',
    body: [
      'We keep your workspace content for as long as your account is active. After you delete your account, your workspace content and imported Google user data are deleted or anonymized within 30 days, with limited exceptions for legal retention obligations and disaster-recovery backups (which are purged within 90 days). Google user data imported into workspace content follows the same retention schedule unless you delete it sooner.',
    ],
  },
  {
    id: 'security',
    heading: '9. Security',
    body: [
      'We encrypt data in transit (TLS 1.2+) and at rest. Access to production systems is restricted, logged, and audited. We perform regular reviews of access and security posture.',
      'No system is perfectly secure. If we discover a breach that affects your data, we will notify you in accordance with applicable law.',
    ],
  },
  {
    id: 'international',
    heading: '10. International transfers',
    body: [
      'We host the Service in Google Cloud (asia-southeast1 primary, with additional regions for AI inference). If you access the Service from outside those regions, data will be transferred internationally. Where required, we use Standard Contractual Clauses or equivalent safeguards.',
    ],
  },
  {
    id: 'your-rights',
    heading: '11. Your rights',
    body: [
      'Subject to applicable law, you have the right to access, correct, delete, restrict, or port your personal data, and to object to processing. To exercise these rights, email privacy@manut.xyz.',
      'You also have the right to lodge a complaint with a data protection authority in your jurisdiction.',
    ],
  },
  {
    id: 'children',
    heading: '12. Children',
    body: [
      'The Service is not intended for children under 13 (or under the age of digital consent in your country). We do not knowingly collect personal data from children. If you believe a child has provided personal data to us, email privacy@manut.xyz and we will delete it.',
    ],
  },
  {
    id: 'changes',
    heading: '13. Changes to this Policy',
    body: [
      'We may update this Policy from time to time. Material changes will be announced by email or an in-product notice at least 30 days before they take effect.',
    ],
  },
  {
    id: 'contact',
    heading: '14. Contact',
    body: [
      `Privacy questions: privacy@manut.xyz. General contact: ${siteConfig.email}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main
        id="main"
        className="flex min-w-0 flex-col overflow-x-clip pt-[calc(5.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(7.5rem+env(safe-area-inset-top,0px))]"
      >
        <section className="section-pad relative">
          <div className="container-prose max-w-3xl">
            <Reveal>
              <p className="kicker kicker-line">Legal</p>
              <h1 className="mt-4 text-balance text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                Privacy Policy
              </h1>
              <p className="mt-4 text-sm text-muted-foreground">
                Last updated: {lastUpdated} · This is a draft pending legal
                review. Material changes will be communicated before they take
                effect.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <nav
                aria-label="On this page"
                className="mt-10 rounded-2xl border border-border bg-card/60 p-5"
              >
                <div className="kicker mb-3">On this page</div>
                <ol className="grid gap-1.5 sm:grid-cols-2">
                  {SECTIONS.map(s => (
                    <li key={s.id}>
                      <Link
                        href={`#${s.id}`}
                        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {s.heading}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-10 space-y-12">
                {SECTIONS.map(section => (
                  <article
                    key={section.id}
                    id={section.id}
                    aria-labelledby={`${section.id}-heading`}
                    className="scroll-mt-24"
                  >
                    <h2
                      id={`${section.id}-heading`}
                      className="text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold tracking-tight text-foreground"
                    >
                      {section.heading}
                    </h2>
                    <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
                      {section.body.map((paragraph, i) => (
                        <p key={i} className="text-pretty">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Reveal>

            <Reveal delay={280}>
              <p className="mt-16 text-sm text-muted-foreground">
                See also our{' '}
                <Link
                  href="/terms"
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                >
                  Terms of Service
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
