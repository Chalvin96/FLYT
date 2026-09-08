import { ArrowLeft } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';

type BackLinkBase = {
  children: React.ReactNode;
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
      <Button variant="link" size="default" asChild className={className}>
        <Link
          to={props.to}
          params={props.params as never}
          search={props.search as never}
        >
          {content}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="link"
      size="default"
      onClick={props.onClick}
      className={className}
    >
      {content}
    </Button>
  );
}

BackLink.displayName = 'BackLink';
