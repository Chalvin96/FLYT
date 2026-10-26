import type { NamedTokenDoc, TokenDoc } from './token-source';
import type { BodySize, HeadingSize } from '../components/text-variants';

export type TokenSection = {
  title: string;
  docs: TokenDoc[];
};

export const COMPONENT_TOKEN_PREFIXES = [
  '--control-radius',
  '--control-shadow-',
  '--skeleton-text-',
  '--skeleton-heading-',
  '--skeleton-control-',
  '--skeleton-length-',
];

export const COLOUR_ROLES: NamedTokenDoc[] = [
  {
    name: '--background-neutral',
    useWhen: 'the page and modal canvas, quiet panels',
  },
  {
    name: '--background-neutral-subtle',
    useWhen: 'quiet fill: tracks, hover washes, wells, badges, locked answers',
  },
  {
    name: '--background-neutral-pressed',
    useWhen: 'the active or pressed wash of a neutral control',
  },
  {
    name: '--background-neutral-bold',
    useWhen: 'a pressed filter chip: dark fill, inverse text',
  },
  {
    name: '--background-neutral-bold-hovered',
    useWhen: 'the hover of the pressed filter chip',
  },
  { name: '--background-selected', useWhen: 'the chosen item in a set' },
  {
    name: '--background-selected-hovered',
    useWhen: 'the hover of the chosen item in a set',
  },
  {
    name: '--background-brand-subtle',
    useWhen: 'a brand-tinted information surface: well, badge, audio, skeleton',
  },
  { name: '--background-brand-bold', useWhen: 'the committing action' },
  {
    name: '--background-brand-bold-hovered',
    useWhen: 'the hover of the committing action',
  },
  {
    name: '--background-brand-bold-pressed',
    useWhen: 'the active or pressed committing action',
  },
  { name: '--background-danger', useWhen: 'a destructive action fill' },
  {
    name: '--background-danger-hovered',
    useWhen: 'the hover of a destructive action',
  },
  {
    name: '--background-danger-pressed',
    useWhen: 'the active or pressed destructive action',
  },
  {
    name: '--background-danger-subtle',
    useWhen: 'a quiet danger surface',
  },
  {
    name: '--background-danger-subtle-hovered',
    useWhen: 'the hover of a quiet danger surface',
  },
  {
    name: '--background-warning-subtle',
    useWhen: 'a quiet caution surface',
  },
  { name: '--background-success-subtle', useWhen: 'a quiet success surface' },
  {
    name: '--background-success',
    useWhen:
      'a success fill that sits on a success-subtle surface, e.g. the correct-answer marker',
  },
  {
    name: '--background-disabled',
    useWhen: 'a disabled control surface; its own surface, not an opacity',
  },
  {
    name: '--background-inverse',
    useWhen: 'a dark surface such as the footer or an inverse card',
  },
  {
    name: '--background-blanket',
    useWhen: 'the scrim behind a modal dialog or sheet',
  },
  {
    name: '--surface-raised',
    useWhen: 'a card over the page glow, translucent by intent',
  },
  {
    name: '--surface-overlay',
    useWhen: 'an opaque overlay over arbitrary content',
  },
  {
    name: '--border-default',
    useWhen: 'the resting hairline of a quiet surface',
  },
  {
    name: '--border-hovered',
    useWhen: 'the hover edge of a subtle tile; the locked-answer edge',
  },
  {
    name: '--border-strong',
    useWhen: 'the resting edge of an interactive control',
  },
  {
    name: '--border-strong-hovered',
    useWhen:
      'a control edge that stays distinct on neutral and tinted surfaces',
  },
  {
    name: '--border-brand-subtle',
    useWhen: 'the edge of a brand-subtle surface',
  },
  { name: '--border-selected', useWhen: 'an edge communicating selection' },
  { name: '--border-focused', useWhen: 'the one focus colour' },
  {
    name: '--border-danger-subtle',
    useWhen: 'the quiet edge of a danger-tinted surface',
  },
  {
    name: '--border-danger',
    useWhen: 'an edge communicating an incorrect or dangerous state',
  },
  {
    name: '--border-warning-subtle',
    useWhen: 'the quiet edge of a caution surface',
  },
  { name: '--border-warning', useWhen: 'the edge of a caution message' },
  {
    name: '--border-success-subtle',
    useWhen: 'the quiet edge of a success surface',
  },
  { name: '--border-success', useWhen: 'an edge communicating correctness' },
  { name: '--border-disabled', useWhen: 'a disabled edge' },
  { name: '--border-inverse', useWhen: 'an edge on a dark surface' },
  { name: '--text-default', useWhen: 'default text' },
  {
    name: '--text-subtle',
    useWhen: 'secondary text, placeholders, locked or unavailable labels',
  },
  { name: '--text-brand', useWhen: 'links and brand eyebrows' },
  { name: '--text-selected', useWhen: 'text on a selected surface' },
  { name: '--text-danger', useWhen: 'error and incorrect text' },
  { name: '--text-warning', useWhen: 'caution text' },
  { name: '--text-success', useWhen: 'success text' },
  {
    name: '--text-inverse',
    useWhen: 'text on brand and danger bold fills and inverse surfaces',
  },
  {
    name: '--text-inverse-subtle',
    useWhen: 'muted copy on a saturated plane',
  },
  {
    name: '--text-disabled',
    useWhen: 'a disabled label; full contrast on its own surface',
  },
  { name: '--icon-default', useWhen: 'a neutral glyph on a subtle well' },
  { name: '--icon-brand', useWhen: 'a brand glyph' },
  { name: '--icon-success', useWhen: 'a success glyph' },
  { name: '--icon-warning', useWhen: 'a caution glyph' },
  { name: '--icon-danger', useWhen: 'a danger glyph' },
];

export const CONTROL_COLOURS: NamedTokenDoc[] = [
  {
    name: '--control-secondary-surface',
    useWhen: 'the resting fill of a secondary button',
  },
  {
    name: '--control-secondary-surface-hover',
    useWhen: 'the hover fill of a secondary button',
  },
  {
    name: '--control-secondary-surface-active',
    useWhen: 'the pressed fill of a secondary button',
  },
  {
    name: '--control-secondary-border',
    useWhen: 'the edge of a secondary button',
  },
  {
    name: '--control-secondary-text',
    useWhen: 'the label of a secondary button',
  },
  {
    name: '--control-inverse-surface',
    useWhen: 'the resting fill of an action on a dark plane',
  },
  {
    name: '--control-inverse-surface-hover',
    useWhen: 'the hover fill of an action on a dark plane',
  },
  {
    name: '--control-inverse-surface-active',
    useWhen: 'the pressed fill of an action on a dark plane',
  },
  {
    name: '--control-inverse-border',
    useWhen: 'the edge of an action on a dark plane',
  },
  {
    name: '--control-inverse-text',
    useWhen: 'the label of an action on a dark plane',
  },
];

export const COLOUR_SECTIONS: TokenSection[] = [
  {
    title: 'Roles',
    docs: COLOUR_ROLES,
  },
  {
    title: 'Control colours',
    docs: CONTROL_COLOURS,
  },
  {
    title: 'Shadow colours',
    docs: [
      {
        name: '--shadow-color',
        useWhen: 'the ink the elevation shadows are drawn in',
      },
    ],
  },
  {
    title: 'Palette',
    docs: [
      { family: 'primary', useWhen: 'brand violet steps' },
      { family: 'secondary', useWhen: 'calm teal steps; the neutral ink' },
      { family: 'accent', useWhen: 'green steps for positive states' },
      { family: 'warning', useWhen: 'real cautions only' },
      { family: 'destructive', useWhen: 'red steps for errors' },
      { family: 'black', useWhen: 'translucent ink for shadows and scrims' },
      { family: 'white', useWhen: 'translucent white for glass and hero text' },
    ],
  },
];

export const BODY_ROLE_DOCS: { size: BodySize; useWhen: string }[] = [
  { size: 'small', useWhen: 'fine print and metadata' },
  { size: 'medium', useWhen: 'default interface text' },
  { size: 'large', useWhen: 'long-form reading' },
  {
    size: 'fluid',
    useWhen:
      'running text that grows with the viewport, such as a sentence to study',
  },
];

export const HEADING_ROLE_DOCS: { size: HeadingSize; useWhen: string }[] = [
  { size: 'xxlarge', useWhen: 'brand headlines' },
  { size: 'xlarge', useWhen: 'page titles that lead a view' },
  { size: 'large', useWhen: 'page and form titles' },
  { size: 'medium', useWhen: 'titles of dialogs and panels' },
  { size: 'small', useWhen: 'titles in small components' },
  { size: 'xsmall', useWhen: 'titles where space is tight' },
  {
    size: 'xxsmall',
    useWhen: 'a short sentence-case label above a section or item',
  },
  {
    size: 'fluid',
    useWhen: 'a headline that grows with the viewport, from medium to xlarge',
  },
];

export const TYPE_ROLE_DOCS: NamedTokenDoc[] = [
  ...BODY_ROLE_DOCS.map(({ size, useWhen }) => ({
    name: `--text-body-${size}`,
    useWhen,
  })),
  ...HEADING_ROLE_DOCS.map(({ size, useWhen }) => ({
    name: `--text-heading-${size}`,
    useWhen,
  })),
];

export const TYPE_SECTIONS: TokenSection[] = [
  {
    title: 'Bespoke type utilities',
    docs: [
      {
        name: '--type-leading-copy',
        useWhen: 'the 24px line box of today’s copy step, until migrated',
      },
      {
        name: '--type-leading-loose',
        useWhen: 'the ×1.75 line of today’s roomy steps, until migrated',
      },
      {
        name: '--text-prompt',
        useWhen:
          'the fluid size of the legacy prompt steps, until the contract step',
      },
    ],
  },
];

export const RADIUS_SECTION: TokenSection = {
  title: 'Radius',
  docs: [
    {
      name: '--radius',
      useWhen: 'the base corner; Tailwind’s rounded-sm…4xl derive from it',
    },
    {
      name: '--radius-field',
      useWhen: 'fields, buttons and anything the user types into',
    },
    {
      name: '--radius-section',
      useWhen: 'cards, panels and sheets',
    },
  ],
};

export const ELEVATION_SECTION: TokenSection = {
  title: 'Elevation',
  docs: [
    {
      name: '--shadow-soft',
      useWhen: 'a surface that barely lifts: tiles, panels, hero cards',
    },
    {
      name: '--shadow-raised',
      useWhen: 'a raised card or sheet',
    },
    {
      name: '--shadow-tile',
      useWhen: 'a tile resting on the mat, and the extension popup',
    },
  ],
};

export const LAYOUT_SECTION: TokenSection = {
  title: 'Layout measures',
  docs: [
    {
      name: '--dialog-desktop-max-width',
      useWhen: 'a dialog on desktop',
    },
    {
      name: '--sheet-max-height',
      useWhen: 'a bottom sheet, default or tall',
    },
  ],
};

export const SPACE_SECTIONS: TokenSection[] = [
  RADIUS_SECTION,
  ELEVATION_SECTION,
  LAYOUT_SECTION,
];

export const ALL_TOKEN_DOCS: TokenDoc[] = [
  ...COLOUR_SECTIONS.flatMap((section) => section.docs),
  ...TYPE_ROLE_DOCS,
  ...TYPE_SECTIONS.flatMap((section) => section.docs),
  ...SPACE_SECTIONS.flatMap((section) => section.docs),
];
