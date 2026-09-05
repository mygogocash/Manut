import { FeatureSection } from "@/components/landing/feature-section";
import {
  LandingClose,
  LandingFooter,
} from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { ProductDemoPanel } from "@/components/landing/product-demo-panel";

export default function WelcomePage() {
  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <ProductDemoPanel />
        <FeatureSection />
        <LandingClose />
      </main>
      <LandingFooter />
    </>
  );
}
