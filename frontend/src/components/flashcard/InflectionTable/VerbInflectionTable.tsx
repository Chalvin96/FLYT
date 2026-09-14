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
  tdCls,
  tdMutedCls,
  thCls,
  type InflectionLayout,
} from './inflectionStyles';
import { shortenInflectionLabel } from './utils';

const COLUMNS = [
  { label: 'infinitiv', key: 'inf', prefix: 'å\u00a0' },
  { label: 'presens', key: 'pres', prefix: '' },
  { label: 'preteritum', key: 'past', prefix: '' },
  { label: 'presens perfektum', key: 'perf_part', prefix: 'har\u00a0' },
  { label: 'imperativ', key: 'imp', prefix: '' },
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
    <div className="w-full type-caption">
      <div className={buildDesktopClassName(layout)}>
        <div className={panelCls}>
          <Table className="min-w-max border-collapse">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableHead key={col.key} className={thCls}>
                    {shortenInflectionLabel(col.label)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-0 hover:bg-transparent">
                {COLUMNS.map((col) => (
                  <TableCell key={col.key} className={tdCls}>
                    {col.prefix && (
                      <span className={tdMutedCls}>{col.prefix}</span>
                    )}
                    {forms[col.key] || '—'}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div
        data-testid="inflection-mobile"
        className={buildMobileClassName(layout)}
      >
        <div className={dividerCls}>
          {COLUMNS.map(
            (col) =>
              forms[col.key] && (
                <div key={col.key} className="flex">
                  <div className={headerCellCls}>
                    {shortenInflectionLabel(col.label)}
                  </div>
                  <div className={dataCellCls}>
                    {col.prefix && (
                      <span className="mr-0.5 type-caption-sm italic text-muted-foreground">
                        {col.prefix}
                      </span>
                    )}
                    {forms[col.key]}
                  </div>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
