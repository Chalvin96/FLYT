import shadowRootProperties from '@flyt/ui/postcss/shadow-root-properties';
import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import type { Plugin } from 'postcss';

function extensionShadowRootProperties(): Plugin {
  const extensionPlugin = shadowRootProperties();

  return {
    postcssPlugin: 'storybook-extension-shadow-root-properties',
    OnceExit(root, helpers) {
      const source = helpers.result.opts.from ?? root.source?.input.file;
      const normalizedSource = source?.replaceAll('\\', '/');

      if (!normalizedSource?.includes('/extension/tailwind/index.css')) return;

      return extensionPlugin.OnceExit?.(root, helpers);
    },
  };
}

const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/lexicon/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../extension/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
  async viteFinal(config) {
    return {
      ...config,
      css: {
        postcss: {
          plugins: [
            tailwindcss(),
            autoprefixer(),
            extensionShadowRootProperties(),
          ],
        },
      },
    };
  },
};
export default config;
