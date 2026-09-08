import type { Meta, StoryObj } from '@storybook/react';
import { Star } from 'lucide-react';

import { AppCard } from '@/components/common/AppCard/AppCard';
import { Button } from '@/components/common/Button/Button';

const scaleSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

const scaleGroups = [
  { label: 'Primary', token: 'primary' },
  { label: 'Secondary', token: 'secondary' },
  { label: 'Accent', token: 'accent' },
  { label: 'Warning', token: 'warning' },
  { label: 'Destructive', token: 'destructive' },
  { label: 'Black', token: 'black' },
  { label: 'White', token: 'white' },
] as const;

const radiusGroups = [
  { className: 'radius-sm', label: 'radius-sm', value: 'var(--radius-sm)' },
  {
    className: 'radius-field',
    label: 'radius-field',
    value: 'var(--radius-field)',
  },
  {
    className: 'radius-section',
    label: 'radius-section',
    value: 'var(--radius-section)',
  },
] as const;

const elevationGroups = [
  { className: 'shadow-soft', label: 'shadow-soft' },
  { className: 'shadow-raised', label: 'shadow-raised' },
  { className: 'shadow-inset', label: 'shadow-inset' },
] as const;

const typeBaseScale = [
  {
    className: 'type-hero',
    label: 'type-hero',
    description: 'Prominent page headline',
  },
  {
    className: 'type-title',
    label: 'type-title',
    description: 'Main section title',
  },
  {
    className: 'type-section',
    label: 'type-section',
    description: 'Card and block heading',
  },
  {
    className: 'type-body',
    label: 'type-body',
    description: 'Regular reading text',
  },
  {
    className: 'type-caption',
    label: 'type-caption',
    description: 'Helper and metadata text',
  },
  {
    className: 'type-stat',
    label: 'type-stat',
    description: 'Numeric stat value',
  },
  {
    className: 'type-label',
    label: 'type-label',
    description: 'Uppercase badge label',
  },
  {
    className: 'type-label-sm',
    label: 'type-label-sm',
    description: 'Smaller badge label',
  },
  {
    className: 'type-label-xs',
    label: 'type-label-xs',
    description: 'Smallest label',
  },
] as const;

const trackingGroups = [
  {
    className: 'tracking-label-tight',
    label: 'tracking-label-tight',
    value: 'var(--tracking-label-tight) — 0.12em',
  },
  {
    className: 'tracking-label',
    label: 'tracking-label',
    value: 'var(--tracking-label) — 0.16em',
  },
  {
    className: 'tracking-label-wide',
    label: 'tracking-label-wide',
    value: 'var(--tracking-label-wide) — 0.18em',
  },
] as const;

type ThemePanelProps = {
  dark?: boolean;
  title: string;
};

type SemanticTileProps = {
  background: string;
  description: string;
  foreground: string;
  label: string;
};

function ScaleRow({ label, token }: { label: string; token: string }) {
  return (
    <div className="grid gap-2 lg:grid-cols-label-content lg:items-center">
      <div>
        <p className="type-section font-semibold text-foreground">{label}</p>
        <p className="type-caption text-muted-foreground">
          `{token}-0` to `{token}-100`
        </p>
      </div>

      <div className="grid grid-cols-11 gap-2">
        {scaleSteps.map((step) => {
          const cssVar = `--${token}-${step}`;

          return (
            <div key={cssVar} className="grid gap-1">
              <div
                className="radius-field h-14 border border-white-30"
                style={{ backgroundColor: `var(${cssVar})` }}
              />
              <p className="type-caption text-center text-muted-foreground">
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SemanticTile({
  background,
  description,
  foreground,
  label,
}: SemanticTileProps) {
  return (
    <div
      className="radius-section border p-4"
      style={{
        backgroundColor: `var(${background})`,
        borderColor: 'var(--border)',
        color: `var(${foreground})`,
      }}
    >
      <p className="type-label">{label}</p>
      <p className="type-caption mt-2 opacity-80">{description}</p>
    </div>
  );
}

function ThemePanel({ dark = false, title }: ThemePanelProps) {
  return (
    <div className={dark ? 'dark' : undefined}>
      <div className="app-grid radius-section border border-white-20 bg-background p-5 text-foreground">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="type-label text-muted-foreground">Theme preview</p>
            <h3 className="type-title mt-2 font-semibold">{title}</h3>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SemanticTile
            background="--background"
            description="Canvas background"
            foreground="--foreground"
            label="background"
          />
          <SemanticTile
            background="--card"
            description="Primary surface"
            foreground="--card-foreground"
            label="card"
          />
          <SemanticTile
            background="--muted"
            description="De-emphasized surface"
            foreground="--muted-foreground"
            label="muted"
          />
          <SemanticTile
            background="--primary"
            description="Main brand action"
            foreground="--primary-foreground"
            label="primary"
          />
          <SemanticTile
            background="--secondary"
            description="Supportive surface"
            foreground="--secondary-foreground"
            label="secondary"
          />
          <SemanticTile
            background="--accent"
            description="Highlight surface"
            foreground="--accent-foreground"
            label="accent"
          />
          <SemanticTile
            background="--warning"
            description="Attention state"
            foreground="--warning-foreground"
            label="warning"
          />
          <SemanticTile
            background="--destructive"
            description="Danger state"
            foreground="--white-100"
            label="destructive"
          />
        </div>
      </div>
    </div>
  );
}

function DesignSystemShowcase() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-grid min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <AppCard className="overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="type-label text-primary-80">Flyt design system</p>
                <h1 className="type-hero mt-3 font-semibold text-foreground">
                  Palette, typography, radius, elevation, and component
                  baselines
                </h1>
                <p className="type-body mt-4 text-muted-foreground">
                  This Storybook page captures the token system in one place so
                  the visual language stays consistent as the app grows.
                </p>
              </div>

              <div className="radius-section border border-white-30 bg-primary-20 px-5 py-4 text-primary-90">
                <p className="type-label text-primary-80">Design principle</p>
                <p className="type-section mt-2 font-semibold">
                  Simple by design
                </p>
                <p className="type-caption mt-2 text-primary-90">
                  The system stays focused on palette, type, spacing, radius,
                  and shadows.
                </p>
              </div>
            </div>
          </AppCard>

          {/* Color ramps */}
          <AppCard className="p-6 sm:p-8">
            <div className="mb-6">
              <p className="type-label text-muted-foreground">Color ramps</p>
              <h2 className="type-title mt-2 font-semibold">
                0 to 100 gradient scales
              </h2>
            </div>

            <div className="grid gap-6">
              {scaleGroups.map((group) => (
                <ScaleRow
                  key={group.token}
                  label={group.label}
                  token={group.token}
                />
              ))}
            </div>
          </AppCard>

          {/* Theme semantics */}
          <div className="grid gap-6 xl:grid-cols-2">
            <ThemePanel title="Light theme semantics" />
            <ThemePanel dark title="Dark theme semantics" />
          </div>

          {/* Type scale + Radius */}
          <div className="grid gap-6 xl:grid-cols-type-radius">
            <AppCard className="p-6 sm:p-8">
              <p className="type-label text-muted-foreground">Type scale</p>

              <div className="mt-5 grid gap-4">
                {typeBaseScale.map(({ className, label, description }) => (
                  <div key={label}>
                    <p className={`${className} font-semibold`}>{label}</p>
                    <p className="type-caption text-muted-foreground">
                      {description}
                    </p>
                  </div>
                ))}
              </div>

              <p className="type-label mt-8 text-muted-foreground">
                Letter spacing
              </p>
              <div className="mt-4 grid gap-4">
                {trackingGroups.map(({ className, label, value }) => (
                  <div key={label}>
                    <p
                      className={`${className} type-label text-foreground`}
                      style={{ textTransform: 'none', fontWeight: 400 }}
                    >
                      The quick brown fox
                    </p>
                    <p className="type-caption mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {label}
                      </span>{' '}
                      — {value}
                    </p>
                  </div>
                ))}
              </div>
            </AppCard>

            <AppCard className="p-6 sm:p-8">
              <p className="type-label text-muted-foreground">Radius</p>
              <div className="mt-5 grid gap-4">
                {radiusGroups.map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div
                      className={`${item.className} h-14 w-14 border border-border bg-secondary-20`}
                    />
                    <div>
                      <p className="type-section font-semibold">{item.label}</p>
                      <p className="type-caption text-muted-foreground">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </AppCard>
          </div>

          {/* Elevation + Components */}
          <div className="grid gap-6 xl:grid-cols-elevation-components">
            <AppCard className="p-6 sm:p-8">
              <p className="type-label text-muted-foreground">Elevation</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {elevationGroups.map((item) => (
                  <div
                    key={item.label}
                    className={`${item.className} radius-section border border-white-30 bg-card p-4`}
                  >
                    <p className="type-section font-semibold">{item.label}</p>
                    <p className="type-caption mt-2 text-muted-foreground">
                      Reusable depth preset
                    </p>
                  </div>
                ))}
              </div>

              <div className="radius-section mt-5 overflow-hidden bg-black-100 p-4 text-white-90">
                <div className="shadow-top rounded-t-2xl bg-black-90 p-4">
                  <p className="type-section font-semibold">shadow-top</p>
                  <p className="type-caption mt-2 text-white-60">
                    Dock or sticky footer treatment
                  </p>
                </div>
              </div>
            </AppCard>

            <AppCard className="p-6 sm:p-8">
              <p className="type-label text-muted-foreground">Components</p>
              <div className="mt-5 grid gap-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>

                <div className="flex items-center gap-4">
                  <Star className="icon-xs text-muted-foreground" />
                  <Star className="icon-sm text-muted-foreground" />
                  <Star className="icon-md text-muted-foreground" />
                  <Star className="icon-lg text-muted-foreground" />
                  <Star className="icon-xl text-muted-foreground" />
                  <div className="type-caption ml-2 text-muted-foreground">
                    xs · sm · md · lg · xl
                  </div>
                </div>

                <div className="radius-section border border-white-30 bg-primary-20 p-5 text-primary-90">
                  <p className="type-section font-semibold">System note</p>
                  <p className="type-caption mt-2 text-primary-80">
                    Components are built from shared tokens instead of bespoke
                    per-page styling.
                  </p>
                </div>
              </div>
            </AppCard>
          </div>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Design System/Showcase',
  component: DesignSystemShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DesignSystemShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
