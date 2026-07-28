import { defineConfig } from '@hey-api/openapi-ts'

// SDK генерируется из OpenAPI-документа api (contract-first, Принцип III).
// Документ создаётся командой `bun run --filter api openapi:export`
// (или целиком: `bun run gen:api` в корне).
// baseURL клиента задаётся в app/plugins/api.ts (не через runtimeConfigPath —
// см. комментарий в плагине).
export default defineConfig({
  input: '../api/openapi.json',
  output: 'generated/api',
  plugins: ['@hey-api/client-nuxt'],
})
