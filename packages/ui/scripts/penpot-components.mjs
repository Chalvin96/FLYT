import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS_ROOT = resolve(UI_ROOT, 'src/components');
const BASELINE = resolve(UI_ROOT, 'penpot-components.json');

function propertyName(name, fileName) {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  throw new Error(`Unsupported cva variant key in ${fileName}`);
}

function objectProperty(object, name, fileName) {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`Unsupported cva variant property in ${fileName}`);
    }
    if (propertyName(property.name, fileName) === name) {
      return property.initializer;
    }
  }
  return undefined;
}

function variantObject(value, fileName) {
  if (!ts.isObjectLiteralExpression(value)) {
    throw new Error(`Expected literal cva variants in ${fileName}`);
  }
  return value;
}

function addCvaVariants(call, axes, fileName) {
  const options = call.arguments[1];
  if (!options) {
    return;
  }
  const variants = objectProperty(
    variantObject(options, fileName),
    'variants',
    fileName,
  );
  if (!variants) {
    return;
  }
  for (const axis of variantObject(variants, fileName).properties) {
    if (!ts.isPropertyAssignment(axis)) {
      throw new Error(`Unsupported cva variant axis in ${fileName}`);
    }
    const axisName = propertyName(axis.name, fileName);
    const values = axes.get(axisName) ?? new Set();
    for (const value of variantObject(axis.initializer, fileName).properties) {
      if (!ts.isPropertyAssignment(value)) {
        throw new Error(`Unsupported cva variant value in ${fileName}`);
      }
      values.add(propertyName(value.name, fileName));
    }
    axes.set(axisName, values);
  }
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedEntries(record) {
  return Object.entries(record).sort(([left], [right]) =>
    compareNames(left, right),
  );
}

function sortedAxes(axes) {
  return Object.fromEntries(
    [...axes]
      .sort(([left], [right]) => compareNames(left, right))
      .map(([axis, values]) => [axis, [...values].sort()]),
  );
}

export function extractCvaVariants(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.getScriptKindFromFileName(fileName),
  );
  if (sourceFile.parseDiagnostics.length) {
    throw new Error(`Cannot parse ${fileName}`);
  }
  const axes = new Map();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'cva'
    ) {
      addCvaVariants(node, axes, fileName);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return sortedAxes(axes);
}

async function componentFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return componentFiles(path);
      }
      if (
        entry.isFile() &&
        ['.ts', '.tsx'].includes(extname(entry.name)) &&
        !/\.(test|stories)\.tsx?$/.test(entry.name)
      ) {
        return [path];
      }
      return [];
    }),
  );
  return files.flat().sort();
}

function componentName(path) {
  return basename(path)
    .replace(/\.tsx?$/, '')
    .replace(/-variants$/, '')
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

export async function generateComponents(directory = COMPONENTS_ROOT) {
  const components = new Map();
  const files = await componentFiles(directory);
  const sources = await Promise.all(
    files.map((path) => readFile(path, 'utf8')),
  );
  for (const [index, path] of files.entries()) {
    const extracted = extractCvaVariants(sources[index], path);
    if (!Object.keys(extracted).length) {
      continue;
    }
    const name = componentName(path);
    const axes = components.get(name) ?? new Map();
    for (const [axis, values] of Object.entries(extracted)) {
      const knownValues = axes.get(axis) ?? new Set();
      for (const value of values) {
        knownValues.add(value);
      }
      axes.set(axis, knownValues);
    }
    components.set(name, axes);
  }
  return Object.fromEntries(
    [...components]
      .sort(([left], [right]) => compareNames(left, right))
      .map(([name, axes]) => [name, sortedAxes(axes)]),
  );
}

export function compareComponentBaselines(committed, current) {
  const differences = [];
  const components = new Set([
    ...Object.keys(committed),
    ...Object.keys(current),
  ]);
  for (const component of [...components].sort()) {
    const axes = new Set([
      ...Object.keys(committed[component] ?? {}),
      ...Object.keys(current[component] ?? {}),
    ]);
    for (const axis of [...axes].sort()) {
      const before = committed[component]?.[axis];
      const after = current[component]?.[axis];
      if (!before || !after) {
        differences.push(
          `${after ? 'ADDED' : 'REMOVED'} ${component} axis ${axis}: ${(after ?? before).join(', ')}`,
        );
        continue;
      }
      const beforeValues = new Set(before);
      const afterValues = new Set(after);
      for (const value of after.filter((value) => !beforeValues.has(value))) {
        differences.push(`ADDED ${component}.${axis} ${value}`);
      }
      for (const value of before.filter((value) => !afterValues.has(value))) {
        differences.push(`REMOVED ${component}.${axis} ${value}`);
      }
    }
  }
  return differences;
}

export function comparePenpotComponents(baseline, penpot) {
  const differences = [];
  const notModelled = [];
  const penpotOnly = [];
  for (const [component, axes] of sortedEntries(baseline)) {
    if (!Object.hasOwn(penpot, component)) {
      notModelled.push(`set ${component}`);
      continue;
    }
    const penpotAxes = penpot[component];
    const mappedAxes = new Map();
    const codeAxes = new Set(
      Object.keys(axes).map((axis) => axis.toLowerCase()),
    );
    for (const [axis, values] of Object.entries(penpotAxes)) {
      const key = axis.toLowerCase();
      if (mappedAxes.has(key)) {
        throw new Error(`Duplicate Penpot axis ${component}.${axis}`);
      }
      mappedAxes.set(key, values);
    }
    for (const [axis, values] of sortedEntries(axes)) {
      const match = mappedAxes.get(axis.toLowerCase());
      if (!match) {
        notModelled.push(`${component} axis ${axis}: ${values.join(', ')}`);
        continue;
      }
      const codeValues = new Set(values);
      const penpotValues = new Set(match);
      for (const value of values.filter((value) => !penpotValues.has(value))) {
        differences.push(`MISSING ${component}.${axis} ${value}`);
      }
      for (const value of match.filter((value) => !codeValues.has(value))) {
        differences.push(`EXTRA ${component}.${axis} ${value}`);
      }
    }
    for (const [axis, values] of sortedEntries(penpotAxes)) {
      if (!codeAxes.has(axis.toLowerCase())) {
        penpotOnly.push(`${component} axis ${axis}: ${values.join(', ')}`);
      }
    }
  }
  for (const component of Object.keys(penpot).sort()) {
    if (!Object.hasOwn(baseline, component)) {
      penpotOnly.push(`set ${component}`);
    }
  }
  return { differences, notModelled, penpotOnly };
}

export function formatPenpotReport({ differences, notModelled, penpotOnly }) {
  return [
    ...(differences.length ? differences : ['No drift.']),
    ...(notModelled.length
      ? ['Not modelled in Penpot:', ...notModelled.map((item) => `  ${item}`)]
      : []),
    ...(penpotOnly.length
      ? ['Penpot only:', ...penpotOnly.map((item) => `  ${item}`)]
      : []),
  ].join('\n');
}

async function main(args) {
  if (args[0] === '--check' && args.length === 2) {
    const baseline = JSON.parse(await readFile(BASELINE, 'utf8'));
    const penpot = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
    const report = comparePenpotComponents(baseline, penpot);
    process.stdout.write(`${formatPenpotReport(report)}\n`);
    process.exitCode = report.differences.length ? 1 : 0;
  } else if (args[0] === '--output' && args.length === 2) {
    const components = await generateComponents();
    await writeFile(
      resolve(args[1]),
      `${JSON.stringify(components, null, 2)}\n`,
    );
  } else if (args.length === 0) {
    process.stdout.write(
      `${JSON.stringify(await generateComponents(), null, 2)}\n`,
    );
  } else {
    throw new Error(
      'Usage: node packages/ui/scripts/penpot-components.mjs [--output file | --check penpot-dump.json]',
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main(process.argv.slice(2));
}
