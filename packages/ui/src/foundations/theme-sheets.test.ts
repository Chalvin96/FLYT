import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { COLOUR_ROLES, CONTROL_COLOURS } from './token-docs';

const FOUNDATIONS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const STYLES_DIRECTORY = path.join(FOUNDATIONS_DIRECTORY, '../styles');
const REPO_ROOT = path.resolve(FOUNDATIONS_DIRECTORY, '../../../..');

const SHEET_ROOTS = [
  'packages/ui/src',
  'packages/lexicon/src',
  'frontend/src',
  'extension/src',
];

const PALETTE_STEP =
  /^--(?:primary|secondary|accent|warning|destructive|black|white)-\d+$/;
const THEME_FILE = /^theme-.*\.css$/;

const SHADOW_COLOURS = [
  '--shadow-color-1',
  '--shadow-color-2',
  '--shadow-color-strong',
  '--shadow-color-tile-1',
  '--shadow-color-tile-2',
];

const LITERAL_COLOUR =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\(/i;

const STEP_READERS: string[] = [];

const PALETTE_FAMILIES = [
  'primary',
  'secondary',
  'accent',
  'warning',
  'destructive',
  'black',
  'white',
] as const;

const PALETTE_STEPS: Record<string, number[]> = {
  primary: [10, 20, 30, 40, 50, 70, 80, 90, 100],
  secondary: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  accent: [10, 20, 50, 70, 100],
  warning: [10, 30, 60, 70, 100],
  destructive: [10, 20, 30, 60, 70, 80, 90],
  black: [10, 20, 30, 60, 70, 80],
  white: [20, 80, 90, 100],
};

const FULL_PALETTE = PALETTE_FAMILIES.flatMap((family) =>
  PALETTE_STEPS[family].map((step) => `--${family}-${step}`),
);

async function readSheet(name: string): Promise<string> {
  return readFile(path.join(STYLES_DIRECTORY, name), 'utf8');
}

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function customPropertyNames(css: string): string[] {
  return [
    ...new Set(
      [...withoutComments(css).matchAll(/(?:^|[{;\s])(--[\w-]+)\s*:/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

function declarationValues(css: string): string[] {
  return [...withoutComments(css).matchAll(/[\w-]+\s*:\s*[^;{}]+/g)].map(
    (match) => match[0],
  );
}

function literalColourDeclarations(css: string): string[] {
  return declarationValues(css).filter((declaration) =>
    LITERAL_COLOUR.test(declaration.replace(/var\([^()]*\)/g, '')),
  );
}

function paletteStepReaders(css: string): string[] {
  const readers = new Set<string>();

  for (const match of withoutComments(css).matchAll(
    /(?:^|[{;\s])(--[\w-]+)\s*:\s*([^;{}]+)/g,
  )) {
    const [, name, value] = match;
    const readsStep = [...value.matchAll(/var\((--[\w-]+)\)/g)].some(
      (reference) => PALETTE_STEP.test(reference[1]),
    );
    if (readsStep) {
      readers.add(name);
    }
  }

  return [...readers].sort();
}

async function cssFilesUnder(root: string): Promise<string[]> {
  const entries = await readdir(path.join(REPO_ROOT, root), {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

async function readSharedSheets() {
  const [palette, themeLight, tokens] = await Promise.all(
    ['palette.css', 'theme-light.css', 'tokens.css'].map(readSheet),
  );
  return { palette, themeLight, tokens };
}

describe('theme sheets', () => {
  it('test_theme_sheets_given_the_documented_roles_expect_theme_light_to_declare_each_one', async () => {
    const { themeLight } = await readSharedSheets();
    const declared = customPropertyNames(themeLight);

    const missing = COLOUR_ROLES.map((role) => role.name).filter(
      (name) => !declared.includes(name),
    );

    expect(missing).toEqual([]);
  });

  it('test_theme_sheets_given_the_palette_sheet_expect_palette_steps_only', async () => {
    const { palette } = await readSharedSheets();
    const declared = customPropertyNames(palette);

    const offPalette = declared.filter((name) => !PALETTE_STEP.test(name));

    expect(offPalette).toEqual([]);
    expect(declared.sort()).toEqual([...FULL_PALETTE].sort());
  });

  it('test_theme_sheets_given_the_shared_theme_expect_no_palette_step_utilities', async () => {
    const { tokens } = await readSharedSheets();
    const paletteUtilities = customPropertyNames(tokens).filter((name) =>
      /^--color-(?:primary|secondary|accent|warning|destructive|black|white)-\d+$/.test(
        name,
      ),
    );

    expect(paletteUtilities).toEqual([]);
  });

  it('test_theme_sheets_given_the_theme_light_sheet_expect_colour_meanings_only', async () => {
    const { themeLight } = await readSharedSheets();
    const expected = [
      ...COLOUR_ROLES.map((role) => role.name),
      ...CONTROL_COLOURS.map((role) => role.name),
      ...SHADOW_COLOURS,
    ];

    expect(customPropertyNames(themeLight).sort()).toEqual(
      [...new Set(expected)].sort(),
    );
  });

  it('test_theme_sheets_given_the_split_sheets_expect_no_variable_in_two_sheets', async () => {
    const { palette, themeLight, tokens } = await readSharedSheets();
    const colourLayer = new Set([
      ...customPropertyNames(palette),
      ...customPropertyNames(themeLight),
    ]);

    const duplicated = customPropertyNames(tokens).filter((name) =>
      colourLayer.has(name),
    );

    expect(duplicated).toEqual([]);
  });

  it('test_theme_sheets_given_shared_and_app_source_expect_palette_steps_only_in_the_colour_sheets', async () => {
    const violations: string[] = [];

    for (const root of SHEET_ROOTS) {
      for (const file of await cssFilesUnder(root)) {
        const base = path.basename(file);
        const sheet = await readFile(file, 'utf8');
        const steps = customPropertyNames(sheet).filter((name) =>
          PALETTE_STEP.test(name),
        );
        const mayDefineSteps = base === 'palette.css' || THEME_FILE.test(base);

        if (!mayDefineSteps && steps.length > 0) {
          violations.push(
            `${path.relative(REPO_ROOT, file)}: ${steps.join(', ')}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('test_theme_sheets_given_non_theme_sheets_expect_no_declaration_with_a_literal_colour', async () => {
    const violations: string[] = [];

    for (const root of SHEET_ROOTS) {
      for (const file of await cssFilesUnder(root)) {
        const base = path.basename(file);
        if (base === 'palette.css' || THEME_FILE.test(base)) continue;

        const literals = literalColourDeclarations(
          await readFile(file, 'utf8'),
        );
        if (literals.length > 0) {
          violations.push(
            `${path.relative(REPO_ROOT, file)}: ${literals.join(', ')}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('test_theme_sheets_given_non_palette_sheets_expect_direct_step_readers_equal_the_pinned_list', async () => {
    const readers = new Set<string>();

    for (const root of SHEET_ROOTS) {
      for (const file of await cssFilesUnder(root)) {
        const base = path.basename(file);
        if (base === 'palette.css' || THEME_FILE.test(base)) continue;

        for (const name of paletteStepReaders(await readFile(file, 'utf8'))) {
          readers.add(name);
        }
      }
    }

    expect([...readers].sort()).toEqual(STEP_READERS);
  });

  it('test_theme_sheets_given_every_theme_file_expect_the_variable_set_of_its_theme_light', async () => {
    const themeFilesByDirectory = new Map<string, string[]>();

    for (const root of SHEET_ROOTS) {
      for (const file of await cssFilesUnder(root)) {
        if (!THEME_FILE.test(path.basename(file))) continue;
        const directory = path.dirname(file);
        themeFilesByDirectory.set(directory, [
          ...(themeFilesByDirectory.get(directory) ?? []),
          file,
        ]);
      }
    }

    expect(themeFilesByDirectory.size).toBeGreaterThan(0);

    for (const [directory, files] of themeFilesByDirectory) {
      const light = files.find(
        (file) => path.basename(file) === 'theme-light.css',
      );
      expect(light, directory).toBeDefined();
      if (light === undefined) continue;

      const lightVariables = customPropertyNames(
        await readFile(light, 'utf8'),
      ).sort();

      for (const file of files) {
        expect(
          customPropertyNames(await readFile(file, 'utf8')).sort(),
          path.relative(REPO_ROOT, file),
        ).toEqual(lightVariables);
      }
    }
  });
});
