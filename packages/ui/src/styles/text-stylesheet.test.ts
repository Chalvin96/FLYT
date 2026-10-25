import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import {
  HEADING_SIZE,
  TEXT_BODY_SIZE,
  TEXT_SIZE,
  TEXT_SIZE_CONTAINER,
  TEXT_SIZE_SM,
} from '../components/text-variants';
import { COLOUR_ROLES } from '../foundations/token-docs';

const STYLES_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function loadStylesheet(id: string, base: string) {
  const file =
    id === 'tailwindcss'
      ? require.resolve('tailwindcss/index.css')
      : path.resolve(base, id);

  return {
    path: file,
    base: path.dirname(file),
    content: await readFile(file, 'utf8'),
  };
}

async function loadModule(id: string) {
  const file = require.resolve(id);
  const module = await import(pathToFileURL(file).href);

  return {
    path: file,
    base: path.dirname(file),
    module: module.default ?? module,
  };
}

// The extension imports this entry and never the app's stylesheet, so a class
// the shared surface does not declare compiles in the app and drops in the
// addon. Tailwind emits a class here only if the utility itself is declared
// where both entrypoints can see it.
async function buildSharedStylesheet(candidates: string[]): Promise<string> {
  const entry = path.join(STYLES_DIRECTORY, 'entry.css');
  const compiled = await compile(await readFile(entry, 'utf8'), {
    base: STYLES_DIRECTORY,
    from: entry,
    loadStylesheet,
    loadModule,
  });

  return compiled.build(candidates);
}

function classesOf(records: Record<string, string>[]): string[] {
  const classes = records.flatMap((record) =>
    Object.values(record).flatMap((entry) => entry.split(' ')),
  );

  return [...new Set(classes)].sort();
}

function cssSelector(className: string): string {
  return `.${className.replace(/[:@./]/g, (character) => `\\${character}`)}`;
}

function ruleFor(className: string): RegExp {
  const escaped = cssSelector(className).replace(
    /[.*+?^${}()|[\]\\]/g,
    (character) => `\\${character}`,
  );

  return new RegExp(`${escaped}\\s*[,{]`);
}

function emitsRule(css: string, className: string): boolean {
  return ruleFor(className).exec(css) !== null;
}

const SIZE_CLASSES = classesOf([
  HEADING_SIZE,
  TEXT_SIZE,
  TEXT_BODY_SIZE,
  TEXT_SIZE_SM,
  TEXT_SIZE_CONTAINER,
]);

const ROLE_TOKENS: Record<
  string,
  { lineHeight: string; size: string; weight: string }
> = {
  'text-body-small': { size: '0.75rem', lineHeight: '1rem', weight: '400' },
  'text-body-medium': {
    size: '0.875rem',
    lineHeight: '1.25rem',
    weight: '400',
  },
  'text-body-large': { size: '1rem', lineHeight: '1.5rem', weight: '400' },
  'text-body-fluid': {
    size: 'clamp(1.25rem, 1.0833rem + 0.8333vw, 1.75rem)',
    lineHeight: '1.5',
    weight: '400',
  },
  'text-heading-xxlarge': {
    size: '2rem',
    lineHeight: '2.25rem',
    weight: '700',
  },
  'text-heading-xlarge': { size: '1.75rem', lineHeight: '2rem', weight: '700' },
  'text-heading-large': {
    size: '1.5rem',
    lineHeight: '1.75rem',
    weight: '700',
  },
  'text-heading-medium': {
    size: '1.25rem',
    lineHeight: '1.5rem',
    weight: '700',
  },
  'text-heading-small': { size: '1rem', lineHeight: '1.25rem', weight: '700' },
  'text-heading-xsmall': {
    size: '0.875rem',
    lineHeight: '1.25rem',
    weight: '700',
  },
  'text-heading-xxsmall': {
    size: '0.8125rem',
    lineHeight: '1rem',
    weight: '600',
  },
  'text-heading-fluid': {
    size: 'clamp(1.25rem, 1.0833rem + 0.8333vw, 1.75rem)',
    lineHeight: '1.2',
    weight: '700',
  },
};

function ruleBodyOf(css: string, className: string): string {
  const escaped = cssSelector(className).replace(
    /[.*+?^${}()|[\]\\]/g,
    (character) => `\\${character}`,
  );

  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

function declarationOf(body: string, property: string): string {
  return (
    new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`, 's')
      .exec(body)?.[1]
      .trim() ?? ''
  );
}

function customPropertyOf(css: string, property: string): string | undefined {
  return new RegExp(`${property}:\\s*([^;]+);`).exec(css)?.[1].trim();
}

function resolveCssValue(
  css: string,
  value: string,
  resolving = new Set<string>(),
): string {
  const variable = /var\((--[\w-]+)(?:,\s*([^()]+))?\)/;
  let resolved = value.trim();
  let match = variable.exec(resolved);

  while (match !== null) {
    const [, name, fallback] = match;

    if (resolving.has(name)) {
      throw new Error(`Circular CSS variable reference: ${name}`);
    }

    const replacement = customPropertyOf(css, name) ?? fallback?.trim();

    if (replacement === undefined) {
      throw new Error(`No compiled value for ${name}`);
    }

    const nextResolving = new Set(resolving).add(name);
    resolved =
      resolved.slice(0, match.index) +
      resolveCssValue(css, replacement, nextResolving) +
      resolved.slice(match.index + match[0].length);
    match = variable.exec(resolved);
  }

  return resolved.trim();
}

function pixelsAtRoot(
  value: string,
  rootSize: number,
  fontSize?: number,
): number {
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(value);

  if (rem !== null) {
    return Number(rem[1]) * rootSize;
  }

  const pixels = /^(\d+(?:\.\d+)?)px$/.exec(value);

  if (pixels !== null) {
    return Number(pixels[1]);
  }

  if (fontSize !== undefined && /^\d+(?:\.\d+)?$/.exec(value) !== null) {
    return Number(value) * fontSize;
  }

  throw new Error(`Unsupported compiled text dimension: ${value}`);
}

const INHERITED_NORMAL_WEIGHT = '400';

function typographyAtRoot(
  css: string,
  sizeClass: string,
  leadingClass: string | undefined,
  weightClass: string | undefined,
  rootSize: number,
) {
  const sizeValue = resolveCssValue(
    css,
    declarationOf(ruleBodyOf(css, sizeClass), 'font-size'),
  );
  const fontSize = pixelsAtRoot(sizeValue, rootSize);
  const lineHeightClassName = leadingClass ?? sizeClass;
  const lineHeightValue = resolveCssValue(
    css,
    declarationOf(ruleBodyOf(css, lineHeightClassName), 'line-height'),
  );
  const fontWeight =
    weightClass === undefined
      ? INHERITED_NORMAL_WEIGHT
      : resolveCssValue(
          css,
          declarationOf(ruleBodyOf(css, weightClass), 'font-weight'),
        );

  return {
    fontSize,
    lineHeight: pixelsAtRoot(lineHeightValue, rootSize, fontSize),
    fontWeight,
  };
}

const DEFAULT_ROOT = 16;

const COMPOSITE_SCALE: Record<
  string,
  { fontSize: number; fontWeight: string; lineHeight: number }
> = {
  'text-body-small': { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  'text-body-medium': { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  'text-body-large': { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  'text-heading-xxlarge': { fontSize: 32, lineHeight: 36, fontWeight: '700' },
  'text-heading-xlarge': { fontSize: 28, lineHeight: 32, fontWeight: '700' },
  'text-heading-large': { fontSize: 24, lineHeight: 28, fontWeight: '700' },
  'text-heading-medium': { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  'text-heading-small': { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  'text-heading-xsmall': { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  'text-heading-xxsmall': { fontSize: 13, lineHeight: 16, fontWeight: '600' },
};

describe('the shared stylesheet', () => {
  it('test_shared_stylesheet_given_every_class_the_size_records_name_expect_a_rule_for_it', async () => {
    const css = await buildSharedStylesheet(SIZE_CLASSES);
    const missing = SIZE_CLASSES.filter((entry) => !emitsRule(css, entry));

    expect(missing).toEqual([]);
  });

  it('test_shared_stylesheet_given_each_role_token_expect_exactly_its_size_line_height_and_weight', async () => {
    const css = await buildSharedStylesheet(Object.keys(ROLE_TOKENS));

    for (const [className, spec] of Object.entries(ROLE_TOKENS)) {
      const body = ruleBodyOf(css, className);

      expect(declarationOf(body, 'font-size'), className).toBe(
        `var(--${className})`,
      );
      expect(declarationOf(body, 'line-height'), className).toBe(
        `var(--tw-leading, var(--${className}--line-height))`,
      );
      expect(declarationOf(body, 'font-weight'), className).toBe(
        `var(--tw-font-weight, var(--${className}--font-weight))`,
      );
      expect(css, className).toContain(`--${className}: ${spec.size}`);
      expect(css, className).toContain(
        `--${className}--line-height: ${spec.lineHeight}`,
      );
      expect(css, className).toContain(
        `--${className}--font-weight: ${spec.weight}`,
      );
    }
  });

  it('test_shared_stylesheet_given_each_composite_expect_the_named_pixels_at_the_default_root', async () => {
    const css = await buildSharedStylesheet(Object.keys(COMPOSITE_SCALE));

    for (const [className, expected] of Object.entries(COMPOSITE_SCALE)) {
      expect(
        typographyAtRoot(css, className, undefined, className, DEFAULT_ROOT),
        className,
      ).toEqual(expected);
    }
  });

  it('test_shared_stylesheet_given_each_composite_expect_rems_that_follow_the_root', async () => {
    const css = await buildSharedStylesheet(Object.keys(COMPOSITE_SCALE));
    const largerRoot = 20;

    for (const [className, expected] of Object.entries(COMPOSITE_SCALE)) {
      expect(
        typographyAtRoot(css, className, undefined, className, largerRoot),
        className,
      ).toEqual({
        fontSize: (expected.fontSize / DEFAULT_ROOT) * largerRoot,
        lineHeight: (expected.lineHeight / DEFAULT_ROOT) * largerRoot,
        fontWeight: expected.fontWeight,
      });
    }
  });

  it('test_shared_stylesheet_given_a_weight_utility_beside_a_role_expect_the_utility_to_decide_the_weight', async () => {
    const css = await buildSharedStylesheet([
      'text-body-medium',
      'font-semibold',
    ]);

    expect(
      declarationOf(ruleBodyOf(css, 'text-body-medium'), 'font-weight'),
    ).toBe('var(--tw-font-weight, var(--text-body-medium--font-weight))');
    expect(
      declarationOf(ruleBodyOf(css, 'font-semibold'), '--tw-font-weight'),
    ).toBe('var(--font-weight-semibold)');
  });
});

const ROLE_CATEGORIES = [
  { prefix: '--background-', className: 'bg-', property: 'background-color' },
  { prefix: '--surface-', className: 'bg-', property: 'background-color' },
  { prefix: '--border-', className: 'border-', property: 'border-color' },
  { prefix: '--text-', className: 'text-', property: 'color' },
  { prefix: '--icon-', className: 'text-icon-', property: 'color' },
] as const;

function roleUtility(roleName: string) {
  const category = ROLE_CATEGORIES.find((entry) =>
    roleName.startsWith(entry.prefix),
  );
  if (category === undefined) {
    throw new Error(`No utility category owns the role ${roleName}`);
  }
  return {
    className: `${category.className}${roleName.slice(category.prefix.length)}`,
    property: category.property,
  };
}

const ROLE_CLASSES = COLOUR_ROLES.map(
  (role) => roleUtility(role.name).className,
);

describe('the shared stylesheet colour roles', () => {
  it('test_shared_stylesheet_given_every_colour_role_expect_a_scoped_utility_reading_it', async () => {
    const css = await buildSharedStylesheet(ROLE_CLASSES);

    for (const role of COLOUR_ROLES) {
      const { className, property } = roleUtility(role.name);
      const value = declarationOf(ruleBodyOf(css, className), property).replace(
        /\s+/g,
        '',
      );

      expect(value, className).toBe(`var(${role.name})`);
    }
  });

  it('test_shared_stylesheet_given_each_text_or_icon_role_expect_no_font_size_collision', async () => {
    const css = await buildSharedStylesheet(ROLE_CLASSES);

    for (const className of ROLE_CLASSES.filter((entry) =>
      entry.startsWith('text-'),
    )) {
      expect(
        declarationOf(ruleBodyOf(css, className), 'font-size'),
        className,
      ).toBe('');
      expect(ruleBodyOf(css, className), className).toContain('color:');
    }
  });
});
