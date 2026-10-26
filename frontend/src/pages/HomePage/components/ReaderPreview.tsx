import { Heading, Text } from '@flyt/ui';

import { cn } from '@/lib/utils';

const tabs = ['Lessons', 'Reading', 'Review'] as const;

export function ReaderPreview() {
  return (
    <div className="radius-section border border-default bg-raised shadow-raised">
      <div className="flex items-center gap-2 rounded-t-[calc(var(--radius-section)-1px)] border-b border-default bg-gradient-to-b from-[var(--background-neutral)] to-[var(--surface-raised)] px-4 py-3">
        {[0, 1, 2].map((dot) => (
          <span className="size-2 rounded-full bg-neutral-pressed" key={dot} />
        ))}
        <div className="ml-3 flex gap-1">
          {tabs.map((tab) => (
            <span
              className={cn(
                'radius-sm px-3 py-1',
                tab === 'Reading' ? 'bg-selected text-selected' : 'text-subtle',
              )}
              key={tab}
            >
              <Text as="span" size="small" weight="semibold">
                {tab}
              </Text>
            </span>
          ))}
        </div>
      </div>

      <div className="relative px-6 pb-20 pt-6 sm:pb-24">
        <Heading as="div" size="xxsmall" tone="subtle">
          Story · level A2
        </Heading>
        <div className="mt-1.5">
          <Heading as="div" size="medium">
            Kaffe på Grünerløkka
          </Heading>
        </div>
        <div className="mt-3.5 max-w-[30ch]">
          <Text as="p" size="large" tone="default">
            Hun{' '}
            <span className="rounded-sm bg-neutral-subtle px-0.5">
              bestilte
            </span>{' '}
            en kopp kaffe og satte seg ved{' '}
            <span className="word-underline-new">vinduet</span>. Utenfor{' '}
            <span className="radius-sm bg-brand-bold px-1 py-0.5 text-inverse shadow-commit">
              regnet
            </span>{' '}
            det, men inne var det{' '}
            <span className="word-underline-new">lunt</span> og stille.
          </Text>
        </div>
      </div>
    </div>
  );
}

ReaderPreview.displayName = 'ReaderPreview';
