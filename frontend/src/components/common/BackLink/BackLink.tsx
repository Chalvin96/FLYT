import { Button } from '@flyt/ui';
import { ArrowLeft } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

type BackLinkBase = {
  children: React.ReactNode;
  /** Placement in the caller's layout. Applied to the wrapper, not the button. */
  className?: string;
};

type BackLinkAsLink = BackLinkBase & {
  to: ComponentProps<typeof Link>['to'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  search?: Record<string, any>;
  onClick?: undefined;
};

type BackLinkAsButton = BackLinkBase & {
  to?: undefined;
  onClick: () => void;
};

export type BackLinkProps = BackLinkAsLink | BackLinkAsButton;

export function BackLink(props: BackLinkProps) {
  const { children, className } = props;

  const content = (
    <>
      <ArrowLeft aria-hidden className="icon-sm shrink-0" />
      {children}
    </>
  );

  if (props.to !== undefined) {
    return (
      <span className={cn('inline-flex', className)}>
        <Button variant="link" asChild>
          <Link
            to={props.to}
            params={props.params as never}
            search={props.search as never}
          >
            {content}
          </Link>
        </Button>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex', className)}>
      <Button variant="link" onClick={props.onClick}>
        {content}
      </Button>
    </span>
  );
}

BackLink.displayName = 'BackLink';
