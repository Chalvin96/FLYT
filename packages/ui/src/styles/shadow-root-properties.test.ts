import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import shadowRootProperties from '../../postcss/shadow-root-properties.mjs';

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

const PROPERTY_CANDIDATES = [
  'translate-x-1',
  'border',
  'border-solid',
  'shadow-md',
  'shadow-black',
  'ring',
  'ring-offset-2',
  'blur-sm',
  'duration-300',
];

async function compileSharedStylesheet(): Promise<string> {
  const compiled = await compile(`@import 'tailwindcss';`, {
    base: STYLES_DIRECTORY,
    loadStylesheet,
  });

  return compiled.build(PROPERTY_CANDIDATES);
}

type Registration = { name: string; initial: string | null };

function registrationsOf(css: string): Registration[] {
  return [...css.matchAll(/@property (--tw-[\w-]+) \{([^}]*)\}/g)].map(
    ([, name, body]) => ({
      name: name as string,
      initial:
        /initial-value:\s*([^;}]+)/.exec(body as string)?.[1]?.trim() ?? null,
    }),
  );
}

async function runPlugin(css: string): Promise<string> {
  const result = await postcss([shadowRootProperties()]).process(css, {
    from: 'entry.css',
  });
  return result.css;
}

async function scopedRuleOf(css: string): Promise<postcss.Rule> {
  const root = postcss.parse(css);
  const scope = root.nodes.find(
    (node): node is postcss.AtRule =>
      node instanceof postcss.AtRule &&
      node.name === 'layer' &&
      node.params === 'properties' &&
      node.first?.type === 'rule' &&
      (node.first as postcss.Rule).selector ===
        ':host, *, ::before, ::after, ::backdrop',
  );
  expect(
    scope,
    'the plugin emits no properties layer scoped to the shadow surface',
  ).toBeDefined();
  return scope?.first as postcss.Rule;
}

describe('shadow-root-properties', () => {
  it('test_shadow_root_properties_given_real_tailwind_output_expect_the_registrations_removed', async () => {
    const compiled = await compileSharedStylesheet();
    expect(registrationsOf(compiled).length).toBeGreaterThan(0);

    const css = await runPlugin(compiled);

    expect(registrationsOf(css)).toEqual([]);
  });

  it('test_shadow_root_properties_given_real_tailwind_output_expect_registrations_restate_or_unset_in_the_properties_layer', async () => {
    const compiled = await compileSharedStylesheet();
    const registrations = registrationsOf(compiled);

    const css = await runPlugin(compiled);
    const scope = await scopedRuleOf(css);

    expect(scope.selector).toBe(':host, *, ::before, ::after, ::backdrop');
    const restated = new Map(
      scope.nodes
        .filter((node) => node.type === 'decl')
        .map((node) => [
          (node as postcss.Declaration).prop,
          (node as postcss.Declaration).value,
        ]),
    );
    for (const { name, initial } of registrations) {
      expect(restated.get(name), `${name} restated`).toBe(initial ?? 'initial');
    }
  });

  it('test_shadow_root_properties_given_registrations_without_initial_values_expect_them_unset_and_removed', async () => {
    const compiled = await compileSharedStylesheet();
    const withoutInitial = registrationsOf(compiled).filter(
      ({ initial }) => initial === null,
    );
    expect(withoutInitial.length).toBeGreaterThan(0);

    const css = await runPlugin(compiled);
    const scope = await scopedRuleOf(css);
    const restated = new Map(
      scope.nodes
        .filter((node) => node.type === 'decl')
        .map((node) => [
          (node as postcss.Declaration).prop,
          (node as postcss.Declaration).value,
        ]),
    );
    for (const { name } of withoutInitial) {
      expect(restated.get(name), `${name} unset`).toBe('initial');
      expect(css).not.toContain(`@property ${name} {`);
    }
  });
});
