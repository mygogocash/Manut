import Link from "next/link";
import React from "react";

import { ManutLogo } from "@/components/landing/manut-logo";

export function LandingClose() {
  return (
    <section className="ml-close-section" aria-labelledby="close-heading">
      <div className="ml-container ml-close-inner">
        <span className="ml-tag">Start today</span>
        <h2 id="close-heading" className="ml-display ml-close-heading">
          Give your business one place to work.
        </h2>
        <p className="ml-body-lg ml-close-lead">
          Manut brings your team, approvals, and projects into one clear
          workspace— so your business can grow with less busywork.
        </p>
        <div className="ml-close-actions">
          <Link href="/sign-in" className="ml-btn-primary ml-btn-large">
            Open Manut
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ isHomepage = true }: { isHomepage?: boolean }) {
  const brandHref = isHomepage ? "/" : "/welcome";

  return (
    <footer className="ml-footer" role="contentinfo">
      <div className="ml-container ml-footer-grid">
        <div className="ml-footer-brand-col">
          <Link href={brandHref} className="ml-brand" aria-label="Manut Home">
            <ManutLogo className="ml-brand-mark" />
            <span className="ml-wordmark">Manut</span>
          </Link>
          <p className="ml-footer-tagline">
            Operations workspace for growing SMEs. People, money, and work in
            one place.
          </p>
          <span className="ml-footer-copyright">
            &copy; {new Date().getFullYear()} Manut. All rights reserved.
          </span>
        </div>

        <div className="ml-footer-links-col">
          <span className="ml-footer-heading">Product</span>
          <ul className="ml-footer-list" role="list">
            <li>
              <a href="#product">Interactive demo</a>
            </li>
            <li>
              <a href="#modules">People &amp; Leave</a>
            </li>
            <li>
              <a href="#modules">Spend &amp; Approvals</a>
            </li>
            <li>
              <a href="#modules">Project boards</a>
            </li>
          </ul>
        </div>

        <div className="ml-footer-links-col">
          <span className="ml-footer-heading">Security</span>
          <ul className="ml-footer-list" role="list">
            <li>
              <a href="#security">Role-based access</a>
            </li>
            <li>
              <a href="#security">Immutable audit trails</a>
            </li>
            <li>
              <a href="#security">Encrypted sessions</a>
            </li>
          </ul>
        </div>

        <div className="ml-footer-links-col">
          <span className="ml-footer-heading">Access</span>
          <ul className="ml-footer-list" role="list">
            <li>
              <Link href="/sign-in">Sign in</Link>
            </li>
            <li>
              <Link href="/sign-in">Open Manut</Link>
            </li>
            <li>
              <Link href="/welcome">Welcome page</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
