import { Text } from '@flyt/ui';

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
        <div className="mt-2 first:mt-0">
          <Text as={Tag} size="lg" weight="semibold" tone="default">
            <SpanView spans={block.spans} />
          </Text>
        </div>
      );
    }
    case 'paragraph':
      return (
        <Text size="medium" smSize="large" tone="default">
          <SpanView spans={block.spans} />
        </Text>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={cn(
            'space-y-2 pl-5',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, itemIndex) => (
            <Text
              as="li"
              size="medium"
              key={`${itemIndex}-${JSON.stringify(item)}`}
            >
              <SpanView spans={item} />
            </Text>
          ))}
        </Tag>
      );
    }
    case 'rule':
      return (
        <div className="radius-field border-l-4 border-selected bg-brand-subtle p-3">
          <Text as="div" size="medium">
            <SpanView spans={block.statement} />
          </Text>
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
        <div className="overflow-x-auto radius-field border border-default">
          <table className="w-full border-collapse text-left">
            <thead className="bg-neutral-subtle">
              <tr>
                {block.headers.map((header, columnIndex) => {
                  const lang = columnLang(block, columnIndex);
                  return (
                    <th
                      key={`${columnIndex}-${lang ?? 'unset'}-${JSON.stringify(header)}`}
                      lang={lang}
                      className={cn(
                        'border-b border-default px-3 py-2',
                        lang === 'no' && 'col-target',
                      )}
                    >
                      <Text as="div" size="medium" weight="semibold">
                        <SpanView spans={header} />
                      </Text>
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
                          'border-t border-default px-3 py-2',
                          lang === 'no' && 'col-target',
                        )}
                      >
                        <Text
                          as="div"
                          size="medium"
                          weight={lang === 'no' ? 'semibold' : undefined}
                        >
                          <SpanView spans={cell} />
                        </Text>
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
            'space-y-3 radius-field border p-3',
            block.level === 'warning'
              ? 'border-warning bg-warning-subtle'
              : 'border-brand-subtle bg-brand-subtle',
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
