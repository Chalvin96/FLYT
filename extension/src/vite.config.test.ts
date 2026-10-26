import { resolve } from 'node:path';
import { loadConfigFromFile } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

const CONFIG_FILE = resolve('vite.config.ts');

afterEach(() => vi.unstubAllEnvs());

describe('browser build configuration', () => {
  it('test_build_given_firefox_browser_in_production_mode_expect_firefox_output', async () => {
    vi.stubEnv('FLYT_BROWSER', 'firefox');

    const result = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      CONFIG_FILE,
    );

    expect(result?.config.build?.outDir).toBe('dist/firefox');
  });

  it('test_build_given_no_browser_in_production_mode_expect_chrome_output', async () => {
    vi.stubEnv('FLYT_BROWSER', undefined);

    const result = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      CONFIG_FILE,
    );

    expect(result?.config.build?.outDir).toBe('dist/chrome');
  });

  it('test_build_given_unknown_browser_expect_configuration_rejected', async () => {
    vi.stubEnv('FLYT_BROWSER', 'safari');

    await expect(
      loadConfigFromFile({ command: 'build', mode: 'production' }, CONFIG_FILE),
    ).rejects.toThrow('Invalid FLYT_BROWSER: safari');
  });
});
