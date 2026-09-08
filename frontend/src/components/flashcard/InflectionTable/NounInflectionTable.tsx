import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WordFormRead } from '@/types/api';

import {
  buildNounTableModel,
  getGenderArticle,
  getNounForm,
  getNounPluralSpan,
  shortenInflectionLabel,
  translateGenderNo,
} from './utils';

type InflectionLayout = 'auto' | 'horizontal' | 'vertical';

const thCls =
  'border border-border bg-secondary-10 px-3 py-2 text-center type-caption-sm font-semibold text-muted-foreground';
const tdCls =
  'border border-border px-3 py-2 text-left type-caption font-semibold text-foreground';
const tdMutedCls = 'text-muted-foreground italic type-caption-sm';

const desktopPanel =
  'radius-section overflow-hidden border border-border bg-card';
const headerCell =
  'type-label-xs flex w-32 shrink-0 items-center bg-secondary-10 p-2.5 text-muted-foreground';
const dataCell =
  'flex min-w-0 flex-1 items-center p-2.5 type-caption font-medium text-foreground';
const divider = 'divide-y divide-border';
const sectionLabel =
  'type-label-xs bg-secondary-10 p-2 text-center uppercase text-muted-foreground';

function desktopCls(layout: InflectionLayout): string {
  if (layout === 'auto') return 'hidden lg:block';
  if (layout === 'horizontal') return 'block';
  return 'hidden';
}

const mobileBase =
  'radius-section overflow-hidden border border-border bg-card';
function mobileCls(layout: InflectionLayout): string {
  if (layout === 'horizontal') return 'hidden';
  if (layout === 'auto') return `block lg:hidden ${mobileBase}`;
  return mobileBase;
}

export function NounInflectionTable({
  wordForms,
  layout,
}: {
  wordForms: WordFormRead[];
  layout: InflectionLayout;
}) {
  const { data, sortedGenders } = buildNounTableModel(wordForms);

  return (
    <div className="w-full type-caption">
      {/* DESKTOP VIEW — ordbokene style */}
      <div className={desktopCls(layout)}>
        <div className={desktopPanel}>
          <Table className="min-w-max border-collapse">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                {sortedGenders.length > 1 && (
                  <TableHead className={thCls} rowSpan={2} />
                )}
                <TableHead colSpan={2} className={thCls}>
                  entall
                </TableHead>
                <TableHead colSpan={2} className={thCls}>
                  flertall
                </TableHead>
              </TableRow>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={thCls}>
                  {shortenInflectionLabel('ubestemt form')}
                </TableHead>
                <TableHead className={thCls}>bestemt form</TableHead>
                <TableHead className={thCls}>
                  {shortenInflectionLabel('ubestemt form')}
                </TableHead>
                <TableHead className={thCls}>bestemt form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGenders.map((gender, idx) => {
                const pluralIndSpan = getNounPluralSpan(
                  data,
                  sortedGenders,
                  idx,
                  'Indefinite',
                );
                const pluralDefSpan = getNounPluralSpan(
                  data,
                  sortedGenders,
                  idx,
                  'Definite',
                );
                const article = getGenderArticle(gender);
                return (
                  <TableRow
                    key={gender}
                    className="border-0 hover:bg-transparent"
                  >
                    {sortedGenders.length > 1 && (
                      <TableCell className={`${thCls} text-left`}>
                        {translateGenderNo(gender)}
                      </TableCell>
                    )}
                    <TableCell className={tdCls}>
                      <span className={tdMutedCls}>{article}</span>
                      {getNounForm(data, gender, 'Singular', 'Indefinite')}
                    </TableCell>
                    <TableCell className={tdCls}>
                      {getNounForm(data, gender, 'Singular', 'Definite')}
                    </TableCell>
                    {pluralIndSpan > 0 && (
                      <TableCell className={tdCls} rowSpan={pluralIndSpan}>
                        {getNounForm(data, gender, 'Plural', 'Indefinite')}
                      </TableCell>
                    )}
                    {pluralDefSpan > 0 && (
                      <TableCell className={tdCls} rowSpan={pluralDefSpan}>
                        {getNounForm(data, gender, 'Plural', 'Definite')}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MOBILE VIEW — stacked sections */}
      <div data-testid="inflection-mobile" className={mobileCls(layout)}>
        {sortedGenders.length > 1 && (
          <div className="flex border-b border-border bg-secondary-10">
            <div className="w-32 shrink-0 p-2" />
            <div className="flex min-w-0 flex-1">
              {sortedGenders.map((g) => (
                <div
                  key={g}
                  className="type-label-xs min-w-0 flex-1 truncate border-l border-border p-2 text-center text-muted-foreground first:border-l-0"
                  title={translateGenderNo(g)}
                >
                  {translateGenderNo(g)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={`${sectionLabel} border-b border-border`}>entall</div>
        <div className={divider}>
          {(['Indefinite', 'Definite'] as const).map((def) => (
            <div
              key={def}
              className="flex border-b border-border last:border-b-0"
            >
              <div className={headerCell}>
                {shortenInflectionLabel(
                  def === 'Indefinite' ? 'ubestemt form' : 'bestemt form',
                )}
              </div>
              <div className="flex min-w-0 flex-1">
                {sortedGenders.map((g, idx) => (
                  <div
                    key={g}
                    className={`${dataCell}${idx > 0 ? ' border-l border-border' : ''}`}
                  >
                    {def === 'Indefinite' && (
                      <span className="text-muted-foreground italic type-caption-sm">
                        {getGenderArticle(g)}
                      </span>
                    )}
                    {getNounForm(data, g, 'Singular', def)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={`${sectionLabel} border-y border-border`}>flertall</div>
        <div className={divider}>
          {(['Indefinite', 'Definite'] as const).map((def) => {
            const cells: { gender: string; form: string; span: number }[] = [];
            let i = 0;
            while (i < sortedGenders.length) {
              const currentForm = getNounForm(
                data,
                sortedGenders[i],
                'Plural',
                def,
              );
              let span = 1;
              for (let j = i + 1; j < sortedGenders.length; j++) {
                if (
                  getNounForm(data, sortedGenders[j], 'Plural', def) ===
                  currentForm
                )
                  span++;
                else break;
              }
              cells.push({ gender: sortedGenders[i], form: currentForm, span });
              i += span;
            }
            return (
              <div
                key={def}
                className="flex border-b border-border last:border-b-0"
              >
                <div className={headerCell}>
                  {shortenInflectionLabel(
                    def === 'Indefinite' ? 'ubestemt form' : 'bestemt form',
                  )}
                </div>
                <div className="flex min-w-0 flex-1">
                  {cells.map((cell, cellIdx) => (
                    <div
                      key={`${cell.gender}-${cellIdx}`}
                      className={`${dataCell}${cellIdx > 0 ? ' border-l border-border' : ''}`}
                      style={{ flex: `${cell.span} 1 0` }}
                    >
                      {cell.form}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
