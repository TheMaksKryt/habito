import { defineConfig, devices } from '@playwright/test'

// Полный прогон UI поверх поднятого стека (`bun dev` или `docker compose up`).
// В CI — job e2e при изменениях UI (фильтр путей в .github/workflows/ci.yaml),
// не required check. Новые спеки — вместе с первым критическим потоком
// (конституция, Принцип VII).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // CI: аннотации в PR + html-отчёт для артефакта; один worker и один retry —
  // стабильность на раннере важнее скорости одного спека
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
