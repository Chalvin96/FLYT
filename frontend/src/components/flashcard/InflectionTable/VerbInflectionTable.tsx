import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@flyt/ui';

import type { WordFormRead } from '@/types/api';

import { dividerCls, type InflectionLayout } from './inflectionStyles';
import { InflectionMobileRow, InflectionSurface } from './InflectionSurface';
import { formatInflectionLabel } from './utils';

const COLUMNS = [
  { label: 'Infinitiv', key: 'inf', prefix: 'å ' },
  { label: 'Presens', key: 'pres', prefix: '' },
  { label: 'Preteritum', key: 'past', prefix: '' },
  { label: 'Presens perfektum', key: 'perf_part', prefix: 'har ' },
  { label: 'Imperativ', key: 'imp', prefix: '' },
] as const;

export function VerbInflectionTable({
  wordForms,
  layout,
}: {
  wordForms: WordFormRead[];
  layout: InflectionLayout;
}) {
  const forms: Record<string, string> = {};
  for (const wf of wordForms) {
    const tags = wf.tags_json;
    if (tags.includes('Pass') || tags.includes('Adj')) continue;
    if (tags.includes('Inf')) forms['inf'] = wf.form;
    else if (tags.includes('Pres')) forms['pres'] = wf.form;
    else if (tags.includes('Past')) forms['past'] = wf.form;
    else if (tags.includes('<PerfPart>')) forms['perf_part'] = wf.form;
    else if (tags.includes('Imp')) forms['imp'] = wf.form;
  }

  return (
    <InflectionSurface
      layout={layout}
      desktop={
        <>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  {formatInflectionLabel(col.label)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell key={col.key}>
                  {col.prefix && (
                    <Text as="span" size="small" tone="subtle">
                      <span className="italic">{col.prefix}</span>
                    </Text>
                  )}
                  {forms[col.key] || '—'}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </>
      }
      mobile={
        <div className={dividerCls}>
          {COLUMNS.filter((col) => forms[col.key]).map((col) => (
            <InflectionMobileRow
              key={col.key}
              label={formatInflectionLabel(col.label)}
              prefix={col.prefix || undefined}
              value={forms[col.key]}
            />
          ))}
        </div>
      }
    />
  );
}
