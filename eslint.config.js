// @ts-check
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '.claude/',
      'coverage/',
      'dist/',
      '_site/',
      'legacy/',
      '.astro/',
      'node_modules/',
      '.lighthouseci/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // CommonJS config files (lighthouserc.cjs, .size-limit.cjs) load their helpers with require().
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
);
