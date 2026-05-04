import { SiteNav } from "@/components/site-nav";
import { AiDemo } from "@/components/sections/ai-demo";
import { Cta } from "@/components/sections/cta";
import { Faq } from "@/components/sections/faq";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { OpenSource } from "@/components/sections/open-source";
import { Pricing } from "@/components/sections/pricing";
import { SiteFooter } from "@/components/sections/site-footer";
import { Testimonials } from "@/components/sections/testimonials";
import { TrustBar } from "@/components/sections/trust-bar";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main id="main" className="flex flex-col">
        <Hero />
        <TrustBar />
        <Features />
        <AiDemo />
        <OpenSource />
        <Pricing />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
