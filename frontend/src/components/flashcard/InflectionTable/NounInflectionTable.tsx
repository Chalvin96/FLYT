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
  buildDesktopClassName,
  buildMobileClassName,
  dataCellCls,
  dividerCls,
  headerCellCls,
  panelCls,
  sectionLabelCls,
  tdCls,
  tdMutedCls,
  thCls,
  type InflectionLayout,
} from './inflectionStyles';
import {
  buildNounTableModel,
  getGenderArticle,
  getNounForm,
  getNounPluralSpan,
  shortenInflectionLabel,
  translateGenderNo,
} from './utils';

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
      <div className={buildDesktopClassName(layout)}>
        <div className={panelCls}>
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

      <div
        data-testid="inflection-mobile"
        className={buildMobileClassName(layout)}
      >
        {sortedGenders.length > 1 && (
          <div className="flex border-b border-border bg-secondary-10">
            <div className="w-32 shrink-0 p-2" />
            <div className="flex min-w-0 flex-1">
              {sortedGenders.map((g) => (
                <div
                  key={g}
                  className="type-label-xs min-w-0 flex-1 truncate border-l border-border px-3 py-2 text-center text-secondary-80 first:border-l-0"
                  title={translateGenderNo(g)}
                >
                  {translateGenderNo(g)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={`${sectionLabelCls} border-b border-border`}>
          entall
        </div>
        <div className={dividerCls}>
          {(['Indefinite', 'Definite'] as const).map((def) => (
            <div key={def} className="flex">
              <div className={headerCellCls}>
                {shortenInflectionLabel(
                  def === 'Indefinite' ? 'ubestemt form' : 'bestemt form',
                )}
              </div>
              <div className="flex min-w-0 flex-1">
                {sortedGenders.map((g, idx) => (
                  <div
                    key={g}
                    className={`${dataCellCls}${idx > 0 ? ' border-l border-border' : ''}`}
                  >
                    {def === 'Indefinite' && (
                      <span className="mr-1 type-caption-sm italic text-muted-foreground">
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
        <div className={`${sectionLabelCls} border-y border-border`}>
          flertall
        </div>
        <div className={dividerCls}>
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
              <div key={def} className="flex">
                <div className={headerCellCls}>
                  {shortenInflectionLabel(
                    def === 'Indefinite' ? 'ubestemt form' : 'bestemt form',
                  )}
                </div>
                <div className="flex min-w-0 flex-1">
                  {cells.map((cell, cellIdx) => (
                    <div
                      key={`${cell.gender}-${cellIdx}`}
                      className={`${dataCellCls}${cellIdx > 0 ? ' border-l border-border' : ''}`}
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
