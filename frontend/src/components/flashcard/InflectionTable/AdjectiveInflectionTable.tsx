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

export function AdjectiveInflectionTable({
  wordForms,
  layout,
}: {
  wordForms: WordFormRead[];
  layout: InflectionLayout;
}) {
  const forms: Record<string, string> = {};

  for (const wf of wordForms) {
    const tags = wf.tags_json;
    let key = '';

    if (tags.includes('Pos')) {
      if (tags.includes('Neuter')) key = 'pos_neuter';
      else if (tags.includes('Plur')) key = 'pos_plural';
      else if (tags.includes('Def') && tags.includes('Sing'))
        key = 'pos_def_sing';
      else key = 'pos_masc_fem';
    } else if (tags.includes('Cmp')) {
      key = 'cmp';
    } else if (tags.includes('Sup')) {
      if (tags.includes('Def')) key = 'sup_def';
      else key = 'sup_ind';
    }

    if (key) forms[key] = wf.form;
  }

  return (
    <div className="w-full type-caption">
      {/* DESKTOP VIEW — ordbokene style */}
      <div className={desktopCls(layout)}>
        <div className={desktopPanel}>
          <Table className="min-w-max border-collapse">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead colSpan={3} className={thCls}>
                  entall
                </TableHead>
                <TableHead className={thCls}>flertall</TableHead>
              </TableRow>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={thCls}>
                  {shortenInflectionLabel('hankjønn / hunkjønn')}
                </TableHead>
                <TableHead className={thCls}>intetkjønn</TableHead>
                <TableHead className={thCls}>bestemt form</TableHead>
                <TableHead className={thCls}>flertall</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className={tdCls}>
                  {forms['pos_masc_fem'] ?? '—'}
                </TableCell>
                <TableCell className={tdCls}>
                  {forms['pos_neuter'] ?? '—'}
                </TableCell>
                <TableCell className={tdCls}>
                  {forms['pos_def_sing'] ?? forms['pos_plural'] ?? '—'}
                </TableCell>
                <TableCell className={tdCls}>
                  {forms['pos_plural'] ?? '—'}
                </TableCell>
              </TableRow>
              {forms['cmp'] && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={4} className={tdCls}>
                    <span className={`${tdMutedCls} mr-2`}>komparativ</span>
                    {forms['cmp']}
                  </TableCell>
                </TableRow>
              )}
              {forms['sup_ind'] && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={4} className={tdCls}>
                    <span className={`${tdMutedCls} mr-2`}>
                      {shortenInflectionLabel('superlativ ubestemt')}
                    </span>
                    {forms['sup_ind']}
                  </TableCell>
                </TableRow>
              )}
              {forms['sup_def'] && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={4} className={tdCls}>
                    <span className={`${tdMutedCls} mr-2`}>
                      {shortenInflectionLabel('superlativ bestemt')}
                    </span>
                    {forms['sup_def']}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div data-testid="inflection-mobile" className={mobileCls(layout)}>
        <div className={`${sectionLabel} border-b border-border`}>positiv</div>
        <div className="divide-y divide-border">
          {[
            { label: 'hankjønn / hunkjønn', value: forms['pos_masc_fem'] },
            { label: 'intetkjønn', value: forms['pos_neuter'] },
            {
              label: 'flertall / bestemt form',
              value: forms['pos_plural'] ?? forms['pos_def_sing'],
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex border-b border-border">
              <div className={headerCell}>{shortenInflectionLabel(label)}</div>
              <div className={dataCell}>{value ?? '—'}</div>
            </div>
          ))}
        </div>

        {forms['cmp'] && (
          <>
            <div className={`${sectionLabel} border-y border-border`}>
              komparativ
            </div>
            <div className={dataCell}>{forms['cmp']}</div>
          </>
        )}

        {(forms['sup_ind'] || forms['sup_def']) && (
          <>
            <div className={`${sectionLabel} border-y border-border`}>
              superlativ
            </div>
            <div className="divide-y divide-border">
              {forms['sup_ind'] && (
                <div className="flex border-b border-border last:border-b-0">
                  <div className={headerCell}>
                    {shortenInflectionLabel('ubestemt form')}
                  </div>
                  <div className={dataCell}>{forms['sup_ind']}</div>
                </div>
              )}
              {forms['sup_def'] && (
                <div className="flex border-b border-border last:border-b-0">
                  <div className={headerCell}>bestemt form</div>
                  <div className={dataCell}>{forms['sup_def']}</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
