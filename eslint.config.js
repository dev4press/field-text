import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(globalIgnores(['dist/']), {
  files: ['**/*.ts'],
  extends: [js.configs.recommended, tseslint.configs.recommended],
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
