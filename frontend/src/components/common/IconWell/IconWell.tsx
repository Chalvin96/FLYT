import type { LucideIcon, LucideProps } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type IconWellTone = 'primary' | 'secondary' | 'accent' | 'warning';
type IconWellSize = 'sm' | 'md' | 'lg';
type IconWellShape = 'circle' | 'field';

const base = 'flex items-center justify-center';
const shape: Record<IconWellShape, string> = {
  circle: 'rounded-full',
  field: 'radius-field',
};
const size: Record<IconWellSize, string> = {
  sm: 'size-9',
  md: 'size-10',
  lg: 'size-12',
};
const tone: Record<IconWellTone, string> = {
  accent: 'bg-accent-10 text-accent-70',
  primary: 'bg-primary-10 text-primary-70',
  secondary: 'bg-secondary-10 text-secondary-60',
  warning: 'bg-warning-10 text-warning-70',
};

const ICON_SIZE_MAP: Record<IconWellSize, string> = {
  lg: 'icon-lg',
  md: 'icon-md',
  sm: 'icon-sm',
};

interface IconWellProps {
  children?: ReactNode;
  className?: string;
  icon?: LucideIcon;
  iconProps?: Partial<LucideProps>;
  shape?: IconWellShape;
  size?: IconWellSize;
  tone?: IconWellTone;
}

export function IconWell({
  children,
  className,
  icon: Icon,
  iconProps,
  shape: shapeProp = 'field',
  size: sizeProp = 'md',
  tone: toneProp,
}: IconWellProps) {
  return (
    <span
      className={cn(
        base,
        shape[shapeProp],
        size[sizeProp],
        toneProp && tone[toneProp],
        className,
      )}
    >
      {Icon ? (
        <Icon className={ICON_SIZE_MAP[sizeProp]} aria-hidden {...iconProps} />
      ) : (
        children
      )}
    </span>
  );
}

export type { IconWellProps, IconWellShape, IconWellSize, IconWellTone };
