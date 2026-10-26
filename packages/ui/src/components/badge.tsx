import type { ClosedProps } from '../lib/closed';
import type { Severity } from '../lib/severity';
import { cn } from '../lib/utils';
import { badgeVariants, EYEBROW_BADGE_CLASS } from './badge-variants';

export type BadgeTone = 'neutral' | 'brand' | 'success' | Severity;
export type BadgeSize = 'sm' | 'md';
export type BadgeShape = 'rounded' | 'pill';

type BadgeBaseProps = ClosedProps<'span'>;

export type BadgeProps =
  | (BadgeBaseProps & {
      eyebrow?: false;
      tone?: BadgeTone;
      size?: BadgeSize;
      shape?: BadgeShape;
    })
  | (BadgeBaseProps & {
      eyebrow: true;
      tone?: never;
      size?: never;
      shape?: never;
    });

const Badge = ({
  eyebrow = false,
  shape,
  size,
  tone,
  ...props
}: BadgeProps) => (
  <span
    {...props}
    className={
      eyebrow ? EYEBROW_BADGE_CLASS : cn(badgeVariants({ size, shape, tone }))
    }
    style={undefined}
  />
);
Badge.displayName = 'Badge';

export { Badge };
