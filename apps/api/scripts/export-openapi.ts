// Экспорт OpenAPI-документа без запуска сервера (app.handle) — используется
// генерацией SDK в apps/web и сборкой её Docker-образа (паттерн ranch)
import { createApp } from '../src/app'
import { HealthService } from '../src/modules/health/health.service'

const noop = async () => {}

const app = createApp({
  healthService: new HealthService({ database: noop, cache: noop }, 'openapi-export'),
})

const response = await app.handle(new Request('http://localhost/openapi/json'))

if (!response.ok) {
  console.error(`Failed to export OpenAPI document: HTTP ${response.status}`)
  process.exit(1)
}

const spec = await response.json()
const target = new URL('../openapi.json', import.meta.url)
await Bun.write(target, `${JSON.stringify(spec, null, 2)}\n`)

console.log(`OpenAPI document exported to ${target.pathname}`)
