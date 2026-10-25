import { Heading, Text } from '@flyt/ui';

const grades = [
  { interval: '<1 min', label: 'Again' },
  { interval: '2 d', label: 'Hard' },
  { interval: '6 d', label: 'Good' },
  { interval: '14 d', label: 'Easy' },
] as const;

export function ReviewCardPreview() {
  return (
    <div className="radius-section border border-default bg-raised p-6 shadow-raised sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-neutral-subtle px-2.5 py-1 text-default">
          <Heading as="span" size="xxsmall">
            From your reading
          </Heading>
        </span>
        <Text as="span" size="small" weight="semibold" tone="subtle">
          4 / 12
        </Text>
      </div>

      <div className="mt-5">
        <Heading as="div" size="fluid">
          regne
        </Heading>
      </div>
      <div className="mt-2.5">
        <Text as="p" size="medium" tone="subtle">
          Utenfor{' '}
          <mark className="radius-sm bg-brand-subtle px-1 text-selected">
            regnet
          </mark>{' '}
          det, men inne var det lunt og stille.
        </Text>
      </div>

      <p className="mt-5 flex flex-wrap items-baseline gap-2 border-t border-dashed border-default pt-4">
        <Text as="b" size="large" weight="semibold">
          to rain
        </Text>
        <Text as="span" size="medium" tone="subtle">
          · regner · regnet · har regnet
        </Text>
      </p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {grades.map(({ interval, label }) => (
          <span
            className={
              label === 'Good'
                ? 'flex flex-col radius-field border border-brand-subtle bg-selected px-1 py-2.5 text-center text-selected shadow-commit'
                : 'flex flex-col radius-field border border-default bg-neutral px-1 py-2.5 text-center text-subtle'
            }
            key={label}
          >
            <Text as="span" size="medium" weight="semibold">
              {label}
            </Text>
            <span className="flex opacity-70">
              <Text as="span" size="small">
                {interval}
              </Text>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

ReviewCardPreview.displayName = 'ReviewCardPreview';
