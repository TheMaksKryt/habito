import { defineConfig, devices } from '@playwright/test'

// Ручной полный прогон UI поверх поднятого `bun dev` (api + web + хранилища).
// В CI не запускается: критических пользовательских потоков пока нет
// (конституция, Принцип VII) — e2e появятся вместе с первым таким потоком.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
