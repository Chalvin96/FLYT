export type TextSize =
  | 'xs'
  | 'xs-tight'
  | 'xs-none'
  | 'xs-snug'
  | 'sm'
  | 'sm-none'
  | 'sm-loose'
  | 'sm-copy'
  | 'base'
  | 'base-none'
  | 'base-roomy'
  | 'base-loose'
  | 'lg'
  | 'lg-none'
  | 'lg-roomy'
  | 'xl'
  | '2xl'
  | '2xl-none'
  | '2xl-normal'
  | '3xl'
  | '4xl'
  | '4xl-none'
  | 'prompt'
  | 'prompt-roomy';

// Only the steps a surface actually switches to at a breakpoint. A new pair
// adds its step here, which is the edit that has to be defended.
export type SmSize =
  'small' | 'medium' | 'large' | 'base' | 'lg' | 'xl' | '4xl';
export type ContainerSize = 'small' | 'medium' | 'large' | '3xl';

export type TextTone =
  | 'default'
  | 'subtle'
  | 'brand'
  | 'selected'
  | 'success'
  | 'warning'
  | 'danger'
  | 'inverse'
  | 'inverse-subtle';

export type TextWeight = 'normal' | 'semibold' | 'bold';
export type TextFont = 'mono' | 'serif';
export type TextRole = 'eyebrow' | 'display' | 'prompt';

export const TEXT_SIZE: Record<TextSize, string> = {
  xs: 'text-xs leading-normal',
  'xs-tight': 'text-xs leading-tight',
  'xs-none': 'text-xs leading-none',
  'xs-snug': 'text-xs leading-snug',
  sm: 'text-sm leading-normal',
  'sm-none': 'text-sm leading-none',
  'sm-loose': 'text-sm leading-loose',
  'sm-copy': 'text-sm leading-copy',
  base: 'text-base leading-relaxed',
  'base-none': 'text-base leading-none',
  'base-roomy': 'text-base leading-roomy',
  'base-loose': 'text-base leading-loose',
  lg: 'text-lg leading-tight',
  'lg-none': 'text-lg leading-none',
  'lg-roomy': 'text-lg leading-roomy',
  xl: 'text-xl leading-normal',
  '2xl': 'text-2xl leading-tight',
  '2xl-none': 'text-2xl leading-none',
  '2xl-normal': 'text-2xl leading-normal',
  '3xl': 'text-3xl leading-none',
  '4xl': 'text-4xl leading-tight',
  '4xl-none': 'text-4xl leading-none',
  prompt: 'text-prompt leading-normal',
  'prompt-roomy': 'text-prompt leading-roomy',
};

export type BodySize = 'small' | 'medium' | 'large' | 'fluid';

export const TEXT_BODY_SIZE: Record<BodySize, string> = {
  small: 'text-body-small',
  medium: 'text-body-medium',
  large: 'text-body-large',
  fluid: 'text-body-fluid',
};

const BODY_SIZE_CLASSES: Record<BodySize | TextSize, string> = {
  ...TEXT_SIZE,
  ...TEXT_BODY_SIZE,
};

export const TEXT_SIZE_SM: Record<SmSize, string> = {
  small: 'sm:text-body-small',
  medium: 'sm:text-body-medium',
  large: 'sm:text-body-large',
  base: 'sm:text-base sm:leading-relaxed',
  lg: 'sm:text-lg sm:leading-tight',
  xl: 'sm:text-xl sm:leading-normal',
  '4xl': 'sm:text-4xl sm:leading-tight',
};

export const TEXT_SIZE_CONTAINER: Record<ContainerSize, string> = {
  small: '@2xl:text-body-small',
  medium: '@2xl:text-body-medium',
  large: '@2xl:text-body-large',
  '3xl': '@2xl:text-3xl @2xl:leading-none',
};

export type GlyphSize = '2xs' | '3xs' | '4xs';

export const GLYPH_SIZE: Record<GlyphSize, string> = {
  '2xs': 'text-[11px] leading-none',
  '3xs': 'text-[10px] leading-none',
  '4xs': 'text-[9px] leading-none',
};

export const TEXT_TONE: Record<TextTone, string> = {
  default: 'text-default',
  subtle: 'text-subtle',
  brand: 'text-brand',
  selected: 'text-selected',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  inverse: 'text-inverse',
  'inverse-subtle': 'text-inverse-subtle',
};

export const TEXT_WEIGHT: Record<TextWeight, string> = {
  normal: 'font-normal',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const TEXT_FONT: Record<TextFont, string> = {
  mono: 'font-mono',
  serif: 'font-serif',
};

export type TextRolePreset = {
  size?: TextSize;
  weight?: TextWeight;
  font?: TextFont;
  extra?: string;
};

export const TEXT_ROLE_PRESET: Record<TextRole, TextRolePreset> = {
  eyebrow: {
    extra: 'text-heading-xxsmall',
  },
  display: { extra: 'tracking-tight' },
  prompt: {
    size: 'prompt',
    weight: 'semibold',
  },
};

export type HeadingSize =
  | 'xxlarge'
  | 'xlarge'
  | 'large'
  | 'medium'
  | 'small'
  | 'xsmall'
  | 'xxsmall'
  | 'fluid';

export const HEADING_SIZE: Record<HeadingSize, string> = {
  xxlarge: 'text-heading-xxlarge',
  xlarge: 'text-heading-xlarge',
  large: 'text-heading-large',
  medium: 'text-heading-medium',
  small: 'text-heading-small',
  xsmall: 'text-heading-xsmall',
  xxsmall: 'text-heading-xxsmall',
  fluid: 'text-heading-fluid',
};

export type HeadingVariants = {
  size: HeadingSize;
  tone?: TextTone;
  weight?: TextWeight;
};

export function headingVariants({
  size,
  tone,
  weight,
}: HeadingVariants): string {
  return [HEADING_SIZE[size], textVariants({ tone, weight })]
    .filter((entry) => entry !== '')
    .join(' ');
}

export type GlyphVariants = {
  size?: GlyphSize;
  weight?: TextWeight;
  font?: TextFont;
};

export function glyphVariants({ size, weight, font }: GlyphVariants): string {
  return [
    size === undefined ? undefined : GLYPH_SIZE[size],
    weight === undefined ? undefined : TEXT_WEIGHT[weight],
    font === undefined ? undefined : TEXT_FONT[font],
  ]
    .filter((entry): entry is string => entry !== undefined)
    .join(' ');
}

export type TextVariants = {
  size?: BodySize | TextSize;
  smSize?: SmSize;
  containerSize?: ContainerSize;
  tone?: TextTone;
  weight?: TextWeight;
  font?: TextFont;
  role?: TextRole;
};

export function textVariants({
  size,
  smSize,
  containerSize,
  tone,
  weight,
  font,
  role,
}: TextVariants): string {
  const preset = role === undefined ? undefined : TEXT_ROLE_PRESET[role];
  const resolvedSize = size ?? preset?.size;
  const resolvedWeight =
    weight ??
    (role === 'eyebrow' && size !== undefined ? 'semibold' : preset?.weight);
  const resolvedFont = font ?? preset?.font;

  return [
    resolvedSize === undefined ? undefined : BODY_SIZE_CLASSES[resolvedSize],
    smSize === undefined ? undefined : TEXT_SIZE_SM[smSize],
    containerSize === undefined
      ? undefined
      : TEXT_SIZE_CONTAINER[containerSize],
    tone === undefined ? undefined : TEXT_TONE[tone],
    resolvedWeight === undefined ? undefined : TEXT_WEIGHT[resolvedWeight],
    resolvedFont === undefined ? undefined : TEXT_FONT[resolvedFont],
    role === 'eyebrow' && size !== undefined ? undefined : preset?.extra,
  ]
    .filter((entry): entry is string => entry !== undefined)
    .join(' ');
}
