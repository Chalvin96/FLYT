import { Link } from '@tanstack/react-router';

export function LandingFooter() {
  return (
    <footer className="bg-secondary-100 text-secondary-20">
      <div className="shell-px py-10">
        <div className="container-max mx-auto flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link className="flex items-center gap-2 text-white-100" to="/">
            <span className="size-3 rounded-full bg-primary-70" />
            <span className="font-display type-title font-semibold">Flyt</span>
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 type-caption text-secondary-40">
            <Link className="hover:text-secondary-20" to="/about">
              About
            </Link>
            <a className="hover:text-secondary-20" href="/about#privacy">
              Privacy
            </a>
            <a className="hover:text-secondary-20" href="/about#contact">
              Contact
            </a>
          </nav>
          <p className="type-caption text-secondary-40">
            © {new Date().getFullYear()} Flyt
          </p>
        </div>
      </div>
    </footer>
  );
}

LandingFooter.displayName = 'LandingFooter';
