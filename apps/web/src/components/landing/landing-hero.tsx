import Link from "next/link";

import { ProductPreviewCluster } from "@/components/landing/product-preview-cluster";

export function LandingHero() {
  return (
    <section className="ml-hero ml-container" aria-label="Introduction">
      <div className="ml-hero-copy">
        <span className="ml-tag ml-animate-copy">
          Operations workspace for growing SMEs
        </span>
        <h1 className="ml-display ml-animate-copy">
          People, money, and work.
          <br className="ml-br-desktop" /> Finally, together.
        </h1>
        <p className="ml-body-lg ml-hero-lead ml-animate-copy-delay">
          Manut brings your team, approvals, and projects into one clear
          workspace— so your business can grow with less busywork.
        </p>
        <div className="ml-hero-ctas ml-animate-ctas">
          <Link href="/sign-in" className="ml-btn-primary ml-btn-large">
            Open Manut
          </Link>
          <a href="#product" className="ml-btn-secondary ml-btn-large">
            Explore the product
          </a>
        </div>
      </div>

      <div className="ml-hero-visual ml-animate-stage">
        <ProductPreviewCluster />
      </div>
    </section>
  );
}
