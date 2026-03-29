import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bumbledo/',
  root: '.',
  server: { open: true },
  test: {
    include: ['src/**/*.test.js']
  }
});
