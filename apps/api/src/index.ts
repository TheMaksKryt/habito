import { Redis } from 'ioredis'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { loadConfig } from './config'
import { createApp } from './app'
import { HealthService, type HealthProbes } from './modules/health/health.service'

const config = loadConfig()

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
})

// enableOfflineQueue: false + maxRetriesPerRequest: 0 — probe при недоступном
// Redis падает сразу, а не копит команды в очереди; реконнект ioredis делает сам.
// Без lazyConnect: соединение стартует при загрузке процесса, иначе первый же
// health-запрос инициировал бы коннект и ложно отчитался «cache: down»
const redis = new Redis(config.redisUrl, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
})
redis.on('error', () => {
  // без подписчика ioredis бросает unhandled error при недоступном Redis;
  // сам статус фиксируется health-probe
})

const probes: HealthProbes = {
  database: async () => {
    await prisma.$queryRaw`SELECT 1`
  },
  cache: async () => {
    await redis.ping()
  },
}

const app = createApp({
  healthService: new HealthService(probes, config.appVersion),
})

app.listen(config.apiPort)

console.log(`Habito API listening on http://localhost:${config.apiPort}`)
