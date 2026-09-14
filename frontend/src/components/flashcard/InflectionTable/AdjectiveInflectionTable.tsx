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
  headerCellCls,
  panelCls,
  sectionLabelCls,
  tdCls,
  tdMutedCls,
  thCls,
  type InflectionLayout,
} from './inflectionStyles';
import { shortenInflectionLabel } from './utils';

type AdjectiveFormKey =
  | 'pos_masc_fem'
  | 'pos_neuter'
  | 'pos_def_sing'
  | 'pos_plural'
  | 'cmp'
  | 'sup_def'
  | 'sup_ind';

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
      <div className={buildDesktopClassName(layout)}>
        <AdjectiveDesktopTable forms={forms} />
      </div>

      <div
        className={buildMobileClassName(layout)}
        data-testid="inflection-mobile"
      >
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
    <div className={panelCls}>
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
        <span className={`${tdMutedCls} mr-2 inline-block w-24`}>{label}</span>
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

  const gradeRows = [
    { label: 'komparativ', value: forms['cmp'] },
    { label: 'superlativ ubestemt', value: forms['sup_ind'] },
    { label: 'superlativ bestemt', value: forms['sup_def'] },
  ].filter((row): row is { label: string; value: string } =>
    Boolean(row.value),
  );

  return (
    <>
      <div className={`${sectionLabelCls} border-b border-border`}>positiv</div>
      <div className="divide-y divide-border">
        {positiveRows.map(({ label, value }) => (
          <div className="flex" key={label}>
            <div className={headerCellCls}>{shortenInflectionLabel(label)}</div>
            <div className={dataCellCls}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {gradeRows.length > 0 ? (
        <>
          <div className={`${sectionLabelCls} border-y border-border`}>
            gradbøying
          </div>
          <div className="divide-y divide-border">
            {gradeRows.map(({ label, value }) => (
              <div className="flex" key={label}>
                <div className={headerCellCls}>
                  {shortenInflectionLabel(label)}
                </div>
                <div className={dataCellCls}>{value}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
