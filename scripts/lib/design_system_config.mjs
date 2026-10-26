#!/usr/bin/env node
// Reads the design-system allowlists as data, and reports what the lint rules
// actually consume for a set of probe paths. Scraping the config text cannot
// tell the two apart: a list can stay byte-identical while the rule that reads
// it is unhooked.

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';

const LIST_NAMES = [
  'RAW_BUTTON_OWNERS',
  'RAW_DIALOG_OWNERS',
  'CLOSED_COMPONENTS',
  'RAW_ELEMENT_EXEMPT_GLOBS',
  'IGNORED_PATHS',
  'TYPOGRAPHY_OWNERS',
  'TYPOGRAPHY_LINT_GLOBS',
  'TYPOGRAPHY_RESTRICTIONS',
  'CLASS_ASSERTION_EXEMPT_PACKAGES',
  'CLASS_ASSERTION_EXEMPT_TESTS',
  'STYLE_OWNERS',
  'RAW_FORM_TYPE_VARIANT_OWNERS',
];

const PATTERN_LIST_NAMES = new Set(['TYPOGRAPHY_RESTRICTIONS']);

const STUB_PLUGIN = {
  rules: {
    'no-restricted-classes': { meta: { schema: false }, create: () => ({}) },
  },
};

const RULE_NAME = 'no-restricted-syntax';
const TYPOGRAPHY_RULE = 'better-tailwindcss/no-restricted-classes';
const IMPORT_RULE = 'no-restricted-imports';
const TYPOGRAPHY_PROBE = 'required';
const ERROR_SEVERITIES = ['error', 2];

const SYNTHETIC_PROBES = [
  'frontend/src/__ratchet_probe__.tsx',
  'frontend/src/__ratchet_probe__.ts',
  'packages/lexicon/src/__ratchet_probe__.tsx',
  'extension/src/__ratchet_probe__.tsx',
  'extension/src/__ratchet_probe__.ts',
  'frontend/e2e/__ratchet_probe__.spec.ts',
];

const CLOSED_SURFACE_SELECTOR =
  /^JSXOpeningElement:matches\((?<names>.*)\) > JSXAttribute\[name\.name='(?<property>className|style)'\]$/;
const INLINE_STYLE_SELECTOR = "JSXAttribute[name.name='style']";
const COMPONENT_NAME = /\[name\.name='([^']+)'\]/g;
const RAW_BUTTON_SELECTOR = "JSXOpeningElement[name.name='button']";
// The ban the config must wire is the one this file states, not the one the
// config exports: a config that narrows its own selectors and wires the
// narrowed set would otherwise ratchet itself.
const CLASS_ASSERTION_SELECTORS = [
  "CallExpression[callee.property.name='toHaveClass']",
  "CallExpression[callee.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
  "CallExpression[callee.object.name='expect'] MemberExpression[property.name=/^(className|classList)$/]",
  "CallExpression[callee.property.name='toHaveAttribute'] Literal[value='class']",
  "CallExpression[callee.property.name='getAttribute'] Literal[value='class']",
];
const DIALOG_MEMBERS =
  /\[name\.object\.name='DialogPrimitive'\]\[name\.property\.name=\/\^\((?<members>[^)]+)\)\$\/\]/;

const GLOB_ALTERNATIVES = /\{([^}]*)\}/g;
const GLOB_DIRECTORY_WILDCARD = /\*\*\//g;
const GLOB_WILDCARD = /\*/g;

function selectorsOf(rule) {
  if (!Array.isArray(rule)) {
    return [];
  }
  return rule.slice(1).map((entry) => (typeof entry === 'string' ? entry : entry.selector));
}

function severityOf(rule) {
  return Array.isArray(rule) ? (rule[0] ?? null) : null;
}

function restrictedTypeImports(rule) {
  const paths = Array.isArray(rule) ? rule[1]?.paths : undefined;
  const restriction = paths?.find((entry) => entry.name === '@flyt/ui');
  return restriction?.importNames ?? [];
}

// A concrete path the glob matches, so ESLint resolves the same rule block for
// it that it resolves for a real file under the glob.
function examplePathForGlob(glob) {
  const path = glob
    .replace(GLOB_ALTERNATIVES, (_, alternatives) => alternatives.split(',')[0])
    .replace(GLOB_DIRECTORY_WILDCARD, '__glob__/')
    .replace(/\*\*/g, '__glob__')
    .replace(GLOB_WILDCARD, '__glob__');
  const filename = path.slice(path.lastIndexOf('/') + 1);
  return filename.includes('.') ? path : `${path}.tsx`;
}

// Every brace alternative gets its own probe: a rule block that shadows the
// config for `.tsx` alone leaves a `.ts` probe on the original rule.
function examplePathsForGlob(glob) {
  const match = /\{([^}]*)\}/.exec(glob);
  if (match === null) {
    return [examplePathForGlob(glob)];
  }
  const prefix = glob.slice(0, match.index);
  const suffix = glob.slice(match.index + match[0].length);
  return match[1]
    .split(',')
    .flatMap((alternative) => examplePathsForGlob(`${prefix}${alternative}${suffix}`));
}

function globsOf(value) {
  if (typeof value === 'string') {
    return [value];
  }
  return Array.isArray(value) ? value : [];
}

function restrictPatterns(rule) {
  const restrict = Array.isArray(rule) ? rule[1]?.restrict : undefined;
  return Array.isArray(restrict) ? patternsOf(restrict) : [];
}

function patternsOf(entries) {
  return entries
    .map((entry) => entry?.pattern)
    .filter((pattern) => typeof pattern === 'string');
}

// The type vocabulary stands down through TYPOGRAPHY_OWNERS, so what the rule
// applies is decided by what ESLint resolves for a path, not by the shape of
// the block that carries it: flat config is last-match-wins, so a block
// appended after the typography block, or an entry spread into the owners
// block, re-decides the answer for real files while every list stays
// byte-identical.
function typographyProbePaths(lists) {
  const globs = Array.isArray(lists.TYPOGRAPHY_LINT_GLOBS)
    ? lists.TYPOGRAPHY_LINT_GLOBS
    : [];
  return globs.flatMap((glob) => examplePathsForGlob(glob));
}

function typographyViolations(lists, probes) {
  const restrictions = lists.TYPOGRAPHY_RESTRICTIONS;
  const globs = Array.isArray(lists.TYPOGRAPHY_LINT_GLOBS)
    ? lists.TYPOGRAPHY_LINT_GLOBS
    : null;
  const violations = [];
  if (globs === null) {
    violations.push(
      'TYPOGRAPHY_LINT_GLOBS is not exported: the type vocabulary has no scope',
    );
  }
  if (restrictions === null) {
    violations.push(
      'TYPOGRAPHY_RESTRICTIONS is not exported: nothing says which utilities the vocabulary owns',
    );
  }
  if (globs === null || restrictions === null) {
    return violations;
  }

  for (const probe of probes) {
    if (probe.typography !== TYPOGRAPHY_PROBE) {
      continue;
    }
    if (probe.pathIgnored) {
      violations.push(`${probe.path}: ignored by the config, so no rule reaches it`);
      continue;
    }
    if (!ERROR_SEVERITIES.includes(probe.typographySeverity)) {
      violations.push(
        `${probe.path}: ${TYPOGRAPHY_RULE} severity is ${JSON.stringify(
          probe.typographySeverity,
        )}, not 'error'`,
      );
    }
    const missing = restrictions.filter(
      (pattern) => !probe.typographyRestrictions.includes(pattern),
    );
    if (missing.length > 0) {
      violations.push(
        `${probe.path}: the config resolves ${
          restrictions.length - missing.length
        } of ${restrictions.length} type restrictions for this path, so the rest are open`,
      );
    }
  }
  return violations;
}

function restrictsRawButton(rule) {
  return selectorsOf(rule).includes(RAW_BUTTON_SELECTOR);
}

// Every glob a rule block stands down on, or the config skips, has to be one the
// exported lists name: a literal beside a spread is the same knob, unratcheted.
function unlistedGlobs(config, lists) {
  const knownExempt = new Set([
    ...lists.RAW_BUTTON_OWNERS,
    ...lists.RAW_DIALOG_OWNERS,
    ...lists.RAW_ELEMENT_EXEMPT_GLOBS,
    ...(lists.CLASS_ASSERTION_EXEMPT_TESTS ?? []),
  ]);
  const knownIgnored = new Set(lists.IGNORED_PATHS);
  const exempt = new Set();
  const ignored = new Set();
  for (const block of config) {
    const rule = block?.rules?.[RULE_NAME];
    if (Array.isArray(rule) && !restrictsRawButton(rule)) {
      for (const glob of globsOf(block.files)) {
        if (!knownExempt.has(glob)) {
          exempt.add(glob);
        }
      }
    }
    if (block?.files === undefined) {
      for (const glob of globsOf(block?.ignores)) {
        if (!knownIgnored.has(glob)) {
          ignored.add(glob);
        }
      }
    }
  }
  return [
    ...[...exempt].map((glob) => ({ kind: 'raw-element exemption', glob })),
    ...[...ignored].map((glob) => ({ kind: 'ignored path', glob })),
  ].sort((left, right) => left.glob.localeCompare(right.glob));
}

async function pathTester(repoRoot, files, ignores) {
  const block = { files, rules: { [TYPOGRAPHY_RULE]: 'error' } };
  if (ignores.length > 0) {
    block.ignores = ignores;
  }
  return new ESLint({
    overrideConfigFile: true,
    cwd: repoRoot,
    overrideConfig: [{ plugins: { 'better-tailwindcss': STUB_PLUGIN } }, block],
  });
}

async function testerMatchesPath(tester, path) {
  const resolved = await tester.calculateConfigForFile(path);
  return resolved?.rules?.[TYPOGRAPHY_RULE] !== undefined;
}

function narrowedTypographyBlocks(config, restrictions) {
  return config.filter((block) => {
    const rule = block?.rules?.[TYPOGRAPHY_RULE];
    if (rule === undefined) {
      return false;
    }
    const patterns = restrictPatterns(rule);
    return !restrictions.every((pattern) => patterns.includes(pattern));
  });
}

async function unlistedTypographyGlobs(repoRoot, config, lists, probePaths) {
  const restrictions = lists.TYPOGRAPHY_RESTRICTIONS;
  if (!Array.isArray(restrictions)) {
    return [];
  }
  const owners = new Set(globsOf(lists.TYPOGRAPHY_OWNERS));
  const unlisted = new Set();
  for (const block of narrowedTypographyBlocks(config, restrictions)) {
    const globs = globsOf(block.files);
    if (globs.length === 0) {
      continue;
    }
    const tester = await pathTester(repoRoot, globs, globsOf(block.ignores));
    let probed = false;
    for (const path of probePaths) {
      if (await testerMatchesPath(tester, path)) {
        probed = true;
        break;
      }
    }
    if (probed) {
      continue;
    }
    for (const glob of globs) {
      if (!owners.has(glob)) {
        unlisted.add(glob);
      }
    }
  }
  return [...unlisted].map((glob) => ({ kind: 'type stand-down', glob }));
}

function trackedTypeScriptFiles(repoRoot) {
  try {
    return execFileSync('git', ['ls-files', '-z', '*.tsx'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\0')
      .filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
}

async function trackedTypographyProbePaths(repoRoot, lists) {
  const globs = globsOf(lists.TYPOGRAPHY_LINT_GLOBS);
  const files = trackedTypeScriptFiles(repoRoot);
  if (globs.length === 0 || files.length === 0) {
    return [];
  }
  const tester = await pathTester(repoRoot, globs, [
    ...globsOf(lists.TYPOGRAPHY_OWNERS),
    ...globsOf(lists.IGNORED_PATHS),
  ]);
  const perDirectory = new Map();
  for (const file of files) {
    if (!(await testerMatchesPath(tester, file))) {
      continue;
    }
    const cut = file.lastIndexOf('/');
    const directory = cut === -1 ? '.' : file.slice(0, cut);
    if (!perDirectory.has(directory)) {
      perDirectory.set(directory, file);
    }
  }
  return [...perDirectory.values()].sort();
}

function coveredComponents(selectors) {
  const covered = { className: new Set(), style: new Set() };
  for (const selector of selectors) {
    const match = CLOSED_SURFACE_SELECTOR.exec(selector);
    if (match === null) {
      continue;
    }
    for (const name of match.groups.names.matchAll(COMPONENT_NAME)) {
      covered[match.groups.property].add(name[1]);
    }
  }
  return {
    className: [...covered.className].sort(),
    style: [...covered.style].sort(),
  };
}

function restrictsRawDialog(selectors) {
  return selectors.some((selector) => {
    const match = DIALOG_MEMBERS.exec(selector);
    if (match === null) {
      return false;
    }
    const members = new Set(match.groups.members.split('|'));
    return members.has('Content') && members.has('Overlay');
  });
}

function readLists(module, configPath, listsOnly) {
  const lists = {};
  const missing = [];
  for (const name of LIST_NAMES) {
    const value = module[name];
    if (Array.isArray(value)) {
      lists[name] = PATTERN_LIST_NAMES.has(name) ? patternsOf(value) : value;
    } else {
      // A revision that predates a list has no baseline for it; the checker
      // falls back to the working tree, so the absence is reported, not fatal.
      lists[name] = null;
      missing.push(name);
    }
  }
  if (missing.length > 0 && !listsOnly) {
    throw new Error(`${configPath} does not export ${missing.join(', ')}`);
  }
  return lists;
}

async function probeConfig(repoRoot, configPath, lists, config) {
  const eslint = new ESLint({ overrideConfigFile: configPath, cwd: process.cwd() });
  const probes = [];
  const seen = new Set();
  const add = (path, exempt, typography = null) => {
    if (!seen.has(path)) {
      seen.add(path);
      probes.push({ path, exempt, typography });
    }
  };
  for (const path of SYNTHETIC_PROBES) {
    add(path, false);
  }
  for (const path of [...lists.RAW_BUTTON_OWNERS, ...lists.RAW_DIALOG_OWNERS]) {
    add(path, false);
  }
  // One probe per style owner, so a file the style channel stays open for is
  // covered even when it appears in no other list.
  for (const path of lists.STYLE_OWNERS) {
    add(path, false);
  }
  for (const path of lists.RAW_FORM_TYPE_VARIANT_OWNERS) {
    add(path, false);
  }
  // One probe per exemption glob, so a glob the config selects on is covered
  // without the checker re-deciding which paths are exempt.
  for (const glob of lists.RAW_ELEMENT_EXEMPT_GLOBS) {
    add(examplePathForGlob(glob), true);
  }
  // One probe per lint glob, so the type vocabulary is read where it applies
  // rather than where a block claims it applies.
  for (const path of typographyProbePaths(lists)) {
    add(path, false, TYPOGRAPHY_PROBE);
  }
  const trackedProbes = (await trackedTypographyProbePaths(repoRoot, lists))
    .filter((path) => !seen.has(path))
    .map((path) => ({ path, typography: TYPOGRAPHY_PROBE }));
  // ...and one test path inside each package the class-assertion ban stands
  // down for, so an exemption that stops reaching the package is visible.
  for (const packagePath of lists.CLASS_ASSERTION_EXEMPT_PACKAGES ?? []) {
    add(`${packagePath}/src/__ratchet_probe__.test.tsx`, true);
  }
  // ...and the exempt tests themselves, so an exemption that stops reaching
  // one of them is visible too.
  for (const exemptTest of lists.CLASS_ASSERTION_EXEMPT_TESTS ?? []) {
    add(exemptTest, true);
  }
  for (const probe of [...probes, ...trackedProbes]) {
    const pathIgnored = await eslint.isPathIgnored(probe.path);
    // `calculateConfigForFile` returns nothing at all for an ignored path,
    // rather than an empty config.
    const resolved = pathIgnored ? {} : await eslint.calculateConfigForFile(probe.path);
    const rule = resolved.rules?.[RULE_NAME];
    const typographyRule = resolved.rules?.[TYPOGRAPHY_RULE];
    const importRule = resolved.rules?.[IMPORT_RULE];
    const selectors = selectorsOf(rule);
    probe.pathIgnored = pathIgnored;
    probe.severity = severityOf(rule);
    probe.closedComponents = coveredComponents(selectors);
    probe.rawButton = selectors.includes(RAW_BUTTON_SELECTOR);
    probe.rawDialog = restrictsRawDialog(selectors);
    probe.styleBan = selectors.includes(INLINE_STYLE_SELECTOR);
    probe.typographySeverity = severityOf(typographyRule);
    probe.typographyRestrictions = restrictPatterns(typographyRule);
    probe.classAssertions = CLASS_ASSERTION_SELECTORS.every((selector) =>
      selectors.includes(selector),
    );
    probe.typeImportSeverity = severityOf(importRule);
    probe.restrictedTypeImports = restrictedTypeImports(importRule);
  }
  const unlisted = [
    ...unlistedGlobs(config, lists),
    ...(await unlistedTypographyGlobs(repoRoot, config, lists, typographyProbePaths(lists))),
  ].sort((left, right) => left.glob.localeCompare(right.glob));
  return {
    unlistedGlobs: unlisted,
    probes: probes.sort((left, right) => left.path.localeCompare(right.path)),
    trackedProbes,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: 'string' },
      'lists-only': { type: 'boolean', default: false },
    },
  });
  if (values.config === undefined) {
    throw new Error('usage: design_system_config.mjs --config <eslint-config> [--lists-only]');
  }

  const module = await import(pathToFileURL(values.config).href);
  const lists = readLists(module, values.config, values['lists-only']);
  if (values['lists-only']) {
    process.stdout.write(`${JSON.stringify(lists, null, 2)}\n`);
    return;
  }
  const repoRoot = process.cwd();
  const { unlistedGlobs: unlisted, probes, trackedProbes } = await probeConfig(
    repoRoot,
    values.config,
    lists,
    module.default,
  );
  const report = {
    ...lists,
    unlistedGlobs: unlisted,
    typographyViolations: typographyViolations(lists, [...probes, ...trackedProbes]),
    trackedTypographyProbes: trackedProbes.map((probe) => probe.path),
    probes,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
