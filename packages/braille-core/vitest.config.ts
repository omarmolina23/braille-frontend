import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // RNF-10: el núcleo Braille no baja de 80 %; la meta real es cercana al 100 %.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
