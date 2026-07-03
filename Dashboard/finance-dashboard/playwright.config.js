import { defineConfig } from '@playwright/test';

// E2E del dashboard. La app es estática: se sirve con http.server y las
// llamadas a Supabase se interceptan con route mocks (ver e2e/dashboard.spec.js),
// así la suite es determinista y corre en CI sin credenciales.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  }
});
