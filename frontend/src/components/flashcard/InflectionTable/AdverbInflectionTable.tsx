import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@flyt/ui';

import type { WordFormRead } from '@/types/api';

import { dividerCls, type InflectionLayout } from './inflectionStyles';
import { InflectionMobileRow, InflectionSurface } from './InflectionSurface';

const COLUMNS = [
  { label: 'Positiv', key: 'pos' },
  { label: 'Komparativ', key: 'cmp' },
  { label: 'Superlativ', key: 'sup' },
] as const;

export function AdverbInflectionTable({
  wordForms,
  layout,
}: {
  wordForms: WordFormRead[];
  layout: InflectionLayout;
}) {
  const forms: Record<string, string> = {};
  for (const wf of wordForms) {
    if (wf.tags_json.includes('Pos')) forms['pos'] = wf.form;
    else if (wf.tags_json.includes('Cmp')) forms['cmp'] = wf.form;
    else if (wf.tags_json.includes('Sup')) forms['sup'] = wf.form;
  }
  const present = COLUMNS.filter((col) => forms[col.key]);

  return (
    <InflectionSurface
      layout={layout}
      desktop={
        <>
          <TableHeader>
            <TableRow>
              {present.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {present.map((col) => (
                <TableCell key={col.key}>{forms[col.key]}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </>
      }
      mobile={
        <div className={dividerCls}>
          {present.map((col) => (
            <InflectionMobileRow
              key={col.key}
              label={col.label}
              value={forms[col.key]}
            />
          ))}
        </div>
      }
    />
  );
}
