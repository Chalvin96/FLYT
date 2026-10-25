# Design foundations

Components use semantic color roles. Theme sheets map those roles to palette colors.
This keeps component meaning stable when a theme changes. Light is the only supported
theme.

Text pairs need at least 4.5:1 contrast. Strong state boundaries and focus indicators
need at least 3:1. Decorative fills do not communicate state on their own. Keep text and
labels alongside color where they explain a state.

Use the shared focus role for focus indicators. Give disabled controls their own surface
so their labels and feedback remain readable.

border-focused is the single focus colour for controls in both the app and the
extension. Keep each semantic colour role stable across themes; components consume
roles, not palette steps.

Progress fills are decorative and fall below 3:1 against their tracks. Keep a
progress-border around them so the boundary still meets non-text contrast. Warning
colour marks real cautions, not decoration, progress, or recall grades.

Continuous progress bars keep a full-width bordered fill and clip the visible portion.
That preserves the border thickness when progress is low.

Token drift is checked against a Penpot token export. The check must print exactly No
drift. before it passes.

The exporter omits fluid clamp sizes because Penpot has no static font size for them;
other unsupported CSS values stop generation. The shared UI stylesheet owns the base
border rule because the extension does not load the app stylesheet.

`leading-roomy` is 1.75 because Tailwind's built-in loose step is 2. Responsive text
steps do not include fluid sizes because a continuous ramp is not a breakpoint choice.
`sm-copy` stays 14/24 because it preserves an existing 24px line box; `2xl-normal`
completes the 24/36 step.

The generated token file is checked against the committed Penpot token baseline. The
Penpot component baseline records cva recipe axes and values; update it with the
matching Penpot variants when a recipe changes. A token needs a reusable semantic role,
not only a measured value.

Design escape allowlists are compared with the Git merge base, and the ratchet checks
that resolved lint rules still reach their probe files. Without an explicit
acknowledgement, TYPOGRAPHY_OWNERS and STYLE_OWNERS only shrink. The type semantics check
compares findings with the merge-base baseline and rejects new or stale entries.

React Doctor is a versioned ratchet. Its baseline pins analyzer version and scan
arguments and limits warnings per rule; a report from another version cannot be
compared. Lower the baseline when a rule improves.

## Contrast measurements

These measurements cover reviewed role pairs. Keep them aligned with the committed theme
tokens.

| Role pair | Foreground / background roles | Contrast | Minimum |
| --- | --- | --- | --- |
| Success text | `text-success` / `background-success-subtle` | 8.17:1 | 4.5:1 |
| Success text | `text-success` / `background-success` | 6.88:1 | 4.5:1 |
| Success text | `text-success` / `surface-overlay` | 10.64:1 | 4.5:1 |
| Success text | `text-success` / `background-neutral` | 10.10:1 | 4.5:1 |
| Success strong border | `border-success` / `background-success-subtle` | 3.99:1 | 3:1 |
| Success strong border | `border-success` / `background-success` | 3.36:1 | 3:1 |
| Success strong border | `border-success` / `surface-overlay` | 5.20:1 | 3:1 |
| Success strong border | `border-success` / `background-neutral` | 4.93:1 | 3:1 |
| Success icon and strong border | `icon-success` / `background-success-subtle` | 3.99:1 | 3:1 |
| Success icon and strong border | `icon-success` / `background-success` | 3.36:1 | 3:1 |
| Success icon and strong border | `icon-success` / `surface-overlay` | 5.20:1 | 3:1 |
| Success icon and strong border | `icon-success` / `background-neutral` | 4.93:1 | 3:1 |
| Success subtle border | `border-success-subtle` / `background-success-subtle` | 1.84:1 | Decorative |
| Success subtle border | `border-success-subtle` / `surface-overlay` | 2.40:1 | Decorative |
| Success versus neutral border | `border-success-subtle` / `border-hovered` | 1.22:1 | Decorative |
| Success fill | `background-success-subtle` / `background-neutral-subtle` | 1.17:1 | Decorative |
| Success fill | `background-success-subtle` / `surface-overlay` | 1.30:1 | Decorative |
| Success marker | `background-success` / `background-neutral-pressed` | 1.19:1 | Decorative |
| Success marker | `background-success` / `surface-overlay` | 1.55:1 | Decorative |
| Success chart | `chart-success` / `surface-overlay` | 2.40:1 | Decorative |
| Success chart | `chart-success` / `background-neutral` | 2.28:1 | Decorative |
| Nav indicator | `border-selected` / `background-selected` | 3.58:1 | 3:1 |
| Nav indicator | `border-selected` / `surface-overlay` | 4.16:1 | 3:1 |
| Nav icon and selected copy | `text-selected` / `background-selected` | 8.84:1 | 4.5:1 |
| Nav icon and selected copy | `text-selected` / `surface-overlay` | 10.29:1 | 4.5:1 |
| Nav active label | `text-default` / `surface-overlay` | 13.85:1 | 4.5:1 |
| Nav inactive label | `text-subtle` / `surface-overlay` | 5.20:1 | 4.5:1 |
| Secondary button copy | `control-secondary-text` / `control-secondary-surface` | 8.84:1 | 4.5:1 |
| Secondary button copy | `control-secondary-text` / `control-secondary-surface-hover` | 7.05:1 | 4.5:1 |
| Secondary button copy | `control-secondary-text` / `control-secondary-surface-active` | 5.67:1 | 4.5:1 |
| Secondary button hover | `control-secondary-surface-hover` / `control-secondary-surface` | 1.25:1 | Decorative |
| Secondary button press | `control-secondary-surface-active` / `control-secondary-surface-hover` | 1.24:1 | Decorative |
| Progress border | `progress-border` / `progress-primary-complete` | 3.60:1 | 3:1 |
| Progress border | `progress-border` / `progress-primary-current` | 4.60:1 | 3:1 |
| Progress border | `progress-border` / `progress-secondary-complete` | 3.92:1 | 3:1 |
| Progress border | `progress-border` / `progress-secondary-current` | 4.87:1 | 3:1 |
| Progress border | `progress-border` / `hero-progress-track` | 7.11:1 | 3:1 |
| Progress border | `progress-border` / `background-neutral-subtle` | 6.39:1 | 3:1 |
| Progress border | `progress-border` / `background-neutral` | 6.75:1 | 3:1 |
| Primary complete fill | `progress-primary-complete` / `hero-progress-track` | 1.98:1 | Decorative |
| Primary complete fill | `progress-primary-complete` / `background-neutral-subtle` | 1.77:1 | Decorative |
| Primary current fill | `progress-primary-current` / `hero-progress-track` | 1.55:1 | Decorative |
| Primary current fill | `progress-primary-current` / `background-neutral-subtle` | 1.39:1 | Decorative |
| Secondary complete fill | `progress-secondary-complete` / `hero-progress-track` | 1.82:1 | Decorative |
| Secondary complete fill | `progress-secondary-complete` / `background-neutral-subtle` | 1.63:1 | Decorative |
| Secondary complete fill | `progress-secondary-complete` / `progress-primary-complete` | 1.09:1 | Decorative |
| Secondary current fill | `progress-secondary-current` / `hero-progress-track` | 1.46:1 | Decorative |
| Secondary current fill | `progress-secondary-current` / `background-neutral-subtle` | 1.31:1 | Decorative |
| Secondary current fill | `progress-secondary-current` / `progress-primary-current` | 1.06:1 | Decorative |
| Deep hero text | `hero-text` / `hero-deep-surface` | 10.63:1 | 4.5:1 |
| Brand hero text | `hero-text` / `hero-brand-surface` | 11.90:1 | 4.5:1 |
| Brand hero copy | `hero-muted-text` / `hero-brand-surface` | 6.11:1 | 4.5:1 |
| Calm hero text | `hero-text` / `hero-calm-surface` | 12.44:1 | 4.5:1 |
| Calm hero copy | `hero-muted-text` / `hero-calm-surface` | 6.39:1 | 4.5:1 |
| Hero badge text | `hero-text` / `hero-badge-surface` | 13.85:1 | 4.5:1 |
| Hero badge copy | `hero-muted-text` / `hero-badge-surface` | 7.11:1 | 4.5:1 |
| Primary hero action | `text-inverse` / `background-brand-bold` | 5.19:1 | 4.5:1 |
| Primary hero action | `text-inverse` / `background-brand-bold-hovered` | 6.91:1 | 4.5:1 |
| Primary hero action | `text-inverse` / `background-brand-bold-pressed` | 10.29:1 | 4.5:1 |
| Page text | `text-default` / `background-neutral` | 13.16:1 | 4.5:1 |
| Page supporting copy | `text-subtle` / `background-neutral` | 4.93:1 | 4.5:1 |
| Deep hero copy | `hero-muted-text` / `hero-deep-surface` | 5.46:1 | 4.5:1 |
| Deep hero surface | `hero-deep-surface` / `hero-calm-surface` | 1.17:1 | Decorative |
| Deep hero surface | `hero-deep-surface` / `background-neutral` | 1.24:1 | Decorative |
| Quiet hero text | `hero-quiet-text` / `background-neutral` | 13.16:1 | 4.5:1 |
| Quiet hero copy | `hero-quiet-muted-text` / `background-neutral` | 10.10:1 | 4.5:1 |
| Quiet hero decorative border | `border-default` / `background-neutral` | 1.24:1 | Decorative |
| Recommendation copy | `text-default` / `background-brand-subtle` | 11.90:1 | 4.5:1 |
| A1 cover | `background-success-subtle` / `surface-overlay` | 1.30:1 | Decorative |
| A1 cover | `background-success-subtle` / `background-brand-subtle` | 1.12:1 | Decorative |
| A2 cover | `background-brand-bold` / `surface-overlay` | 5.19:1 | Decorative |
| A2 cover | `background-brand-bold` / `background-brand-subtle` | 4.46:1 | Decorative |
| B1 cover | `chart-neutral-1` / `surface-overlay` | 1.98:1 | Decorative |
| B1 cover | `chart-neutral-1` / `background-brand-subtle` | 1.70:1 | Decorative |
| B2 cover | `chart-neutral-2` / `surface-overlay` | 3.06:1 | Decorative |
| B2 cover | `chart-neutral-2` / `background-brand-subtle` | 2.62:1 | Decorative |
| C1 cover | `chart-neutral-3` / `surface-overlay` | 7.11:1 | Decorative |
| C1 cover | `chart-neutral-3` / `background-brand-subtle` | 6.11:1 | Decorative |
| C2 cover | `background-neutral-bold` / `surface-overlay` | 10.64:1 | Decorative |
| C2 cover | `background-neutral-bold` / `background-brand-subtle` | 9.14:1 | Decorative |
| A1/A2 neighbours | `background-success-subtle` / `background-brand-bold` | 3.99:1 | Decorative |
| A2/B1 neighbours | `background-brand-bold` / `chart-neutral-1` | 2.63:1 | Decorative |
| B1/B2 neighbours | `chart-neutral-1` / `chart-neutral-2` | 1.55:1 | Decorative |
| B2/C1 neighbours | `chart-neutral-2` / `chart-neutral-3` | 2.33:1 | Decorative |
| C1/C2 neighbours | `chart-neutral-3` / `background-neutral-bold` | 1.50:1 | Decorative |

Any future theme must preserve the existing role meanings instead of adding
theme-specific component styles.
