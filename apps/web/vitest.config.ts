import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Playwright-спеки живут отдельно и запускаются через `bun run test:e2e`
    exclude: ['e2e/**', '**/node_modules/**'],
  },
})
