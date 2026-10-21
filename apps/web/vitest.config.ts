import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Coverage как отчёт (bun run test:coverage): только наш код в app/ —
    // без include в отчёт попадают generated/api и служебные файлы Nuxt
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}'],
      reporter: ['text', 'lcov'],
    },
  },
})
