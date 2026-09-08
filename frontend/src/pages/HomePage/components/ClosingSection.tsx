import { ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';

export function ClosingSection() {
  return (
    <section className="radius-section relative overflow-hidden bg-primary-70 px-6 py-10 text-white-100 sm:px-10 sm:py-14">
      <div className="absolute -left-6 top-0 size-28 rounded-full bg-primary-50/50 blur-2xl" />
      <div className="absolute -bottom-8 right-0 size-36 rounded-full bg-primary-50/50 blur-2xl" />
      <div className="relative z-10 max-w-2xl">
        <p className="type-label text-white-90">Ready to start?</p>
        <h2 className="mt-3 font-display type-display-lg font-semibold text-white-100">
          Read a Norwegian story tonight.
        </h2>
        <p className="mt-4 type-body leading-8 text-white-90 sm:type-section">
          No deck to build. Tap any word you don&rsquo;t know and add it
          straight to review.
        </p>
        <div className="mt-7">
          <Button
            asChild
            className="bg-white-100 px-6 text-primary-100 hover:bg-white-90"
          >
            <Link to="/login">
              Read your first story
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

ClosingSection.displayName = 'ClosingSection';
