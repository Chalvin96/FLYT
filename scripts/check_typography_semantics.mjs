#!/usr/bin/env node
// Fails when a class a file writes resolves, by what the compiler emits for it,
// to a typography property the `Text` vocabulary owns. Spelling a grammar of
// class names grows with every Tailwind release; the CSS properties below
// do not, and a string that names no class resolves to nothing, so reading
// every string literal and template chunk is free.

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  CLASS_ASSERTION_EXEMPT_PACKAGES,
  CLASS_ASSERTION_EXEMPT_TESTS,
  IGNORED_PATHS,
  TYPOGRAPHY_LINT_GLOBS,
  TYPOGRAPHY_OWNERS,
} from '../eslint.config.js';

const TYPOGRAPHY_PROPERTIES = [
  'font',
  'font-size',
  'line-height',
  'font-weight',
  'font-family',
  'letter-spacing',
];

const BASELINE_RELATIVE_PATH = 'scripts/typography_semantics_baseline.json';
const BASELINE_PATH = path.join(
  import.meta.dirname,
  'typography_semantics_baseline.json',
);
const BASELINE_ACK_VARIABLE = 'DESIGN_SYSTEM_ESCAPES_ACK';
const DEFAULT_BASE = 'origin/master';

const STYLE_SHEET_ENTRIES = [
  'frontend/src/index.css',
  'packages/ui/src/styles/entry.css',
  'extension/tailwind/index.css',
];

async function compileStyleSheet(repoRoot, entryRelative) {
  const entry = path.join(repoRoot, entryRelative);
  const require = createRequire(entry);
  const { compile } = require('tailwindcss');

  async function loadStylesheet(id, base) {
    const file =
      id === 'tailwindcss'
        ? require.resolve('tailwindcss/index.css')
        : !id.startsWith('.') && !path.isAbsolute(id)
          ? require.resolve(id)
          : path.resolve(base, id);
    return {
      path: file,
      base: path.dirname(file),
      content: await readFile(file, 'utf8'),
    };
  }

  async function loadModule(id, base) {
    const file = require.resolve(id, { paths: [base ?? path.dirname(entry)] });
    const module = await import(pathToFileURL(file).href);
    return {
      path: file,
      base: path.dirname(file),
      module: module.default ?? module,
    };
  }

  return compile(await readFile(entry, 'utf8'), {
    base: path.dirname(entry),
    from: entry,
    loadStylesheet,
    loadModule,
  });
}

function expandBraces(glob) {
  const group = /\{([^{}]+)\}/.exec(glob);
  if (group === null) {
    return [glob];
  }
  return group[1]
    .split(',')
    .flatMap((alternative) =>
      expandBraces(
        `${glob.slice(0, group.index)}${alternative}${glob.slice(group.index + group[0].length)}`,
      ),
    );
}

function globToRegExp(glob) {
  const source = glob
    .replace(/[.+^$()|[\]{}?\\]/g, '\\$&')
    .replace(/\*\*\/|\*\*|\*/g, (star) =>
      star === '**/' ? '(?:.*/)?' : star === '**' ? '.*' : '[^/]*',
    );
  return new RegExp(`^${source}$`);
}

function matchersOf(globs) {
  return globs.flatMap(expandBraces).map(globToRegExp);
}

function isMatchedByAny(matchers, candidate) {
  return matchers.some((matcher) => matcher.test(candidate));
}

function trackedFiles(repoRoot) {
  return execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.ts', '*.tsx'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter((entry) => entry.length > 0);
}

const CLASS_ASSERTION_PATH = /\.(?:test|spec|stories)\.(?:ts|tsx)$/;

// Where the config itself says a class string is an assertion rather than a
// call site: the design system's own tests, which state the classes the
// recipes expose, and the tests whose subject only a class can name. Both
// lists are ratcheted.
function isClassAssertionFile(file) {
  return (
    CLASS_ASSERTION_EXEMPT_TESTS.includes(file) ||
    CLASS_ASSERTION_EXEMPT_PACKAGES.some(
      (packagePath) =>
        file.startsWith(`${packagePath}/`) && CLASS_ASSERTION_PATH.test(file),
    )
  );
}

const QUOTED_STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

function stringChunksOf(source) {
  const chunks = [];
  let openTemplate = false;

  for (const [line, text] of source.split('\n').entries()) {
    let cursor = 0;

    if (openTemplate) {
      const closing = text.indexOf('`');
      if (closing === -1) {
        chunks.push({ text, line: line + 1 });
        continue;
      }
      chunks.push({ text: text.slice(0, closing), line: line + 1 });
      openTemplate = false;
      cursor = closing + 1;
    }

    while (cursor < text.length) {
      QUOTED_STRING.lastIndex = cursor;
      const quoted = QUOTED_STRING.exec(text);
      const opening = text.indexOf('`', cursor);

      if (quoted !== null && (opening === -1 || quoted.index < opening)) {
        chunks.push({
          text: quoted[0].slice(1, -1),
          line: line + 1,
        });
        cursor = QUOTED_STRING.lastIndex;
        continue;
      }
      if (opening === -1) {
        break;
      }
      const closing = text.indexOf('`', opening + 1);
      if (closing === -1) {
        chunks.push({ text: text.slice(opening + 1), line: line + 1 });
        openTemplate = true;
        break;
      }
      chunks.push({ text: text.slice(opening + 1, closing), line: line + 1 });
      cursor = closing + 1;
    }
  }
  return chunks;
}

function candidatesOf(chunks) {
  return chunks.flatMap(({ text }) =>
    text
      .replace(/\$\{[^}]*\}/g, ' ')
      .split(/\s+/)
      .map((candidate) => candidate.replace(/^['"]+|['"]+$/g, ''))
      .filter((candidate) => candidate.length > 0),
  );
}

const CLASS_SELECTOR = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[^\\.\s,{}():])+)/g;
const HEX_ESCAPE = /\\[0-9a-fA-F]{1,6}\s?/;
const COMBINATOR_CHARACTERS = new Set([' ', '\t', '\n', '\r', '>', '+', '~']);

function codePointOf(hex) {
  const codePoint = Number.parseInt(hex, 16);
  return codePoint <= 0x10ffff ? codePoint : 0xfffd;
}

function decodedClass(rawClass) {
  return rawClass.replace(
    /\\([0-9a-fA-F]{1,6})\s?|\\(.)/g,
    (_, hex, character) =>
      hex === undefined ? character : String.fromCodePoint(codePointOf(hex)),
  );
}

function escapeLengthAt(selector, index) {
  if (selector[index] !== '\\') {
    return 0;
  }
  const hex = HEX_ESCAPE.exec(selector.slice(index, index + 8));
  return hex === null ? 2 : hex[0].length;
}

function classCandidatesOf(selector) {
  let subject = [];
  let compound = [];
  let depth = 0;
  let index = 0;
  while (index < selector.length) {
    const escapeLength = escapeLengthAt(selector, index);
    if (escapeLength > 0) {
      index += escapeLength;
      continue;
    }
    const character = selector[index];
    index += 1;
    if (character === '(' || character === '[') {
      depth += 1;
    } else if (character === ')' || character === ']') {
      depth -= 1;
    }
    if (depth === 0 && COMBINATOR_CHARACTERS.has(character)) {
      subject = compound;
      compound = [];
      continue;
    }
    if (character === '.' && depth === 0) {
      CLASS_SELECTOR.lastIndex = index - 1;
      const match = CLASS_SELECTOR.exec(selector);
      if (match !== null) {
        compound.push(decodedClass(match[1]));
        index = CLASS_SELECTOR.lastIndex;
      }
    }
  }
  return compound.length > 0 ? compound : subject;
}

function propertiesByCandidate(css) {
  const properties = new Map();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Set(
      body
        .split(';')
        .map((declaration) => declaration.slice(0, declaration.indexOf(':')).trim())
        .filter((property) => property.length > 0),
    );
    if (declarations.size === 0) {
      continue;
    }
    for (const candidate of classCandidatesOf(selector)) {
      const merged = properties.get(candidate) ?? new Set();
      for (const declaration of declarations) {
        merged.add(declaration);
      }
      properties.set(candidate, merged);
    }
  }
  return properties;
}

function typographyPropertiesOf(propertiesByCandidateMap, candidate) {
  const declarations = propertiesByCandidateMap.get(candidate);
  if (declarations === undefined) {
    return [];
  }
  return TYPOGRAPHY_PROPERTIES.filter((property) => declarations.has(property));
}

function baselineOf() {
  const { findings } = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return new Map(
    findings.map(({ file, candidate, reason }) => [
      `${file}\u0000${candidate}`,
      { file, candidate, reason },
    ]),
  );
}

function acknowledgedEntries() {
  const raw = process.env[BASELINE_ACK_VARIABLE] ?? '';
  const separator = raw.includes('\n') ? '\n' : ',';
  return new Set(
    raw
      .split(separator)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function mergeBaseCommit(repoRoot, base) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    throw new Error(
      `Typography semantics cannot resolve base ${base} to a commit. Refusing to run without a baseline.`,
    );
  }
  try {
    return execFileSync('git', ['merge-base', 'HEAD', base], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error(
      `Typography semantics cannot find a merge base between HEAD and ${base}. ` +
        'A shallow checkout or an unrelated base cannot be ratcheted against; ' +
        'refusing to run without a baseline.',
    );
  }
}

function baselineAt(repoRoot, commit) {
  try {
    const shown = execFileSync(
      'git',
      ['show', `${commit}:${BASELINE_RELATIVE_PATH}`],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return JSON.parse(shown).findings ?? [];
  } catch (error) {
    const absent =
      typeof error.stderr === 'string' &&
      (error.stderr.includes('exists on disk, but not in') ||
        error.stderr.includes('does not exist in'));
    if (absent) {
      return null;
    }
    throw new Error(
      `Typography semantics could not read the baseline at ${commit}: ${error.message}`,
    );
  }
}

function baselineGrowth(repoRoot, baseline, base) {
  const commit = mergeBaseCommit(repoRoot, base);
  const baseFindings = baselineAt(repoRoot, commit);
  if (baseFindings === null) {
    return { commit, grew: [], bootstrapped: true };
  }
  const baseKeys = new Set(
    baseFindings.map(({ file, candidate }) => `${file}\u0000${candidate}`),
  );
  const acknowledged = acknowledgedEntries();
  const grew = [...baseline.values()].filter(
    (entry) =>
      !baseKeys.has(`${entry.file}\u0000${entry.candidate}`) &&
      !acknowledged.has(entry.file),
  );
  return { commit, grew, bootstrapped: false };
}

async function main() {
  const { values } = parseArgs({ options: { base: { type: 'string' } } });
  const base = values.base ?? process.env.LOCAL_CI_BASE_SHA ?? DEFAULT_BASE;
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const lintMatchers = matchersOf(TYPOGRAPHY_LINT_GLOBS);
  const ownerMatchers = matchersOf(TYPOGRAPHY_OWNERS);
  const ignoredMatchers = matchersOf(IGNORED_PATHS);

  const sites = [];
  for (const file of trackedFiles(repoRoot)) {
    if (!isMatchedByAny(lintMatchers, file)) {
      continue;
    }
    if (
      isMatchedByAny(ownerMatchers, file) ||
      isMatchedByAny(ignoredMatchers, file) ||
      isClassAssertionFile(file)
    ) {
      continue;
    }
    let source;
    try {
      source = await readFile(path.join(repoRoot, file), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    for (const candidate of candidatesOf(stringChunksOf(source))) {
      sites.push({ file, candidate });
    }
  }
  const candidates = [...new Set(sites.map((site) => site.candidate))];

  const flagged = new Map();
  for (const entry of STYLE_SHEET_ENTRIES) {
    const compiled = await compileStyleSheet(repoRoot, entry);
    const properties = propertiesByCandidate(compiled.build(candidates));
    for (const candidate of candidates) {
      const resolved = typographyPropertiesOf(properties, candidate);
      if (resolved.length === 0) {
        continue;
      }
      const merged = new Set([...(flagged.get(candidate) ?? []), ...resolved]);
      flagged.set(candidate, TYPOGRAPHY_PROPERTIES.filter((p) => merged.has(p)));
    }
  }

  const live = new Map();
  for (const { file, candidate } of sites) {
    if (!flagged.has(candidate) || live.has(`${file}\u0000${candidate}`)) {
      continue;
    }
    live.set(`${file}\u0000${candidate}`, {
      file,
      candidate,
      properties: flagged.get(candidate),
    });
  }

  const baseline = baselineOf();
  const { commit: baseCommit, grew, bootstrapped } = baselineGrowth(
    repoRoot,
    baseline,
    base,
  );
  const unacknowledged = [...live.entries()].filter(([key]) => !baseline.has(key));
  const stale = [...baseline.keys()].filter((key) => !live.has(key));

  if (bootstrapped) {
    process.stdout.write(
      `Typography baseline does not exist at ${baseCommit} — ` +
        'first-time bootstrap, nothing to ratchet the baseline against.\n',
    );
  }
  if (grew.length > 0) {
    process.stdout.write(`Typography baseline grew against ${baseCommit}:\n`);
    for (const { file, candidate } of grew) {
      process.stdout.write(`  + ${file}: ${candidate}\n`);
    }
    process.stdout.write(
      '\nAn added baseline entry pins a finding the base commit does not have.\n' +
        `Re-run with ${BASELINE_ACK_VARIABLE} naming each added entry's file, ` +
        'comma separated.\n',
    );
  }
  for (const [, { file, candidate, properties }] of unacknowledged) {
    process.stdout.write(
      `${file}: ${candidate} sets ${properties.join(', ')}\n`,
    );
  }
  for (const [key, { file, candidate }] of baseline) {
    if (stale.includes(key)) {
      process.stdout.write(
        `${file}: ${candidate} no longer resolves to typography; delete its baseline entry\n`,
      );
    }
  }
  if (unacknowledged.length > 0) {
    process.stdout.write(
      `\n${unacknowledged.length} strings set typography the Text vocabulary owns. Ask Text for a size (its leading comes with it), or name the file in TYPOGRAPHY_OWNERS with the reason.\n`,
    );
  }
  if (unacknowledged.length > 0 || stale.length > 0 || grew.length > 0) {
    process.exitCode = 1;
    return;
  }
  for (const { file, candidate, reason } of baseline.values()) {
    process.stdout.write(`${file}: ${candidate} (pinned: ${reason})\n`);
  }
  process.stdout.write(
    `Typography semantics: ${candidates.length} strings across the type lint globs; ` +
      `${baseline.size} pinned findings, nothing new.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
