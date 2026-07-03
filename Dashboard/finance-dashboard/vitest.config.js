import { defineConfig } from 'vitest/config';

// Vitest sólo corre los tests unitarios; los E2E (e2e/*.spec.js) son de Playwright.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js']
  }
});
