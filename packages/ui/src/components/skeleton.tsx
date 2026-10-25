import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { skeletonVariants } from './skeleton-variants';

export type SkeletonLength = 'short' | 'medium' | 'long' | 'full';
export type SkeletonShape = 'rounded' | 'field' | 'section' | 'pill';
export type SkeletonBlockSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

type SkeletonBaseProps = Omit<ClosedProps<'div'>, 'children'>;

export type SkeletonProps = SkeletonBaseProps &
  (
    | { variant?: 'text'; size?: 'sm' | 'md'; length?: SkeletonLength }
    | {
        variant: 'heading';
        size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
        length?: SkeletonLength;
      }
    | { variant: 'control'; size?: 'sm' | 'md'; shape?: 'rounded' | 'pill' }
    | { variant: 'block'; shape?: SkeletonShape; size?: SkeletonBlockSize }
  );

const Skeleton = ({ ...props }: SkeletonProps) => {
  const { length, shape, size, variant, ...rest } =
    props as SkeletonBaseProps & {
      variant?: 'text' | 'heading' | 'control' | 'block';
      size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
      length?: SkeletonLength;
      shape?: SkeletonShape;
    };
  return (
    <div
      {...rest}
      className={cn(
        skeletonVariants({
          variant: variant ?? 'text',
          size,
          length,
          shape,
        }),
      )}
      style={undefined}
    />
  );
};
Skeleton.displayName = 'Skeleton';

export { Skeleton };
