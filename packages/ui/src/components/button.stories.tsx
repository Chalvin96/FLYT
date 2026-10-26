import type { Meta, StoryObj } from '@storybook/react';
import { ArrowRight, Plus } from 'lucide-react';

import { sentenceCaseLabel } from '../lib/utils';
import { Button, type ButtonVariant } from './button';
import { Heading } from './heading';

const variants: ButtonVariant[] = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'danger',
  'inverse',
  'link',
];

const meta = {
  title: 'Design system/Actions/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: 'Continue' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ApprovedMatrix: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-8">
      {variants.map((variant) => (
        <section
          className={
            variant === 'inverse'
              ? 'grid gap-3 radius-section bg-inverse p-4 text-inverse'
              : 'grid gap-3'
          }
          key={variant}
        >
          <Heading
            as="div"
            size="xxsmall"
            tone={variant === 'inverse' ? 'inverse-subtle' : 'subtle'}
          >
            {sentenceCaseLabel(variant)}
          </Heading>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={variant}>
              Small
            </Button>
            <Button variant={variant}>Default</Button>
            <Button size="lg" variant={variant}>
              Large action
            </Button>
            <Button shape="pill" variant={variant}>
              Pill
            </Button>
            {variant !== 'link' ? (
              <Button
                aria-label={`${variant} icon action`}
                size="icon"
                variant={variant}
              >
                <Plus aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const InteractionStates: Story = {
  render: () => (
    <div className="grid max-w-xl gap-5">
      <div className="flex flex-wrap gap-3">
        <Button>Ready</Button>
        <Button disabled>Unavailable</Button>
      </div>
      <Button align="start" variant="outline" width="full">
        A start-aligned action with enough text to demonstrate wrapping cleanly
        without consumer styling
        <ArrowRight aria-hidden="true" />
      </Button>
      <Button width="full-on-mobile">Responsive primary action</Button>
    </div>
  ),
};
