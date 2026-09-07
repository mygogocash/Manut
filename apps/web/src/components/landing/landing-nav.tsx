"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ManutLogo } from "@/components/landing/manut-logo";

export function LandingNav({ isHomepage = true }: { isHomepage?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Close mobile drawer if viewport resized to desktop breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mobileOpen]);

  const brandHref = isHomepage ? "/" : "/welcome";

  return (
    <header className="ml-nav" role="banner">
      <div className="ml-nav-inner">
        <Link href={brandHref} className="ml-brand" aria-label="Manut Home">
          <ManutLogo className="ml-brand-mark" />
          <span className="ml-wordmark">Manut</span>
        </Link>

        <nav className="ml-nav-links" aria-label="Primary navigation">
          <a href="#product" className="ml-nav-link">
            Product
          </a>
          <a href="#modules" className="ml-nav-link">
            Modules
          </a>
          <a href="#security" className="ml-nav-link">
            Security
          </a>
        </nav>

        <div className="ml-nav-actions">
          <Link href="/sign-in" className="ml-btn-primary ml-nav-cta">
            Open Manut
          </Link>
          <button
            type="button"
            className="ml-mobile-toggle"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="8" x2="20" y2="8" />
                <line x1="4" y1="16" x2="20" y2="16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-nav-panel"
          className="ml-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <nav className="ml-mobile-nav" aria-label="Mobile navigation links">
            <a
              href="#product"
              className="ml-mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              Product
            </a>
            <a
              href="#modules"
              className="ml-mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              Modules
            </a>
            <a
              href="#security"
              className="ml-mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              Security
            </a>
          </nav>
          <div className="ml-mobile-action">
            <Link
              href="/sign-in"
              className="ml-btn-primary ml-btn-full"
              onClick={() => setMobileOpen(false)}
            >
              Open Manut
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
