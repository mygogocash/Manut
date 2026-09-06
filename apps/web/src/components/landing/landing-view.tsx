import React from "react";

import { FeatureSection } from "@/components/landing/feature-section";
import {
  LandingClose,
  LandingFooter,
} from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProductDemoPanel } from "@/components/landing/product-demo-panel";

export function LandingView({ isHomepage = true }: { isHomepage?: boolean }) {
  return (
    <>
      <LandingNav isHomepage={isHomepage} />
      <main id="main-content">
        <LandingHero />
        <ProductDemoPanel />
        <FeatureSection />
        <LandingClose />
      </main>
      <LandingFooter isHomepage={isHomepage} />
    </>
  );
}
