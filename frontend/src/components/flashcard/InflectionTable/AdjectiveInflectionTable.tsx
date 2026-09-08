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

type AdjectiveFormKey =
  | 'pos_masc_fem'
  | 'pos_neuter'
  | 'pos_def_sing'
  | 'pos_plural'
  | 'cmp'
  | 'sup_def'
  | 'sup_ind';

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

/** Map a word form's Giella tags onto the adjective table's slot key. */
function adjectiveFormKey(tags: string[]): AdjectiveFormKey | '' {
  if (tags.includes('Pos')) {
    if (tags.includes('Neuter')) return 'pos_neuter';
    if (tags.includes('Plur')) return 'pos_plural';
    if (tags.includes('Def') && tags.includes('Sing')) return 'pos_def_sing';
    return 'pos_masc_fem';
  }
  if (tags.includes('Cmp')) return 'cmp';
  if (tags.includes('Sup')) {
    return tags.includes('Def') ? 'sup_def' : 'sup_ind';
  }
  return '';
}

function collectAdjectiveForms(
  wordForms: WordFormRead[],
): Partial<Record<AdjectiveFormKey, string>> {
  const forms: Partial<Record<AdjectiveFormKey, string>> = {};

  for (const wf of wordForms) {
    const key = adjectiveFormKey(wf.tags_json);
    if (key) forms[key] = wf.form;
  }

  return forms;
}

export function AdjectiveInflectionTable({
  wordForms,
  layout,
}: {
  wordForms: WordFormRead[];
  layout: InflectionLayout;
}) {
  const forms = collectAdjectiveForms(wordForms);

  return (
    <div className="w-full type-caption">
      {/* DESKTOP VIEW — ordbokene style */}
      <div className={desktopCls(layout)}>
        <AdjectiveDesktopTable forms={forms} />
      </div>

      {/* MOBILE VIEW */}
      <div className={mobileCls(layout)} data-testid="inflection-mobile">
        <AdjectiveMobileList forms={forms} />
      </div>
    </div>
  );
}

function AdjectiveDesktopTable({
  forms,
}: {
  forms: Partial<Record<AdjectiveFormKey, string>>;
}) {
  return (
    <div className={desktopPanel}>
      <Table className="min-w-max border-collapse">
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className={thCls} colSpan={3}>
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
          <ComparisonRow forms={forms} formKey="cmp" label="komparativ" />
          <ComparisonRow
            forms={forms}
            formKey="sup_ind"
            label={shortenInflectionLabel('superlativ ubestemt')}
          />
          <ComparisonRow
            forms={forms}
            formKey="sup_def"
            label={shortenInflectionLabel('superlativ bestemt')}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function ComparisonRow({
  forms,
  formKey,
  label,
}: {
  forms: Partial<Record<AdjectiveFormKey, string>>;
  formKey: 'cmp' | 'sup_ind' | 'sup_def';
  label: string;
}) {
  const value = forms[formKey];
  if (!value) {
    return null;
  }

  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell className={tdCls} colSpan={4}>
        <span className={`${tdMutedCls} mr-2`}>{label}</span>
        {value}
      </TableCell>
    </TableRow>
  );
}

function AdjectiveMobileList({
  forms,
}: {
  forms: Partial<Record<AdjectiveFormKey, string>>;
}) {
  const positiveRows = [
    { label: 'hankjønn / hunkjønn', value: forms['pos_masc_fem'] },
    { label: 'intetkjønn', value: forms['pos_neuter'] },
    {
      label: 'flertall / bestemt form',
      value: forms['pos_plural'] ?? forms['pos_def_sing'],
    },
  ];

  return (
    <>
      <div className={`${sectionLabel} border-b border-border`}>positiv</div>
      <div className="divide-y divide-border">
        {positiveRows.map(({ label, value }) => (
          <div className="flex border-b border-border" key={label}>
            <div className={headerCell}>{shortenInflectionLabel(label)}</div>
            <div className={dataCell}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {forms['cmp'] ? (
        <>
          <div className={`${sectionLabel} border-y border-border`}>
            komparativ
          </div>
          <div className={dataCell}>{forms['cmp']}</div>
        </>
      ) : null}

      {forms['sup_ind'] || forms['sup_def'] ? (
        <>
          <div className={`${sectionLabel} border-y border-border`}>
            superlativ
          </div>
          <div className="divide-y divide-border">
            {forms['sup_ind'] ? (
              <div className="flex border-b border-border last:border-b-0">
                <div className={headerCell}>
                  {shortenInflectionLabel('ubestemt form')}
                </div>
                <div className={dataCell}>{forms['sup_ind']}</div>
              </div>
            ) : null}
            {forms['sup_def'] ? (
              <div className="flex border-b border-border last:border-b-0">
                <div className={headerCell}>bestemt form</div>
                <div className={dataCell}>{forms['sup_def']}</div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
