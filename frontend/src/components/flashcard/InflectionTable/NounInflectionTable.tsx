import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@flyt/ui';

import type { WordFormRead } from '@/types/api';

import {
  dataCellCls,
  dividerCls,
  type InflectionLayout,
} from './inflectionStyles';
import {
  InflectionMobileRow,
  InflectionSectionLabel,
  InflectionSurface,
} from './InflectionSurface';
import {
  buildNounTableModel,
  formatInflectionLabel,
  getGenderArticle,
  getNounForm,
  getNounPluralSpan,
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
    <InflectionSurface
      layout={layout}
      desktop={
        <>
          <TableHeader>
            <TableRow>
              {sortedGenders.length > 1 && <TableHead rowSpan={2} />}
              <TableHead colSpan={2}>Entall</TableHead>
              <TableHead colSpan={2}>Flertall</TableHead>
            </TableRow>
            <TableRow>
              <TableHead>{formatInflectionLabel('Ubestemt form')}</TableHead>
              <TableHead>Bestemt form</TableHead>
              <TableHead>{formatInflectionLabel('Ubestemt form')}</TableHead>
              <TableHead>Bestemt form</TableHead>
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
                <TableRow key={gender}>
                  {sortedGenders.length > 1 && (
                    <TableHead align="start" scope="row">
                      {translateGenderNo(gender)}
                    </TableHead>
                  )}
                  <TableCell>
                    <Text as="span" size="small" tone="subtle">
                      <span className="italic">{article}</span>
                    </Text>
                    {getNounForm(data, gender, 'Singular', 'Indefinite')}
                  </TableCell>
                  <TableCell>
                    {getNounForm(data, gender, 'Singular', 'Definite')}
                  </TableCell>
                  {pluralIndSpan > 0 && (
                    <TableCell rowSpan={pluralIndSpan}>
                      {getNounForm(data, gender, 'Plural', 'Indefinite')}
                    </TableCell>
                  )}
                  {pluralDefSpan > 0 && (
                    <TableCell rowSpan={pluralDefSpan}>
                      {getNounForm(data, gender, 'Plural', 'Definite')}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </>
      }
      mobile={
        <>
          {sortedGenders.length > 1 && (
            <div className="flex border-b border-default bg-neutral-subtle">
              <div className="w-32 shrink-0 p-2" />
              <div className="flex min-w-0 flex-1">
                {sortedGenders.map((g) => (
                  <div
                    key={g}
                    className="min-w-0 flex-1 border-l border-default px-3 py-2 text-center first:border-l-0"
                    title={translateGenderNo(g)}
                  >
                    <Text as="div" role="eyebrow" tone="subtle">
                      <span className="block truncate">
                        {translateGenderNo(g)}
                      </span>
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
          <InflectionSectionLabel>Entall</InflectionSectionLabel>
          <div className={dividerCls}>
            {(['Indefinite', 'Definite'] as const).map((def) => (
              <InflectionMobileRow
                key={def}
                label={formatInflectionLabel(
                  def === 'Indefinite' ? 'Ubestemt form' : 'Bestemt form',
                )}
              >
                <div className="flex min-w-0 flex-1">
                  {sortedGenders.map((g, idx) => (
                    <div
                      key={g}
                      className={`${dataCellCls}${idx > 0 ? ' border-l border-default' : ''}`}
                    >
                      {def === 'Indefinite' && (
                        <Text as="span" size="small" tone="subtle">
                          <span className="mr-1 italic">
                            {getGenderArticle(g)}
                          </span>
                        </Text>
                      )}
                      <Text
                        as="span"
                        size="medium"
                        tone="default"
                        weight="semibold"
                      >
                        {getNounForm(data, g, 'Singular', def)}
                      </Text>
                    </div>
                  ))}
                </div>
              </InflectionMobileRow>
            ))}
          </div>
          <InflectionSectionLabel border="y">Flertall</InflectionSectionLabel>
          <div className={dividerCls}>
            {(['Indefinite', 'Definite'] as const).map((def) => {
              const cells: { gender: string; form: string; span: number }[] =
                [];
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
                cells.push({
                  gender: sortedGenders[i],
                  form: currentForm,
                  span,
                });
                i += span;
              }
              return (
                <InflectionMobileRow
                  key={def}
                  label={formatInflectionLabel(
                    def === 'Indefinite' ? 'Ubestemt form' : 'Bestemt form',
                  )}
                >
                  <div className="flex min-w-0 flex-1">
                    {cells.map((cell, cellIdx) => (
                      <div
                        key={`${cell.gender}-${cellIdx}`}
                        className={`${dataCellCls}${cellIdx > 0 ? ' border-l border-default' : ''}`}
                        style={{ flex: `${cell.span} 1 0` }}
                      >
                        <Text
                          as="span"
                          size="medium"
                          tone="default"
                          weight="semibold"
                        >
                          {cell.form}
                        </Text>
                      </div>
                    ))}
                  </div>
                </InflectionMobileRow>
              );
            })}
          </div>
        </>
      }
    />
  );
}
