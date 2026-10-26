import { Heading, Text } from '@flyt/ui';
import { Link } from '@tanstack/react-router';

export function LandingFooter() {
  return (
    <footer className="bg-inverse text-inverse-subtle">
      <div className="shell-px py-10">
        <div className="container-max mx-auto flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link className="flex items-center gap-2 text-inverse" to="/">
            <span className="size-3 rounded-full bg-brand-bold" />
            <Heading as="span" size="large">
              Flyt
            </Heading>
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-inverse-subtle/65">
            <Link className="hover:text-inverse" to="/about">
              <Text as="span" size="medium">
                About
              </Text>
            </Link>
            <a className="hover:text-inverse" href="/about#privacy">
              <Text as="span" size="medium">
                Privacy
              </Text>
            </a>
            <a className="hover:text-inverse" href="/about#contact">
              <Text as="span" size="medium">
                Contact
              </Text>
            </a>
          </nav>
          <Text size="medium" tone="inverse-subtle">
            © {new Date().getUTCFullYear()} Flyt
          </Text>
        </div>
      </div>
    </footer>
  );
}

LandingFooter.displayName = 'LandingFooter';
