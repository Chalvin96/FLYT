import { Text } from '@flyt/ui';

import type { InlineSpan } from '@/types/lesson-contracts';

type SpanViewProps = {
  spans: InlineSpan[];
};

export function SpanView({ spans }: SpanViewProps) {
  const occurrences = new Map<string, number>();

  return (
    <>
      {spans.map((span) => {
        const identity = JSON.stringify(span);
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        const key = `${identity}-${occurrence}`;

        switch (span.kind) {
          case 'text':
            return <span key={key}>{span.value}</span>;
          case 'emphasis':
            return <em key={key}>{span.value}</em>;
          case 'strong':
            return <strong key={key}>{span.value}</strong>;
          case 'code':
            return (
              <code
                key={key}
                className="rounded-sm bg-neutral-subtle px-1 py-0.5"
              >
                {span.value}
              </code>
            );
          case 'foreign_term':
            return (
              <Text
                as="span"
                key={key}
                lang={span.lang}
                weight="semibold"
                tone="selected"
              >
                {span.value}
              </Text>
            );
        }
      })}
    </>
  );
}
