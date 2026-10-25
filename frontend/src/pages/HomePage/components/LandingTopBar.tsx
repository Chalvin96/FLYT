import { Button, Heading, Text } from '@flyt/ui';
import { Link } from '@tanstack/react-router';

import { useMe } from '@/hooks/auth/queries';

const sections = [
  { href: '#how', label: 'How it works' },
  { href: '#review', label: 'Review' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
] as const;

export function LandingTopBar() {
  const { data: user } = useMe();
  const isAuthenticated = Boolean(user);

  return (
    <header className="sticky top-0 z-50 border-b border-default bg-neutral/85 backdrop-blur-md">
      <div className="shell-px py-4">
        <div className="container-max mx-auto flex items-center justify-between gap-4">
          <Link className="flex items-center gap-2 text-default" to="/">
            <span className="size-2.5 rounded-full bg-brand-bold" />
            <Heading as="span" size="medium" tone="default">
              Flyt
            </Heading>
          </Link>

          <nav
            aria-label="Page sections"
            className="hidden items-center gap-7 lg:flex"
          >
            {sections.map(({ href, label }) => (
              <a
                className="text-subtle hover:text-default"
                href={href}
                key={href}
              >
                <Text as="span" size="medium">
                  {label}
                </Text>
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Button asChild>
                <Link to="/home">Go to app</Link>
              </Button>
            ) : (
              <>
                <span className="hidden sm:inline-flex">
                  <Button asChild variant="ghost">
                    <Link to="/login">Log in</Link>
                  </Button>
                </span>
                <Button asChild>
                  <Link to="/login">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

LandingTopBar.displayName = 'LandingTopBar';
