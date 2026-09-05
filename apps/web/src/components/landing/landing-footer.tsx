import Link from "next/link";

import { ManutLogo } from "./manut-logo";

export function LandingClose() {
  return (
    <section className="ml-close ml-container">
      <h2 className="ml-heading">
        Run the business from one quiet page.
      </h2>
      <p className="ml-body-lg">
        Sign in to Manut and give your team a single desk for people, money, and
        work.
      </p>
      <Link href="/sign-in" className="ml-btn-primary">
        Open Manut
      </Link>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="ml-footer">
      <div className="ml-container ml-footer-inner">
        <Link href="/welcome" className="ml-brand">
          <ManutLogo className="ml-brand-mark" />
          <span className="ml-wordmark">Manut</span>
        </Link>
        <p className="ml-footer-meta">
          Operations workspace for growing businesses.
        </p>
      </div>
    </footer>
  );
}
