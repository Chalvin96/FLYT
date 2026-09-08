import { Badge, Button } from '@flyt/ui';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ExternalLink,
  Globe,
  MousePointerClick,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

type BrowserId = 'chrome' | 'firefox' | 'edge' | 'safari' | 'other';

interface BrowserInfo {
  id: BrowserId;
  name: string;
  store: string;
}

const BROWSERS: readonly BrowserInfo[] = [
  { id: 'chrome', name: 'Chrome', store: 'Chrome Web Store' },
  { id: 'edge', name: 'Edge', store: 'Microsoft Edge Add-ons' },
] as const;

function detectBrowser(userAgent: string): BrowserId {
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('firefox/')) return 'firefox';
  if (ua.includes('chrome/') || ua.includes('chromium/')) return 'chrome';
  if (ua.includes('safari/')) return 'safari';
  return 'other';
}

const FLOW = [
  {
    icon: <Globe aria-hidden />,
    title: 'Open a Norwegian article',
    body: 'Any page in your browser — news, a blog, a story.',
  },
  {
    icon: <MousePointerClick aria-hidden />,
    title: 'Click Import in FlytLese',
    body: 'The extension reads just the article text — not the whole page.',
  },
  {
    icon: <BookOpenText aria-hidden />,
    title: 'Read it in Flyt',
    body: 'Tappable words and your vocabulary, already connected.',
  },
] as const;

export function ExtensionInstallPage() {
  const detected =
    typeof navigator === 'undefined'
      ? 'other'
      : detectBrowser(navigator.userAgent);
  const primary = BROWSERS.find((b) => b.id === detected);

  return (
    <div className="container-max mx-auto w-full max-w-5xl space-y-12 pb-14">
      <header className="max-w-3xl">
        <Link
          to="/reading/imports"
          className="inline-flex items-center gap-1 type-caption-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <ArrowLeft className="icon-sm" aria-hidden />
          Your imports
        </Link>
        <Badge className="mt-6 border-primary-20 bg-primary-10 text-primary-80 hover:bg-primary-10">
          FlytLese browser extension
        </Badge>
        <h1 className="mt-4 max-w-2xl font-display type-display font-semibold text-secondary-100">
          Turn the page you&apos;re reading into a Flyt story
        </h1>
        <p className="mt-3 max-w-xl type-body leading-7 text-secondary-70">
          FlytLese lives in your browser toolbar. One click sends the article
          you&apos;re reading into Flyt, ready to tap through.
        </p>
      </header>

      {/* The flow: page → extension → Flyt. */}
      <section aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="sr-only">
          How importing works
        </h2>
        <ol
          role="list"
          className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-0"
        >
          {FLOW.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-1 items-start gap-4 md:flex-col md:items-center md:gap-0 md:text-center"
            >
              <div className="flex flex-col items-center md:w-full">
                <div className="flex items-center gap-4 md:w-full md:flex-col">
                  <span className="relative flex size-14 shrink-0 items-center justify-center radius-pill bg-primary-10 text-primary-80 shadow-raised [&_svg]:icon-md">
                    {step.icon}
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center radius-pill bg-primary-80 type-caption-sm font-semibold text-white-100">
                      {index + 1}
                    </span>
                  </span>
                  {index < FLOW.length - 1 ? (
                    <ArrowRight
                      aria-hidden
                      className="hidden text-secondary-30 md:mt-4 md:block md:rotate-0"
                    />
                  ) : null}
                </div>
              </div>
              <div className="md:mt-4 md:px-3">
                <h3 className="font-display type-section font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 max-w-[16rem] type-caption-sm leading-5 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Install: lead with the visitor's own browser. */}
      <section aria-labelledby="install-heading" className="space-y-5">
        <div className="flex flex-col gap-1">
          <p className="type-label text-primary-70">Install</p>
          <h2
            id="install-heading"
            className="font-display type-title-lg font-semibold text-foreground"
          >
            {primary ? `Add FlytLese to ${primary.name}` : 'Add FlytLese'}
          </h2>
          <p className="max-w-xl type-caption-sm text-muted-foreground">
            One Chromium Manifest V3 build serves Chrome and Edge. Firefox and
            Safari are not supported yet.
          </p>
        </div>

        {primary ? (
          <div className="radius-section border border-primary-30 bg-primary-10/60 p-5 shadow-raised">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="type-caption-sm font-semibold text-primary-80">
                  We detected {primary.name}
                </p>
                <h3 className="font-display type-section font-semibold text-foreground">
                  {primary.store}
                </h3>
              </div>
              {/* Store listing is unpublished. */}
              <Button disabled className="shrink-0">
                Coming to {primary.name}
                <ExternalLink aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {BROWSERS.map((browser) => {
            const isPrimary = browser.id === detected;
            return (
              <li
                key={browser.id}
                className={
                  isPrimary
                    ? 'radius-field border border-primary-30 bg-primary-10/40 p-4'
                    : 'radius-field border border-border bg-card p-4 transition-colors hover:border-secondary-40'
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="type-caption font-semibold text-foreground">
                    {browser.name}
                  </h3>
                  {isPrimary ? (
                    <Badge className="border-primary-20 bg-primary-10 text-primary-80 hover:bg-primary-10">
                      Yours
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled
                >
                  {browser.store} link coming soon
                  <ExternalLink aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="radius-section border border-warning/40 bg-warning/10 px-5 py-4">
        <h2 className="font-display type-section font-semibold text-foreground">
          Safari is not yet supported
        </h2>
        <p className="mt-1 type-caption text-muted-foreground">
          Safari needs separate packaging and App Store review, so support is
          deferred for now.
        </p>
      </aside>
    </div>
  );
}

ExtensionInstallPage.displayName = 'ExtensionInstallPage';
