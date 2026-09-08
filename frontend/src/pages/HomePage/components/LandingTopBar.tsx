import { Link } from '@tanstack/react-router';

import { Button } from '@/components/common/Button/Button';
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="shell-px py-4">
        <div className="container-max mx-auto flex items-center justify-between gap-4">
          <Link className="flex items-center gap-2 text-foreground" to="/">
            <span className="size-2.5 rounded-full bg-primary-70" />
            <span className="font-display type-section font-semibold tracking-tight">
              Flyt
            </span>
          </Link>

          <nav
            aria-label="Page sections"
            className="hidden items-center gap-7 lg:flex"
          >
            {sections.map(({ href, label }) => (
              <a
                className="type-caption text-muted-foreground hover:text-foreground"
                href={href}
                key={href}
              >
                {label}
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
                <Button
                  asChild
                  className="hidden sm:inline-flex"
                  variant="ghost"
                >
                  <Link to="/login">Log in</Link>
                </Button>
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
