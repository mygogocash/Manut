import Link from 'next/link';

import { footerNav, siteConfig } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card py-16">
      <div className="container-prose">
        <div className="grid gap-12 md:grid-cols-[260px_1fr] md:gap-20">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
              aria-label={`${siteConfig.name} home`}
            >
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-md bg-foreground font-bold text-background"
              >
                S
              </span>
              {siteConfig.name}
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI workspace for teams who take ownership of their data and
              their thinking.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {Object.entries(footerNav).map(([heading, items]) => (
              <div key={heading}>
                <div className="kicker mb-4">{heading}</div>
                <ul className="space-y-2.5">
                  {items.map(item => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        {...(item.href.startsWith('http')
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.name} · GoGoCash · Built on{' '}
            <Link
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              AFFiNE
            </Link>{' '}
            (MIT)
          </p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <Link
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Discord
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              X / Twitter
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
