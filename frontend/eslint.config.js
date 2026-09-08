import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import testingLibrary from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'storybook-static',
      'src/types/api.generated.ts',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Tailwind preflight strips list-style, so Safari/VoiceOver drops list
      // semantics from bare ul/ol. Require an explicit role.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXOpeningElement[name.name='ul']:not(:has(JSXAttribute[name.name='role']))",
          message:
            'Add role="list" — Tailwind preflight removes list-style and Safari/VoiceOver then drops list semantics (use role="none" for purely presentational lists).',
        },
        {
          selector:
            "JSXOpeningElement[name.name='ol']:not(:has(JSXAttribute[name.name='role']))",
          message:
            'Add role="list" — Tailwind preflight removes list-style and Safari/VoiceOver then drops list semantics (use role="none" for purely presentational lists).',
        },
      ],
    },
  },
  {
    files: ['src/_*.tsx', 'src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['.storybook/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react']],
    rules: {
      'testing-library/no-container': 'error',
      'testing-library/no-node-access': 'error',
    },
  },
);
