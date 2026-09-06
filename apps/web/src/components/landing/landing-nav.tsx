import Link from "next/link";

import { ManutLogo } from "@/components/landing/manut-logo";

export function LandingNav() {
  return (
    <header className="ml-nav">
      <div className="ml-nav-inner">
        <Link href="/welcome" className="ml-brand">
          <ManutLogo className="ml-brand-mark" />
          <span className="ml-wordmark">Manut</span>
        </Link>

        <nav className="ml-nav-links" aria-label="Primary">
          <a href="#product">Product</a>
          <a href="#modules">Modules</a>
          <a href="#security">Security</a>
        </nav>

        <div className="ml-nav-actions">
          <Link href="/sign-in" className="ml-link-ghost">
            Sign in
          </Link>
          <Link href="/sign-in" className="ml-btn-primary">
            Open Manut
          </Link>
        </div>
      </div>
    </header>
  );
}
