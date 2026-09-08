import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WordFormRead } from '@/types/api';

import { shortenInflectionLabel } from './utils';

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
const COLUMNS = [
  { label: 'infinitiv', key: 'inf', prefix: 'å\u00a0' },
  { label: 'presens', key: 'pres', prefix: '' },
  { label: 'preteritum', key: 'past', prefix: '' },
  { label: 'presens perfektum', key: 'perf_part', prefix: 'har\u00a0' },
  { label: 'imperativ', key: 'imp', prefix: '' },
] as const;

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
      {/* DESKTOP VIEW — ordbokene style */}
      <div className={desktopCls(layout)}>
        <div className={desktopPanel}>
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

      {/* MOBILE VIEW — stacked */}
      <div data-testid="inflection-mobile" className={mobileCls(layout)}>
        <div className={divider}>
          {COLUMNS.map(
            (col) =>
              forms[col.key] && (
                <div
                  key={col.key}
                  className="flex border-b border-border last:border-b-0"
                >
                  <div className={headerCell}>
                    {shortenInflectionLabel(col.label)}
                  </div>
                  <div className={dataCell}>
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
