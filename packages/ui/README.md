# @flyt/ui

Flyt's design system: closed React components and the shared token stylesheet.

## What belongs here

A component that names no domain concept: props describe UI (tone, size, isOpen,
onClose), no product copy is baked in, and the package never imports
`@flyt/lexicon` or app code — lint rejects the import. Domain components live
in `@flyt/lexicon` when both surfaces render them, otherwise in the app.

## Install

Inside this monorepo it is a workspace package (`"@flyt/ui": "workspace:*"`).
Another repo can depend on it from git with pnpm's subdirectory syntax; the
repository is private, so this needs read access:

```sh
pnpm add "github:Chalvin96/flyt-dev#path:/packages/ui"
```

The package ships as TypeScript source with no build step (its exports point at
`src/`), so the consuming app needs a bundler that compiles TypeScript from
dependencies, such as Vite. Peer dependencies are `react` and `react-dom`
(`^19`); `next-themes` is needed only for the `@flyt/ui/sonner` Toaster.

## Wire the CSS (Tailwind v4)

Components name Tailwind utilities, and Tailwind generates only the utilities it
finds in source it scans, so your stylesheet must point an `@source` at this
package's `src`. The simplest entry imports Tailwind, the tokens and
`tailwindcss-animate` in one line:

```css
@import '@flyt/ui/styles/entry.css';
@source '../node_modules/@flyt/ui/src';
```

To compose your own entry instead, import `tailwindcss` and
`@flyt/ui/styles/tokens.css`, and add `tailwindcss-animate` to your own
dependencies for the `@plugin` line. Adjust the `@source` path to where your
stylesheet sits relative to `node_modules`.

`@flyt/lexicon`'s components read this package's colour roles and ship no
stylesheet of their own, so the imports above are all a surface that renders
them needs.

## Theme

`src/styles/tokens.css` is the entry; it imports two colour layers beside the
non-colour tokens. `palette.css` is theme-independent raw material — the hue
ramps and the translucent black and white ramps, nothing else. `theme-light.css`
is the only place that maps meaning onto those steps: it declares
`color-scheme`, the colour roles (`--background-*`, `--border-*`, `--text-*`,
`--icon-*`, `--surface-*`), and the shadow colours.

The layers are palette steps, theme roles and app tokens, then components.
Components read roles. Palette steps are read by theme sheets and displayed
directly only on the Foundations page. They are not Tailwind utilities, and the
former semantic aliases are gone. `tokens.css` exposes each role through a scoped
namespace, so `bg-neutral`, `bg-brand-bold`, `border-default`, `border-focused`,
`text-subtle`, `text-icon-brand` and their siblings resolve through the role
variable and a theme switch reaches every utility at runtime. The sheet also
declares the inverse meanings — `--background-inverse` for a dark plane such as
a footer, `--background-blanket` for the scrim behind a modal,
`--border-inverse` for an edge on a dark surface. Data and illustration colours
are app-owned: the app's own `theme-light.css` declares the `--chart-*` tokens
its charts and decorative fills read, because the shared package draws none.

Every layer keeps its own theme file beside its tokens — this package's and
the app's `theme-light.css` — so a second theme is one
file per layer: a `theme-dark.css` declaring exactly the same variables as that
layer's `theme-light.css` under `[data-theme='dark']` (and/or
`@media (prefers-color-scheme: dark)`), imported by that layer's `tokens.css`.
No component or utility changes.

## Fonts

The stylesheet sets no face of its own; the app and the design system use one
typeface, **DM Sans**. Load it yourself, for example from Google Fonts as
`frontend/index.html` does, and set it as your body font.

## Rendering inside a shadow root

`createShadowSurface(css, { mode })` (exported from the package root) attaches a
shadow root (closed unless `mode` says otherwise) to a new `container`, adopts
the compiled CSS there, and returns `container`, the `reactHost` to render into,
and a `PortalSurface` that portals popovers and dialogs into the same tree.
Append `container` to the page and render with `createRoot(reactHost)`. `@flyt/ui/styles/shadow-surface.css` resets `:host` so page
styles do not leak in. The compiled sheet is built with the
`@flyt/ui/postcss/shadow-root-properties` PostCSS plugin, because Chromium
ignores `@property` registrations declared inside a shadow tree: the plugin
moves each `--tw-*` registration to build time and restates its initial value,
so Tailwind's `var()` fallback chains resolve in the shadow root too. The
extension's `postcss.config.js`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    '@flyt/ui/postcss/shadow-root-properties': {},
  },
};
```

## Rules

- Components are closed: they take no `className` or `style`. Reach their
  variants through props such as `tone` and `size`, or wrap them in your own
  element.
- Colours come from roles such as `--text-subtle` and `--background-neutral`.
  Palette steps are theme inputs only. `Text` and
  `Heading` `tone` names the text colour roles: `default`, `subtle`, `brand`,
  `selected`, `success`, `warning`, `danger`, `inverse`, `inverse-subtle`.
- Type comes from `Heading` and `Text` sizes, not hand-assembled utilities.

## Typography

The vocabulary uses Atlassian's names and most of its values. The section label is 13/16/600.
Sizes are in rem and follow the reader's text-size setting; the pixel values
below hold at the default 16px root. `Heading` renders `as` an `h1`–`h6`,
`div` or `span`; `xxsmall` is the 13/16/600 sentence-case section label; `fluid` is Flyt's
responsive addition to Atlassian's scale, the same clamp on both axes: bold on a ×1.2
line for a heading, normal on a ×1.5 line for running text.

| Call                     | Size / line        | Weight and face |
| ------------------------ | ------------------ | --------------- |
| `Heading size="xxlarge"` | 32 / 36            | bold            |
| `Heading size="xlarge"`  | 28 / 32            | bold            |
| `Heading size="large"`   | 24 / 28            | bold            |
| `Heading size="medium"`  | 20 / 24            | bold            |
| `Heading size="small"`   | 16 / 20            | bold            |
| `Heading size="xsmall"`  | 14 / 20            | bold            |
| `Heading size="xxsmall"` | 13 / 16            | semibold        |
| `Heading size="fluid"`   | clamp 20→28 / ×1.2 | bold            |
| `Text size="small"`      | 12 / 16            | normal          |
| `Text size="medium"`     | 14 / 20            | normal          |
| `Text size="large"`      | 16 / 24            | normal          |
| `Text size="fluid"`      | clamp 20→28 / ×1.5 | normal          |

## Where to look

- Storybook `Foundations/*` — the tokens, the type scale, spacing, radius and
  elevation.
- Storybook `Design system/*` — each component and the component-namespaced
  tokens it owns.
- `knowledge/design-system/` in the monorepo — the reasoning behind the rules
  above.
