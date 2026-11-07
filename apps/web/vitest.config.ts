import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pruebas de interfaz: jsdom no calcula diseño, así que tamaños y contraste se revisan a mano.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.tsx'],
  },
});
