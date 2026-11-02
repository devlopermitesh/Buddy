import FinalCta from "@/components/FinalCta";
import Hero from "@/components/Hero";
import HowWeRoll from "@/components/HowWeRoll";
import Marquee from "@/components/Marquee";
import PromiseSection from "@/components/PromiseSection";
import ScrollProgress from "@/components/ScrollProgress";
import TrustSection from "@/components/TrustSection";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <main id="app">
        <Hero />
        <Marquee />
        <PromiseSection />
        <HowWeRoll />
        <TrustSection />
        <FinalCta />
      </main>
    </>
  );
}
