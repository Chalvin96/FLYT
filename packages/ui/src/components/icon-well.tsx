import type { LucideIcon } from 'lucide-react';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import {
  ICON_WELL_BASE,
  ICON_WELL_ICON_SIZE,
  ICON_WELL_SHAPE,
  ICON_WELL_SIZE,
  ICON_WELL_TONE,
} from './icon-well-variants';
import type {
  IconWellShape,
  IconWellSize,
  IconWellTone,
} from './icon-well-variants';

export type { IconWellShape, IconWellSize, IconWellTone };

export type IconWellProps = ClosedProps<'span'> & {
  icon?: LucideIcon;
  iconStrokeWidth?: number;
  shape?: IconWellShape;
  size?: IconWellSize;
  tone?: IconWellTone;
};

const IconWell = ({
  children,
  icon: Icon,
  iconStrokeWidth,
  shape = 'field',
  size = 'md',
  tone,
  ...props
}: IconWellProps) => (
  <span
    {...props}
    className={cn(
      ICON_WELL_BASE,
      ICON_WELL_SHAPE[shape],
      ICON_WELL_SIZE[size],
      tone === undefined ? undefined : ICON_WELL_TONE[tone],
    )}
    style={undefined}
  >
    {Icon === undefined ? (
      children
    ) : (
      <Icon
        aria-hidden
        className={ICON_WELL_ICON_SIZE[size]}
        strokeWidth={iconStrokeWidth}
      />
    )}
  </span>
);
IconWell.displayName = 'IconWell';

export { IconWell };
