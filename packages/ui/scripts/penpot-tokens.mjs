import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { color, serializeRGB } from '@csstools/css-color-parser';
import { parseComponentValue } from '@csstools/css-parser-algorithms';
import { tokenize } from '@csstools/css-tokenizer';
import postcss from 'postcss';

import { ALL_TOKEN_DOCS } from '../src/foundations/token-docs.ts';
import { findTokenDoc } from '../src/foundations/token-source.ts';

const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SHARED_STYLES = resolve(REPOSITORY, 'packages/ui/src/styles');
const APP_STYLES = resolve(REPOSITORY, 'frontend/src/styles');
const SET_ORDER = ['primitives', 'modes/light', 'semantic', 'app/light'];
const SPACING_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const RADIUS_SOURCES = {
  sm: '--radius-sm',
  md: '--radius-md',
  '2xl': '--radius-2xl',
  '3xl': '--radius-3xl',
  '4xl': '--radius-4xl',
  field: '--radius-field',
  section: '--radius-section',
  pill: '--control-radius-pill',
};
const THEME = {
  name: 'Light',
  group: 'Colour scheme',
  description: '',
  isSource: false,
  selectedTokenSets: Object.fromEntries(
    SET_ORDER.map((set) => [set, 'enabled']),
  ),
};

function token(value, type, description = '') {
  return { $value: value, $type: type, $description: description };
}

function put(set, path, value) {
  const parts = path.split('.');
  let branch = set;
  for (const part of parts.slice(0, -1)) {
    branch[part] ??= {};
    branch = branch[part];
  }
  const name = parts.at(-1);
  if (Object.hasOwn(branch, name)) {
    throw new Error(`Duplicate Penpot token ${path}`);
  }
  branch[name] = value;
}

export function readCssDeclarations(css) {
  const declarations = new Map();
  postcss.parse(css).walkDecls((declaration) => {
    if (declaration.prop.startsWith('--')) {
      declarations.set(declaration.prop, declaration.value);
    }
  });
  return declarations;
}

function requireValue(declarations, name) {
  const value = declarations.get(name);
  if (value === undefined) {
    throw new Error(`Missing CSS declaration ${name}`);
  }
  return value;
}

export function lengthInPixels(value, declarations) {
  const variable = /^var\((--[a-z0-9-]+)\)$/.exec(value);
  if (variable) {
    return lengthInPixels(
      requireValue(declarations, variable[1]),
      declarations,
    );
  }
  const calculation =
    /^calc\(var\((--[a-z0-9-]+)\) ([+-]) (\d+(?:\.\d+)?)px\)$/.exec(value);
  if (calculation) {
    const base = lengthInPixels(
      requireValue(declarations, calculation[1]),
      declarations,
    );
    const offset = Number(calculation[3]);
    return base + (calculation[2] === '+' ? offset : -offset);
  }
  const dimension = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value);
  if (dimension) {
    return Number(dimension[1]) * (dimension[2] === 'rem' ? 16 : 1);
  }
  throw new Error(`Unsupported CSS length: ${value}`);
}

function computedCssValue(value, declarations, visited = new Set()) {
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, name) => {
    if (visited.has(name)) {
      throw new Error(`Circular CSS reference ${name}`);
    }
    const next = new Set(visited).add(name);
    return computedCssValue(
      requireValue(declarations, name),
      declarations,
      next,
    );
  });
}

function rgbHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function colorValue(source, declarations, references) {
  const variable = /^var\((--[a-z0-9-]+)\)$/.exec(source);
  if (variable) {
    const reference = references.get(variable[1]);
    if (!reference) {
      throw new Error(`Unmapped CSS colour reference: ${source}`);
    }
    return `{${reference}}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(source)) {
    return source.toLowerCase();
  }
  const resolved = computedCssValue(source, declarations);
  const parsed = color(parseComponentValue(tokenize({ css: resolved })));
  if (!parsed) {
    throw new Error(`Unsupported CSS colour: ${source}`);
  }
  const rgb = serializeRGB(parsed, false).toString();
  const opaque = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb);
  if (opaque) {
    return rgbHex(...opaque.slice(1));
  }
  if (/^rgba\(\d+, \d+, \d+, (?:0|0\.\d+)\)$/.test(rgb)) {
    return rgb;
  }
  throw new Error(`Unsupported Penpot colour: ${source}`);
}

function addColorTokens(set, source, declarations, references, descriptionFor) {
  for (const [name, value] of source) {
    const path = `color.${name.slice(2)}`;
    put(
      set,
      path,
      token(
        colorValue(value, declarations, references),
        'color',
        descriptionFor(name),
      ),
    );
    references.set(name, path);
  }
}

function sharedDescription(name) {
  const useWhen = findTokenDoc(name, ALL_TOKEN_DOCS)?.useWhen;
  return useWhen ? `Use when: ${useWhen}` : '';
}

function addSpacingTokens(semantic, tailwind) {
  const base = lengthInPixels(requireValue(tailwind, '--spacing'), tailwind);
  for (const step of SPACING_STEPS) {
    put(semantic, `spacing.${step}`, token(String(base * step), 'spacing'));
  }
}

function fontWeight(name, shared) {
  const weight = Number(requireValue(shared, `${name}--font-weight`));
  if (!Number.isInteger(weight)) {
    throw new Error(`Unsupported font weight: ${weight}`);
  }
  return weight;
}

function addTypographyTokens(primitives, semantic, shared, omitted) {
  for (const [name, value] of shared) {
    if (!/^--text-(body|heading)-[a-z]+$/.test(name)) {
      continue;
    }
    const weight = fontWeight(name, shared);
    if (
      /^--text-(body|heading)-fluid$/.test(name) &&
      /^clamp\(.+\)$/.test(value)
    ) {
      omitted.push(`${name}: Unsupported CSS length: ${value}`);
      continue;
    }
    const size = lengthInPixels(value, shared);
    putIfAbsent(
      primitives,
      `scale.font-size.${size}`,
      token(String(size), 'fontSizes'),
    );
    put(
      semantic,
      `font.size.${name.slice(2)}`,
      token(`{scale.font-size.${size}}`, 'fontSizes', sharedDescription(name)),
    );
    putIfAbsent(
      primitives,
      `scale.font-weight.${weight}`,
      token(String(weight), 'fontWeights'),
    );
  }
  for (const [role, name] of Object.entries({
    body: '--text-body-medium',
    heading: '--text-heading-medium',
    eyebrow: '--text-heading-xxsmall',
  })) {
    const weight = fontWeight(name, shared);
    putIfAbsent(
      primitives,
      `scale.font-weight.${weight}`,
      token(String(weight), 'fontWeights'),
    );
    put(
      semantic,
      `font.weight.${role}`,
      token(`{scale.font-weight.${weight}}`, 'fontWeights'),
    );
  }
}

function putIfAbsent(set, path, value) {
  const parts = path.split('.');
  let branch = set;
  for (const part of parts.slice(0, -1)) {
    branch[part] ??= {};
    branch = branch[part];
  }
  if (!Object.hasOwn(branch, parts.at(-1))) {
    put(set, path, value);
  }
}

function addRadiusTokens(primitives, semantic, shared) {
  const radii = new Map();
  for (const [name, variable] of Object.entries(RADIUS_SOURCES)) {
    radii.set(name, lengthInPixels(requireValue(shared, variable), shared));
  }
  for (const radius of new Set(radii.values())) {
    put(
      primitives,
      `scale.radius.${radius}`,
      token(String(radius), 'borderRadius'),
    );
  }
  for (const [name, radius] of radii) {
    put(
      semantic,
      `radius.${name}`,
      token(`{scale.radius.${radius}}`, 'borderRadius'),
    );
  }
}

function addSizeTokens(semantic, css, shared) {
  postcss.parse(css).walkAtRules('utility', (rule) => {
    const match = /^icon-(xs|sm|md|lg)$/.exec(rule.params);
    if (!match) {
      return;
    }
    const properties = new Map();
    rule.walkDecls((declaration) =>
      properties.set(declaration.prop, declaration.value),
    );
    const width = lengthInPixels(properties.get('width'), shared);
    const height = lengthInPixels(properties.get('height'), shared);
    if (width !== height) {
      throw new Error(`Icon ${match[1]} has different width and height`);
    }
    put(semantic, `size.icon.${match[1]}`, token(String(width), 'sizing'));
  });
  const dialogWidth = lengthInPixels(
    requireValue(shared, '--dialog-desktop-max-width'),
    shared,
  );
  put(
    semantic,
    'size.dialog.desktop-max-width',
    token(String(dialogWidth), 'sizing'),
  );
}

export async function generateTokens() {
  const [paletteCss, sharedThemeCss, sharedCss, appThemeCss, tailwindCss] =
    await Promise.all([
      readFile(resolve(SHARED_STYLES, 'palette.css'), 'utf8'),
      readFile(resolve(SHARED_STYLES, 'theme-light.css'), 'utf8'),
      readFile(resolve(SHARED_STYLES, 'tokens.css'), 'utf8'),
      readFile(resolve(APP_STYLES, 'theme-light.css'), 'utf8'),
      readFile(
        fileURLToPath(import.meta.resolve('tailwindcss/theme.css')),
        'utf8',
      ),
    ]);
  const palette = readCssDeclarations(paletteCss);
  const sharedTheme = readCssDeclarations(sharedThemeCss);
  const shared = readCssDeclarations(sharedCss);
  const appTheme = readCssDeclarations(appThemeCss);
  const tailwind = readCssDeclarations(tailwindCss);
  const values = new Map([...palette, ...sharedTheme, ...appTheme]);
  const references = new Map();
  const omitted = [];
  const result = Object.fromEntries(SET_ORDER.map((name) => [name, {}]));

  for (const [name, value] of palette) {
    const match = /^--([a-z]+)-(\d+)$/.exec(name);
    if (!match) {
      continue;
    }
    put(
      result.primitives,
      `color.${match[1]}.${match[2]}`,
      token(colorValue(value, values, references), 'color'),
    );
    references.set(name, `color.${match[1]}.${match[2]}`);
  }
  addColorTokens(
    result['modes/light'],
    sharedTheme,
    values,
    references,
    sharedDescription,
  );
  addColorTokens(result['app/light'], appTheme, values, references, () => '');
  addSpacingTokens(result.semantic, tailwind);
  addTypographyTokens(result.primitives, result.semantic, shared, omitted);
  addRadiusTokens(result.primitives, result.semantic, shared);
  addSizeTokens(result.semantic, sharedCss, shared);

  result.$themes = [THEME];
  result.$metadata = {
    tokenSetOrder: SET_ORDER,
    activeThemes: ['Colour scheme/Light'],
    activeSets: SET_ORDER,
  };
  return { tokens: result, omitted };
}

function flattenSet(value, path = '', tokens = new Map()) {
  for (const [name, child] of Object.entries(value)) {
    const qualified = path ? `${path}.${name}` : name;
    if (child && typeof child === 'object' && '$type' in child) {
      tokens.set(qualified, child);
    } else if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenSet(child, qualified, tokens);
    }
  }
  return tokens;
}

function describeToken(value) {
  return `type=${JSON.stringify(value.$type)} value=${JSON.stringify(value.$value)} description=${JSON.stringify(value.$description ?? '')}`;
}

export function compareTokenFiles(generated, exported) {
  const differences = [];
  const sets = new Set([
    ...SET_ORDER,
    ...Object.keys(exported).filter((name) => !name.startsWith('$')),
  ]);
  for (const set of sets) {
    if (!(set in generated) || !(set in exported)) {
      differences.push(`${set in generated ? 'MISSING' : 'EXTRA'} set ${set}`);
    }
    const expected = flattenSet(generated[set] ?? {});
    const actual = flattenSet(exported[set] ?? {});
    const names = new Set([...expected.keys(), ...actual.keys()]);
    for (const name of [...names].sort()) {
      const source = expected.get(name);
      const penpot = actual.get(name);
      if (!source) {
        differences.push(`EXTRA ${set} ${name} ${describeToken(penpot)}`);
      } else if (!penpot) {
        differences.push(`MISSING ${set} ${name} ${describeToken(source)}`);
      } else if (!isDeepStrictEqual(source, penpot)) {
        differences.push(
          `CHANGED ${set} ${name} generated(${describeToken(source)}) export(${describeToken(penpot)})`,
        );
      }
    }
  }
  const themesWithoutIds = (themes) =>
    themes?.map((theme) =>
      Object.fromEntries(
        Object.entries(theme).filter(([name]) => name !== 'id'),
      ),
    );
  const generatedThemes = themesWithoutIds(generated.$themes);
  const exportedThemes = themesWithoutIds(exported.$themes);
  if (!isDeepStrictEqual(generatedThemes, exportedThemes)) {
    differences.push(
      `CHANGED $themes generated=${JSON.stringify(generatedThemes)} export=${JSON.stringify(exportedThemes)}`,
    );
  }
  if (!isDeepStrictEqual(generated.$metadata, exported.$metadata)) {
    differences.push(
      `CHANGED $metadata generated=${JSON.stringify(generated.$metadata)} export=${JSON.stringify(exported.$metadata)}`,
    );
  }
  return differences;
}

async function main(args) {
  const { tokens, omitted } = await generateTokens();
  for (const problem of omitted) {
    process.stderr.write(`OMITTED ${problem}\n`);
  }
  if (args[0] === '--check' && args.length === 2) {
    const exported = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
    const differences = compareTokenFiles(tokens, exported);
    process.stdout.write(
      `${differences.length ? differences.join('\n') : 'No drift.'}\n`,
    );
    process.exitCode = differences.length ? 1 : 0;
  } else if (args[0] === '--output' && args.length === 2) {
    await writeFile(resolve(args[1]), `${JSON.stringify(tokens, null, 2)}\n`);
  } else if (args.length === 0) {
    process.stdout.write(`${JSON.stringify(tokens, null, 2)}\n`);
  } else {
    throw new Error(
      'Usage: node packages/ui/scripts/penpot-tokens.mjs [--output file | --check export.json]',
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main(process.argv.slice(2));
}
