import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(projectRoot, 'src/bundle.ts'),
      name: 'FieldText',
      fileName: 'fieldtext',
      cssFileName: 'fieldtext',
      formats: ['es', 'umd'],
    },
  },
});
