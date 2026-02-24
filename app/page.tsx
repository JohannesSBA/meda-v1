import HeroSection from "./components/landing/page";
import { PageShell } from "./components/ui/page-shell";

export default function Home() {
  return (
    <PageShell containerClassName="max-w-[1240px] px-4 py-4">
      <HeroSection />
    </PageShell>
  );
}
