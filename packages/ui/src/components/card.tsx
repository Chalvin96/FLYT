import type { ClosedProps } from '../lib/closed';
import type { Severity } from '../lib/severity';
import { cn } from '../lib/utils';
import { cardVariants } from './card-variants';
import { TEXT_SIZE, TEXT_TONE, TEXT_WEIGHT } from './text-variants';

export type CardElevation = 'flat' | 'raised';
export type CardSurface = 'default' | 'solid' | 'brand' | Severity;
export type CardPadding = 'none' | 'compact' | 'default' | 'roomy';
export type CardTitleSize = 'default' | 'section' | 'title';

export type CardProps = ClosedProps<'div'> & {
  elevation?: CardElevation;
  surface?: CardSurface;
  padding?: CardPadding;
  /** Reacts to hover and focus on an ancestor carrying Tailwind's `group` class. */
  groupInteractive?: boolean;
  clipContent?: boolean;
  fillHeight?: boolean;
};

const Card = ({
  clipContent,
  elevation,
  fillHeight,
  groupInteractive,
  padding,
  surface,
  ...props
}: CardProps) => (
  <div
    {...props}
    className={cn(
      cardVariants({
        elevation,
        surface,
        padding,
        groupInteractive,
        clipContent,
        fillHeight,
      }),
    )}
    style={undefined}
  />
);
Card.displayName = 'Card';

const CardHeader = (props: ClosedProps<'div'>) => (
  <div {...props} className="flex flex-col space-y-1.5" style={undefined} />
);
CardHeader.displayName = 'CardHeader';

const CARD_TITLE_SIZE: Record<CardTitleSize, string> = {
  default: `${TEXT_SIZE['base-none']} ${TEXT_WEIGHT.semibold} tracking-tight`,
  section: `${TEXT_SIZE.lg} ${TEXT_WEIGHT.semibold}`,
  title: `${TEXT_SIZE['2xl']} ${TEXT_WEIGHT.semibold}`,
};

export type CardTitleProps = ClosedProps<'div'> & {
  size?: CardTitleSize;
  truncate?: boolean;
};

const CardTitle = ({
  size = 'default',
  truncate = false,
  ...props
}: CardTitleProps) => (
  <div
    {...props}
    className={cn(CARD_TITLE_SIZE[size], truncate && 'truncate')}
    style={undefined}
  />
);
CardTitle.displayName = 'CardTitle';

const CardDescription = (props: ClosedProps<'div'>) => (
  <div
    {...props}
    className={`${TEXT_SIZE.sm} ${TEXT_TONE.subtle}`}
    style={undefined}
  />
);
CardDescription.displayName = 'CardDescription';

const CardContent = (props: ClosedProps<'div'>) => (
  <div {...props} className={undefined} style={undefined} />
);
CardContent.displayName = 'CardContent';

export type CardFooterProps = ClosedProps<'div'> & {
  divided?: boolean;
};

const CardFooter = ({ divided = false, ...props }: CardFooterProps) => (
  <div
    {...props}
    className={cn(
      'flex items-center',
      divided && 'border-t border-default pt-4',
    )}
    style={undefined}
  />
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
