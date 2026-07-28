import { defineConfig } from 'prisma/config'

// Prisma 7 не автозагружает .env и требует URL уже на этапе `prisma generate`,
// хотя generate к базе не подключается. Placeholder позволяет генерировать клиент
// в чистом окружении (CI, Docker build); реальные команды (migrate) получают
// настоящий DATABASE_URL из окружения и с placeholder'ом просто не соединятся.
const PLACEHOLDER_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? PLACEHOLDER_URL,
  },
})
