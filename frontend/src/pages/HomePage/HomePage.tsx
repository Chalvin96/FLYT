import { ClosingSection } from './components/ClosingSection';
import { FaqSection } from './components/FaqSection';
import { FeatureGrid } from './components/FeatureGrid';
import { LandingFooter } from './components/LandingFooter';
import { LandingHero } from './components/LandingHero';
import { LandingTopBar } from './components/LandingTopBar';
import { LearningLoop } from './components/LearningLoop';
import { ProofStrip } from './components/ProofStrip';
import { ReplacesTable } from './components/ReplacesTable';
import { ReviewShowcase } from './components/ReviewShowcase';

function HomePage() {
  return (
    <div className="bg-background text-foreground">
      <LandingTopBar />
      <main>
        <LandingHero />
        <ProofStrip />
        <div className="shell-px py-16 sm:py-20 lg:py-24">
          <div className="container-max mx-auto flex flex-col gap-16 sm:gap-20 lg:gap-24">
            <LearningLoop />
            <ReviewShowcase />
            <ReplacesTable />
            <FeatureGrid />
            <FaqSection />
            <ClosingSection />
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

HomePage.displayName = 'HomePage';

export { HomePage };
