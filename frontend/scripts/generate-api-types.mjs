import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

const frontendDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryDirectory = resolve(frontendDirectory, '..');
const outputPath = resolve(frontendDirectory, 'src/types/api.generated.ts');
const checkOnly = process.argv.includes('--check');

const codegenEnvironment = {
  PATH: process.env.PATH,
  ENV: 'test',
  ENABLE_E2E_TEST_AUTH: 'false',
  LOG_LEVEL: 'WARNING',
  METRICS_ENABLED: 'false',
  STORY_GENERATION_ENABLED_PROVIDERS: '[]',
  SECRET_KEY: 'codegen-secret-123456789012345678901234567890',
  ADMIN_SESSION_SECRET: 'codegen-admin-secret-123456789012345678901234567890',
  GOOGLE_CLIENT_ID: 'codegen-client-id',
  GOOGLE_CLIENT_SECRET: 'codegen-client-secret',
  CHATGPT_LINK_ENCRYPTION_KEYS:
    '["kkx-ZViSkteSQGh9z5FDskkiQGFImdcA1ceQt2DnwAk="]',
  PROVIDER_CREDENTIAL_ENCRYPTION_KEYS:
    '["kkx-ZViSkteSQGh9z5FDskkiQGFImdcA1ceQt2DnwAk="]',
  OPENROUTER_API_KEY: 'codegen-openrouter-key',
};

function exportOpenApi() {
  return new Promise((resolvePromise, reject) => {
    const process = spawn(
      'uv',
      [
        'run',
        '--locked',
        '--no-dev',
        '--directory',
        resolve(repositoryDirectory, 'backend'),
        'python',
        '-c',
        'import json; from flyt.main import app; print(json.dumps(app.openapi()))',
      ],
      { cwd: repositoryDirectory, env: codegenEnvironment },
    );
    let output = '';
    let error = '';

    process.stdout.on('data', (chunk) => {
      output += chunk;
    });
    process.stderr.on('data', (chunk) => {
      error += chunk;
    });
    process.on('error', reject);
    process.on('close', (code) => {
      if (code === 0) {
        resolvePromise(output);
        return;
      }
      reject(new Error(error || `OpenAPI export exited with code ${code}`));
    });
  });
}

const schema = JSON.parse(await exportOpenApi());
const source = `${COMMENT_HEADER}${astToString(await openapiTS(schema))}`;

if (checkOnly) {
  const current = await readFile(outputPath, 'utf8');
  if (current !== source) {
    throw new Error(`${outputPath} is stale; run pnpm api:types`);
  }
} else {
  await writeFile(outputPath, source);
}
