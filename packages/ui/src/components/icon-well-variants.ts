export type IconWellTone = 'neutral' | 'brand' | 'success';
export type IconWellSize = 'sm' | 'md' | 'lg';
export type IconWellShape = 'circle' | 'field';

export const ICON_WELL_BASE = 'flex items-center justify-center';

export const ICON_WELL_SHAPE: Record<IconWellShape, string> = {
  circle: 'rounded-full',
  field: 'radius-field',
};

export const ICON_WELL_SIZE: Record<IconWellSize, string> = {
  sm: 'size-9',
  md: 'size-10',
  lg: 'size-12',
};

export const ICON_WELL_TONE: Record<IconWellTone, string> = {
  brand: 'bg-brand-subtle text-icon-brand',
  neutral: 'bg-neutral-subtle text-icon-default',
  success: 'bg-success-subtle text-icon-success',
};

export const ICON_WELL_ICON_SIZE: Record<IconWellSize, string> = {
  lg: 'icon-lg',
  md: 'icon-md',
  sm: 'icon-sm',
};
