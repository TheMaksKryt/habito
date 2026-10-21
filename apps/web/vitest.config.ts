import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Playwright-спеки живут отдельно и запускаются через `bun run test:e2e`
    exclude: ['e2e/**', '**/node_modules/**'],
    // Coverage как отчёт (bun run test:coverage): только наш код в app/ —
    // без include в отчёт попадают generated/api и служебные файлы Nuxt
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}'],
      reporter: ['text', 'lcov'],
    },
  },
})
