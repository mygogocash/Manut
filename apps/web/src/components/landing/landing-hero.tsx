import Link from "next/link";

import { ProductPreviewCluster } from "@/components/landing/product-preview-cluster";

export function LandingHero() {
  return (
    <section className="ml-hero ml-container">
      <div className="ml-hero-copy">
        <span className="ml-tag ml-animate-copy">For growing SMEs</span>
        <h1 className="ml-display ml-animate-copy">
          The operations desk for businesses that outgrew spreadsheets.
        </h1>
        <p className="ml-body-lg ml-animate-copy-delay">
          Manut brings people, money, and work into one calm workspace — so
          teams stop stitching tools together and start shipping decisions.
        </p>
        <div className="ml-hero-ctas ml-animate-ctas">
          <Link href="/sign-in" className="ml-btn-primary">
            Sign in
          </Link>
          <a href="#modules" className="ml-link-ghost">
            See modules
          </a>
        </div>
      </div>
      <ProductPreviewCluster />
    </section>
  );
}
