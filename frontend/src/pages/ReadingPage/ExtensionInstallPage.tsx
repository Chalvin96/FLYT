import { Badge, Heading, Text } from '@flyt/ui';

type BrowserId = 'chrome' | 'firefox' | 'edge' | 'safari' | 'other';

const BROWSERS = [
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
    title: 'Open a Norwegian article',
    body: 'A news story, a blog, or any page you want to read.',
  },
  {
    title: 'Click Import in FlytLese',
    body: 'The extension copies the article text into Flyt.',
  },
  {
    title: 'Read it in Flyt',
    body: 'Tap words to look them up and see the vocabulary you know.',
  },
] as const;

export function ExtensionInstallPage() {
  const detected =
    typeof navigator === 'undefined'
      ? 'other'
      : detectBrowser(navigator.userAgent);
  const browsers = [...BROWSERS].sort(
    (left, right) =>
      Number(right.id === detected) - Number(left.id === detected),
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-9 pb-10">
      <header className="max-w-2xl space-y-3">
        <Heading as="h1" size="xlarge">
          Read Norwegian pages in Flyt
        </Heading>
        <Text as="p" size="medium" tone="subtle">
          FlytLese is a browser extension. It imports the article you’re
          reading, so you can tap words and practise your vocabulary in Flyt.
        </Text>
      </header>
      <section aria-label="How importing works">
        <ol role="list" className="grid gap-5 md:grid-cols-3">
          {FLOW.map(({ title, body }, index) => (
            <li key={title} className="space-y-1">
              <Heading as="h2" size="medium">
                {index + 1}. {title}
              </Heading>
              <Text as="p" size="small" tone="subtle">
                {body}
              </Text>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="install-heading" className="space-y-4">
        <Heading as="h2" id="install-heading" size="large">
          Get FlytLese
        </Heading>
        <Text as="p" size="medium" tone="subtle">
          Store listings are on the way. Chrome and Edge will be supported
          first.
        </Text>
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {browsers.map((browser) => (
            <li
              key={browser.id}
              className={`radius-section border p-4 ${browser.id === detected ? 'border-brand-subtle bg-brand-subtle' : 'border-default bg-overlay'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Heading as="h3" size="medium">
                  {browser.store}
                </Heading>
                <Badge tone="neutral">Coming soon</Badge>
              </div>
              <div className="mt-2">
                <Text as="p" size="small" tone="subtle">
                  {browser.id === detected
                    ? `You’re using ${browser.name}.`
                    : `For ${browser.name}.`}
                </Text>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <aside className="radius-field border border-default bg-neutral-subtle p-4">
        <Heading as="h2" size="medium">
          Safari isn’t supported yet
        </Heading>
        <div className="mt-1">
          <Text as="p" size="medium" tone="subtle">
            Safari needs its own App Store version. Firefox is also not
            supported yet.
          </Text>
        </div>
      </aside>
    </div>
  );
}
