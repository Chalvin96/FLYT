import type { InlineSpan } from '@/types/lesson-contracts';

type SpanViewProps = {
  spans: InlineSpan[];
};

export function SpanView({ spans }: SpanViewProps) {
  return (
    <>
      {spans.map((span, index) => {
        switch (span.kind) {
          case 'text':
            return <span key={index}>{span.value}</span>;
          case 'emphasis':
            return <em key={index}>{span.value}</em>;
          case 'strong':
            return <strong key={index}>{span.value}</strong>;
          case 'code':
            return (
              <code key={index} className="rounded bg-secondary-10 px-1 py-0.5">
                {span.value}
              </code>
            );
          case 'foreign_term':
            return (
              <span
                key={index}
                lang={span.lang}
                className="foreign-term font-medium text-primary-80"
              >
                {span.value}
              </span>
            );
        }
      })}
    </>
  );
}
