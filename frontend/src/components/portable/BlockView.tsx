import { assertNever } from '@/lib/assertNever';
import { cn } from '@/lib/utils';
import type { AudioAsset, Block, Lang } from '@/types/lesson-contracts';

import { ExampleGroupView } from './ExampleGroupView';
import { ReadingBlock } from './ReadingBlock';
import { SpanView } from './SpanView';

function columnLang(
  block: { col_langs: Lang[] },
  index: number,
): Lang | undefined {
  return block.col_langs[index];
}

const EMPTY_AUDIO_BY_ID: Record<string, AudioAsset> = {};

export function BlockView({
  block,
  audioById = EMPTY_AUDIO_BY_ID,
}: {
  block: Block;
  audioById?: Record<string, AudioAsset>;
}) {
  switch (block.kind) {
    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : 'h4';
      return (
        <Tag className="mt-2 type-section font-semibold text-foreground first:mt-0">
          <SpanView spans={block.spans} />
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="type-caption leading-6 text-foreground sm:type-body">
          <SpanView spans={block.spans} />
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'space-y-2 pl-5 type-caption leading-6',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, itemIndex) => (
            <li key={`${itemIndex}-${JSON.stringify(item)}`}>
              <SpanView spans={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'rule':
      return (
        <div className="rounded-field border-l-4 border-primary-70 bg-primary-5 p-3 type-caption leading-6">
          <SpanView spans={block.statement} />
        </div>
      );
    case 'example':
      return <ExampleGroupView blocks={[block]} audioById={audioById} />;
    case 'examples':
      return (
        <ExampleGroupView
          blocks={block.items.map((item) => ({ kind: 'example', ...item }))}
          audioById={audioById}
        />
      );
    case 'table':
      return (
        <div className="overflow-x-auto radius-field border border-border">
          <table className="w-full border-collapse text-left type-caption">
            <thead className="bg-secondary-10">
              <tr>
                {block.headers.map((header, columnIndex) => {
                  const lang = columnLang(block, columnIndex);
                  return (
                    <th
                      key={`${columnIndex}-${lang ?? 'unset'}-${JSON.stringify(header)}`}
                      lang={lang}
                      className={cn(
                        'border-b border-border px-3 py-2 font-semibold',
                        lang === 'no' && 'col-target',
                      )}
                    >
                      <SpanView spans={header} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${JSON.stringify(row)}`}>
                  {row.map((cell, columnIndex) => {
                    const lang = columnLang(block, columnIndex);
                    return (
                      <td
                        key={`${columnIndex}-${lang ?? 'unset'}-${JSON.stringify(cell)}`}
                        lang={lang}
                        className={cn(
                          'border-t border-border px-3 py-2',
                          lang === 'no' && 'col-target font-medium',
                        )}
                      >
                        <SpanView spans={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'reading':
      return (
        <ReadingBlock
          block={block}
          audio={block.audio_id ? audioById[block.audio_id] : null}
        />
      );
    case 'callout':
      return (
        <aside
          className={cn(
            'space-y-3 rounded-field border p-3',
            block.level === 'warning'
              ? 'border-warning-50 bg-warning-10'
              : 'border-primary-20 bg-primary-10',
          )}
        >
          {block.blocks.map((child) => (
            <BlockView key={child.id} block={child} audioById={audioById} />
          ))}
        </aside>
      );
    default:
      return assertNever(block);
  }
}
