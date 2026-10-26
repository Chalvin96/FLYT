import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  compareComponentBaselines,
  comparePenpotComponents,
  extractCvaVariants,
  formatPenpotReport,
  generateComponents,
} from './penpot-components.mjs';

async function runPenpotCheck(penpot) {
  const directory = await mkdtemp(join(tmpdir(), 'penpot-components-'));
  try {
    const dump = join(directory, 'dump.json');
    await writeFile(dump, JSON.stringify(penpot));
    return spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./penpot-components.mjs', import.meta.url)),
        '--check',
        dump,
      ],
      { encoding: 'utf8' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('test_cva_extractor_given_literal_fixture_expect_axes_and_values', () => {
  const source = `
    import { cva } from 'class-variance-authority';
    const first = cva('base', {
      variants: {
        size: { sm: '', 'icon-sm': '' },
        enabled: { true: '', false: '' },
      },
      compoundVariants: [{ size: 'sm', enabled: true, class: 'active' }],
    });
    const second = cva('base', { variants: { size: { lg: '' } } });
    const unrelated = 'cva(fake, { variants: { ignored: { yes: true } } })';
  `;

  assert.deepEqual(extractCvaVariants(source, 'fixture.ts'), {
    enabled: ['false', 'true'],
    size: ['icon-sm', 'lg', 'sm'],
  });
});

test('test_cva_extractor_given_dynamic_axis_expect_clear_failure', () => {
  const source = `cva('base', { variants: { size: sizes } });`;

  assert.throws(
    () => extractCvaVariants(source, 'fixture.ts'),
    /Expected literal cva variants in fixture.ts/,
  );
});

test('test_component_baseline_given_repository_recipes_expect_committed_axes', async () => {
  const committed = JSON.parse(
    await readFile(
      new URL('../penpot-components.json', import.meta.url),
      'utf8',
    ),
  );
  const current = await generateComponents();
  const differences = compareComponentBaselines(committed, current);

  assert.deepEqual(
    current,
    committed,
    `Penpot component baseline differs from cva recipes:\n${differences.join('\n')}\nRun pnpm --filter @flyt/ui components:generate and update Penpot.`,
  );
});

test('test_component_baseline_given_changed_axes_and_values_expect_named_differences', () => {
  assert.deepEqual(
    compareComponentBaselines(
      { Button: { size: ['sm', 'md'], variant: ['primary'] } },
      { Button: { size: ['sm', 'lg'], shape: ['pill', 'rounded'] } },
    ),
    [
      'ADDED Button axis shape: pill, rounded',
      'ADDED Button.size lg',
      'REMOVED Button.size md',
      'REMOVED Button axis variant: primary',
    ],
  );
});

test('test_penpot_check_given_shared_and_unmodelled_axes_expect_separate_report', () => {
  const baseline = {
    Button: {
      size: ['lg', 'sm'],
      variant: ['danger', 'primary'],
    },
    Chip: { variant: ['filter'] },
  };
  const penpot = {
    Button: {
      Size: ['sm', 'xl'],
      State: ['Default', 'Hover'],
    },
    Other: { Detail: ['Yes'] },
  };
  const report = comparePenpotComponents(baseline, penpot);

  assert.deepEqual(report, {
    differences: ['MISSING Button.size lg', 'EXTRA Button.size xl'],
    notModelled: ['Button axis variant: danger, primary', 'set Chip'],
    penpotOnly: ['Button axis State: Default, Hover', 'set Other'],
  });
  assert.equal(
    formatPenpotReport(report),
    'MISSING Button.size lg\nEXTRA Button.size xl\nNot modelled in Penpot:\n  Button axis variant: danger, primary\n  set Chip\nPenpot only:\n  Button axis State: Default, Hover\n  set Other',
  );
});

test('test_penpot_check_given_axis_case_difference_expect_no_drift', () => {
  const report = comparePenpotComponents(
    { Button: { variant: ['primary'] } },
    { Button: { Variant: ['primary'] } },
  );

  assert.deepEqual(report, {
    differences: [],
    notModelled: [],
    penpotOnly: [],
  });
  assert.equal(formatPenpotReport(report), 'No drift.');
});

test('test_penpot_check_given_only_design_axes_and_sets_expect_success_report', () => {
  const report = comparePenpotComponents(
    { Button: { variant: ['primary'] } },
    {
      Button: { Variant: ['primary'], State: ['idle', 'hover'] },
      Tooltip: { Detail: ['short'] },
    },
  );

  assert.deepEqual(report.differences, []);
  assert.equal(
    formatPenpotReport(report),
    'No drift.\nPenpot only:\n  Button axis State: idle, hover\n  set Tooltip',
  );
});

test('test_penpot_check_given_unmodelled_axes_and_set_expect_zero_exit', async () => {
  const baseline = JSON.parse(
    await readFile(
      new URL('../penpot-components.json', import.meta.url),
      'utf8',
    ),
  );
  const penpot = structuredClone(baseline);
  delete penpot.BottomSheetDialogContent;
  delete penpot.Button.width;
  const command = await runPenpotCheck(penpot);

  assert.equal(command.status, 0);
  assert.equal(
    command.stdout,
    'No drift.\nNot modelled in Penpot:\n  set BottomSheetDialogContent\n  Button axis width: auto, full, full-on-mobile\n',
  );
  assert.equal(command.stderr, '');
});

test('test_penpot_check_given_missing_shared_value_expect_nonzero_exit', async () => {
  const baseline = JSON.parse(
    await readFile(
      new URL('../penpot-components.json', import.meta.url),
      'utf8',
    ),
  );
  const penpot = structuredClone(baseline);
  penpot.Button.size = penpot.Button.size.filter((value) => value !== 'lg');
  const command = await runPenpotCheck(penpot);

  assert.equal(command.status, 1);
  assert.equal(command.stdout, 'MISSING Button.size lg\n');
  assert.equal(command.stderr, '');
});

test('test_penpot_check_given_extra_value_expect_nonzero_exit', async () => {
  const baseline = JSON.parse(
    await readFile(
      new URL('../penpot-components.json', import.meta.url),
      'utf8',
    ),
  );
  const penpot = structuredClone(baseline);
  penpot.Button.variant.push('retired');
  const command = await runPenpotCheck(penpot);

  assert.equal(command.status, 1);
  assert.equal(command.stdout, 'EXTRA Button.variant retired\n');
  assert.equal(command.stderr, '');
});
