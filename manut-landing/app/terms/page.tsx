import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { SiteFooter } from '@/components/sections/site-footer';
import { SiteNav } from '@/components/site-nav';
import { siteConfig } from '@/lib/site';

const lastUpdated = 'May 24, 2026';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms of Service for ${siteConfig.name} — the AI cloud workspace at ${siteConfig.domain}.`,
  alternates: { canonical: `${siteConfig.url}/terms` },
  robots: { index: true, follow: true },
};

interface Section {
  id: string;
  heading: string;
  body: ReadonlyArray<string>;
}

const SECTIONS: ReadonlyArray<Section> = [
  {
    id: 'agreement',
    heading: '1. Agreement to these terms',
    body: [
      `These Terms of Service ("Terms") form a binding agreement between you and GoGoCash ("Manut", "we", "us"), governing your access to and use of ${siteConfig.name} at ${siteConfig.domain} (the "Service").`,
      'By creating an account, signing in, or otherwise using the Service, you agree to these Terms. If you do not agree, do not use the Service.',
    ],
  },
  {
    id: 'eligibility',
    heading: '2. Eligibility and accounts',
    body: [
      'You must be at least 13 years old (or the minimum age of digital consent in your country) to use the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization.',
      'You are responsible for everything that happens under your account, including keeping credentials secure. Notify us immediately at hello@manut.xyz if you suspect unauthorized access.',
    ],
  },
  {
    id: 'plans',
    heading: '3. Plans, billing, and cancellation',
    body: [
      'The Service is offered in Free, Pro, and Enterprise tiers. Free tier limits (storage, AI usage) are documented on our pricing page and may change with reasonable notice.',
      'Paid plans are billed in advance on a monthly or annual cycle. You can cancel anytime; cancellation takes effect at the end of the current billing period. We do not provide pro-rated refunds for partial periods except where required by law.',
      'We may change pricing with at least 30 days notice; changes apply to the next billing cycle.',
    ],
  },
  {
    id: 'acceptable-use',
    heading: '4. Acceptable use',
    body: [
      'You may not use the Service to: (a) violate any law or third-party right; (b) upload content that is unlawful, defamatory, harassing, or infringing; (c) send spam or malware; (d) attempt to disrupt the Service or other users; (e) reverse-engineer or resell the Service except as permitted by the open-source license of the underlying code.',
      'AI features are subject to our model providers’ usage policies. You agree not to use AI features to generate content that violates those policies or applicable law.',
    ],
  },
  {
    id: 'content',
    heading: '5. Your content',
    body: [
      'You retain all ownership rights to the content you create or upload to the Service ("Your Content"). You grant us a worldwide, non-exclusive license to host, process, and display Your Content solely as needed to operate, secure, and improve the Service for you.',
      'You are responsible for ensuring you have the rights to upload Your Content, including any personal data of others contained in it.',
    ],
  },
  {
    id: 'ai',
    heading: '6. AI features',
    body: [
      'The Service includes AI features powered by third-party model providers (Google Vertex, Anthropic, and others). Prompts and completions are processed by those providers under their respective terms.',
      'AI output may be inaccurate, biased, or otherwise unsuitable for your purposes. You are responsible for reviewing AI output before relying on it. Do not submit content to AI features that you are not authorized to share with third-party processors.',
    ],
  },
  {
    id: 'google-oauth',
    heading: '7. Google OAuth integrations',
    body: [
      'Manut offers optional Google OAuth integrations for sign-in and for workspace features that use Gmail, Drive, and Calendar. You authorize only the Google scopes shown on the consent screen, and Manut uses Google user data only to provide the feature you selected.',
      'Google sign-in uses your Google profile and email to authenticate your account. Gmail, Drive, and Calendar integrations may read selected messages, files, calendars, and events so Manut can search, summarize, display, or import that information into your workspace at your request.',
      'You can disconnect Google integrations in Manut settings or revoke Manut access from your Google Account. Disconnecting an integration stops future API access but does not automatically delete workspace content you already imported; you can delete that content from your workspace.',
      'You are responsible for ensuring that you have the right to connect any Google account and import or process any Google user data through Manut.',
    ],
  },
  {
    id: 'privacy',
    heading: '8. Privacy',
    body: [
      `Our ${'Privacy Policy'} explains how we collect, use, and protect personal data. By using the Service, you agree to the Privacy Policy.`,
    ],
  },
  {
    id: 'termination',
    heading: '9. Termination',
    body: [
      'You can stop using the Service and delete your account at any time. We may suspend or terminate accounts that violate these Terms, or where required by law.',
      'On termination, your right to use the Service ends. We may retain backups for a limited period as described in our Privacy Policy.',
    ],
  },
  {
    id: 'warranty',
    heading: '10. Disclaimer of warranties',
    body: [
      'The Service is provided "as is" and "as available" without warranties of any kind. We do not warrant that the Service will be uninterrupted, error-free, or secure, or that AI outputs will be accurate.',
    ],
  },
  {
    id: 'liability',
    heading: '11. Limitation of liability',
    body: [
      'To the maximum extent permitted by law, Manut and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data, arising from your use of the Service.',
      'Our aggregate liability for direct damages arising from the Service is limited to the amount you paid to us in the 12 months preceding the claim, or US $100, whichever is greater.',
    ],
  },
  {
    id: 'changes',
    heading: '12. Changes to these Terms',
    body: [
      'We may update these Terms from time to time. Material changes will be communicated by email or an in-product notice. Continued use of the Service after changes take effect constitutes acceptance.',
    ],
  },
  {
    id: 'contact',
    heading: '13. Contact',
    body: [`Questions about these Terms? Email ${siteConfig.email}.`],
  },
];

export default function TermsPage() {
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
                Terms of Service
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
                  href="/privacy"
                  className="text-foreground underline underline-offset-4 hover:no-underline"
                >
                  Privacy Policy
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
