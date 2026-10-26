import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryRoot = path.resolve(frontendRoot, '..');
const storyIdPattern = /['"`]([a-z0-9-]+--[a-z0-9-]+)['"`]/g;

function collectTypeScriptFiles(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

function main() {
  const temporaryDirectory = mkdtempSync(
    path.join(os.tmpdir(), 'flyt-storybook-index-'),
  );
  const indexPath = path.join(temporaryDirectory, 'index.json');

  try {
    const storybook = spawnSync(
      './node_modules/.bin/storybook',
      ['index', '-o', indexPath],
      {
        cwd: frontendRoot,
        env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
        stdio: 'inherit',
      },
    );

    if (storybook.error) {
      console.error(storybook.error.message);
      return 1;
    }
    if (storybook.status !== 0) return storybook.status ?? 1;

    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    if (!index.entries || typeof index.entries !== 'object') {
      console.error(`Storybook index has no entries: ${indexPath}`);
      return 1;
    }
    const storyIds = new Set(Object.keys(index.entries));
    const unknownIds = [];
    for (const filePath of collectTypeScriptFiles(
      path.join(frontendRoot, 'e2e'),
    ).sort()) {
      const source = readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(storyIdPattern)) {
        if (!storyIds.has(match[1])) {
          const line = source.slice(0, match.index).split('\n').length;
          unknownIds.push(
            `${path.relative(repositoryRoot, filePath)}:${line}: ${match[1]}`,
          );
        }
      }
    }

    if (unknownIds.length > 0) {
      console.error('Unknown E2E Storybook story ids:');
      for (const unknownId of unknownIds) console.error(unknownId);
      return 1;
    }

    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

process.exitCode = main();
