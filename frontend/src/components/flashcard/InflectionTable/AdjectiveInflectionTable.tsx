import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@flyt/ui';

import type { WordFormRead } from '@/types/api';

import type { InflectionLayout } from './inflectionStyles';
import {
  InflectionMobileRow,
  InflectionSectionLabel,
  InflectionSurface,
} from './InflectionSurface';
import { formatInflectionLabel } from './utils';

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
    <InflectionSurface
      layout={layout}
      desktop={<AdjectiveDesktopRows forms={forms} />}
      mobile={<AdjectiveMobileList forms={forms} />}
    />
  );
}

function AdjectiveDesktopRows({
  forms,
}: {
  forms: Partial<Record<AdjectiveFormKey, string>>;
}) {
  return (
    <>
      <TableHeader>
        <TableRow>
          <TableHead colSpan={3}>Entall</TableHead>
          <TableHead>Flertall</TableHead>
        </TableRow>
        <TableRow>
          <TableHead>{formatInflectionLabel('Hankjønn / hunkjønn')}</TableHead>
          <TableHead>Intetkjønn</TableHead>
          <TableHead>Bestemt form</TableHead>
          <TableHead>Flertall</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>{forms['pos_masc_fem'] ?? '—'}</TableCell>
          <TableCell>{forms['pos_neuter'] ?? '—'}</TableCell>
          <TableCell>
            {forms['pos_def_sing'] ?? forms['pos_plural'] ?? '—'}
          </TableCell>
          <TableCell>{forms['pos_plural'] ?? '—'}</TableCell>
        </TableRow>
        <ComparisonRow forms={forms} formKey="cmp" label="Komparativ" />
        <ComparisonRow
          forms={forms}
          formKey="sup_ind"
          label={formatInflectionLabel('Superlativ ubestemt')}
        />
        <ComparisonRow
          forms={forms}
          formKey="sup_def"
          label={formatInflectionLabel('Superlativ bestemt')}
        />
      </TableBody>
    </>
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
    <TableRow>
      <TableCell colSpan={4}>
        <Text as="span" size="small" tone="subtle">
          <span className="mr-2 inline-block w-24 italic">{label}</span>
        </Text>
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
    { label: 'Hankjønn / hunkjønn', value: forms['pos_masc_fem'] },
    { label: 'Intetkjønn', value: forms['pos_neuter'] },
    {
      label: 'Flertall / bestemt form',
      value: forms['pos_plural'] ?? forms['pos_def_sing'],
    },
  ];

  const gradeRows = [
    { label: 'Komparativ', value: forms['cmp'] },
    { label: 'Superlativ ubestemt', value: forms['sup_ind'] },
    { label: 'Superlativ bestemt', value: forms['sup_def'] },
  ].filter((row): row is { label: string; value: string } =>
    Boolean(row.value),
  );

  return (
    <>
      <InflectionSectionLabel>Positiv</InflectionSectionLabel>
      <MobileRows rows={positiveRows} />

      {gradeRows.length > 0 ? (
        <>
          <InflectionSectionLabel border="y">Gradbøying</InflectionSectionLabel>
          <MobileRows rows={gradeRows} />
        </>
      ) : null}
    </>
  );
}

function MobileRows({ rows }: { rows: { label: string; value?: string }[] }) {
  return (
    <div className="divide-y divide-[var(--border-default)]">
      {rows.map(({ label, value }) => (
        <InflectionMobileRow
          key={label}
          label={formatInflectionLabel(label)}
          value={value ?? '—'}
        />
      ))}
    </div>
  );
}
