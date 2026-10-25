import { Slot } from '@radix-ui/react-slot';

import type { ClosedProps } from '../lib/closed';
import { cn } from '../lib/utils';
import { TEXT_SIZE, TEXT_TONE } from './text-variants';

const Breadcrumb = (props: ClosedProps<'nav'>) => (
  <nav
    {...props}
    aria-label="breadcrumb"
    className={undefined}
    style={undefined}
  />
);
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = (props: ClosedProps<'ol'>) => (
  <ol
    {...props}
    role="list"
    className={`flex flex-wrap items-center gap-1.5 break-words ${TEXT_SIZE.sm} ${TEXT_TONE.subtle}`}
    style={undefined}
  />
);
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = (props: ClosedProps<'li'>) => (
  <li
    {...props}
    className="inline-flex min-w-0 items-center gap-1.5"
    style={undefined}
  />
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

export type BreadcrumbLinkProps = ClosedProps<'a'> & { asChild?: boolean };

const BreadcrumbLink = ({ asChild = false, ...props }: BreadcrumbLinkProps) => {
  const Component = asChild ? Slot : 'a';
  return (
    <Component
      {...props}
      className={cn('min-w-0 transition-colors hover:text-default')}
      style={undefined}
    />
  );
};
BreadcrumbLink.displayName = 'BreadcrumbLink';

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink };
