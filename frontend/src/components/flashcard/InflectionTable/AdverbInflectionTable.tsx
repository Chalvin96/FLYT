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
  thCls,
  type InflectionLayout,
} from './inflectionStyles';

const COLUMNS = [
  { label: 'positiv', key: 'pos' },
  { label: 'komparativ', key: 'cmp' },
  { label: 'superlativ', key: 'sup' },
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

  return (
    <div className="w-full type-caption">
      <div className={buildDesktopClassName(layout)}>
        <div className={panelCls}>
          <Table className="min-w-max border-collapse">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                {COLUMNS.map(
                  (col) =>
                    forms[col.key] && (
                      <TableHead key={col.key} className={thCls}>
                        {col.label}
                      </TableHead>
                    ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-0 hover:bg-transparent">
                {COLUMNS.map(
                  (col) =>
                    forms[col.key] && (
                      <TableCell key={col.key} className={tdCls}>
                        {forms[col.key]}
                      </TableCell>
                    ),
                )}
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
                  <div className={headerCellCls}>{col.label}</div>
                  <div className={dataCellCls}>{forms[col.key]}</div>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
