import type { Metadata } from 'next';
import Link from 'next/link';

import { Reveal } from '@/components/reveal';
import { SiteFooter } from '@/components/sections/site-footer';
import { SiteNav } from '@/components/site-nav';
import { siteConfig } from '@/lib/site';

const lastUpdated = 'June 1, 2026';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions',
  description: `How to request deletion of ${siteConfig.name} account, workspace, and connected social integration data.`,
  alternates: {
    canonical: `${siteConfig.url}/legal/data-deletion-instructions`,
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  {
    heading: '1. Disconnect provider access',
    body: 'Open Manut workspace settings, go to Integrations or Analytics connections, and disconnect Facebook, Instagram, Threads, TikTok, LINE, Google, or any other connected provider you no longer want Manut to access. You can also revoke Manut directly from the provider account settings.',
  },
  {
    heading: '2. Delete imported workspace content',
    body: 'Delete any docs, databases, messages, files, analytics records, or AI conversations that were created from connected provider data. Imported content follows the same retention controls as the rest of your workspace.',
  },
  {
    heading: '3. Request account or provider-data deletion',
    body: 'Email privacy@manut.xyz from the email address on your Manut account. Include your workspace name, the provider to delete, and whether you want provider data only or your full account deleted.',
  },
  {
    heading: '4. Verification and completion',
    body: 'We may ask you to verify ownership before deletion. After verification, active records are deleted or anonymized within 30 days unless a longer retention period is required by law, abuse prevention, billing, or security obligations. Disaster-recovery backups are purged within 90 days.',
  },
] as const;

export default function DataDeletionInstructionsPage() {
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
                Data Deletion Instructions
              </h1>
              <p className="mt-4 text-sm text-muted-foreground">
                Last updated: {lastUpdated} · Use this page to request deletion
                of Manut account, workspace, and connected provider data.
              </p>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-10 rounded-2xl border border-border bg-card/60 p-5 text-[15px] leading-relaxed text-muted-foreground">
                Manut can connect to Facebook, Instagram, Threads, TikTok, LINE,
                Google, and other providers only when you authorize the
                integration. Disconnecting an integration stops future access.
                Deletion requests remove active Manut records associated with
                the requested provider or account, subject to legal retention
                requirements.
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-10 space-y-10">
                {STEPS.map(step => (
                  <article key={step.heading}>
                    <h2 className="text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold tracking-tight text-foreground">
                      {step.heading}
                    </h2>
                    <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </article>
                ))}
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div className="mt-12 rounded-2xl border border-border bg-card/60 p-5 text-[15px] leading-relaxed text-muted-foreground">
                <p>
                  For privacy questions, email{' '}
                  <a
                    href="mailto:privacy@manut.xyz"
                    className="text-foreground underline underline-offset-4 hover:no-underline"
                  >
                    privacy@manut.xyz
                  </a>
                  .
                </p>
                <p className="mt-4">
                  See also our{' '}
                  <Link
                    href="/legal/privacy"
                    className="text-foreground underline underline-offset-4 hover:no-underline"
                  >
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/legal/terms"
                    className="text-foreground underline underline-offset-4 hover:no-underline"
                  >
                    Terms of Service
                  </Link>
                  .
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
