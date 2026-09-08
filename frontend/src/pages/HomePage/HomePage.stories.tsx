import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { RouterProvider } from '@tanstack/react-router';

import { createStoryRouter } from '@/test/router';

import { FaqSection } from './components/FaqSection';
import { FeatureGrid } from './components/FeatureGrid';
import { LandingHero } from './components/LandingHero';
import { LearningLoop } from './components/LearningLoop';
import { ProofStrip } from './components/ProofStrip';
import { ReplacesTable } from './components/ReplacesTable';
import { ReviewShowcase } from './components/ReviewShowcase';
import { HomePage } from './HomePage';

function RouterDecorator({ children }: { children: ReactNode }) {
  const router = useMemo(
    () => createStoryRouter(children, ['/'], ['/', 'login', 'home', 'about']),
    [children],
  );

  return <RouterProvider router={router} />;
}

const meta = {
  component: HomePage,
  decorators: [
    (Story) => (
      <RouterDecorator>
        <Story />
      </RouterDecorator>
    ),
  ],
  parameters: { layout: 'fullscreen' },
  title: 'Pages/Landing',
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FullPage: Story = {};

export const Hero: Story = {
  render: () => (
    <div className="bg-background text-foreground">
      <LandingHero />
      <ProofStrip />
    </div>
  ),
};

export const Loop: Story = {
  render: () => (
    <div className="shell-px bg-background py-12 text-foreground">
      <div className="container-max mx-auto">
        <LearningLoop />
      </div>
    </div>
  ),
};

export const Review: Story = {
  render: () => (
    <div className="shell-px bg-background py-12 text-foreground">
      <div className="container-max mx-auto flex flex-col gap-16">
        <ReviewShowcase />
        <ReplacesTable />
      </div>
    </div>
  ),
};

export const Features: Story = {
  render: () => (
    <div className="shell-px bg-background py-12 text-foreground">
      <div className="container-max mx-auto flex flex-col gap-16">
        <FeatureGrid />
        <FaqSection />
      </div>
    </div>
  ),
};
