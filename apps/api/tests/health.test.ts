import { describe, expect, it } from 'bun:test'
import {
  HealthService,
  type HealthProbes,
  type HealthReport,
} from '../src/modules/health/health.service'
import { createApp } from '../src/app'

const up = async () => {}
const down = async () => {
  throw new Error('connection refused')
}
const hang = () => new Promise<void>(() => {})

const service = (probes: Partial<HealthProbes>, timeoutMs?: number) =>
  new HealthService({ database: up, cache: up, ...probes }, 'test', timeoutMs)

describe('HealthService', () => {
  it('reports ok when all probes succeed', async () => {
    const report = await service({}).report()
    expect(report).toEqual({
      status: 'ok',
      version: 'test',
      dependencies: { database: 'up', cache: 'up' },
    })
  })

  it('reports degraded and names the failing dependency', async () => {
    const report = await service({ cache: down }).report()
    expect(report.status).toBe('degraded')
    expect(report.dependencies.cache).toBe('down')
    expect(report.dependencies.database).toBe('up')
  })

  it('treats a hanging probe as down after the timeout', async () => {
    const report = await service({ database: hang }, 20).report()
    expect(report.status).toBe('degraded')
    expect(report.dependencies.database).toBe('down')
  })
})

describe('GET /health', () => {
  it('returns 200 with the report when everything is up', async () => {
    const app = createApp({ healthService: service({}) })
    const response = await app.handle(new Request('http://localhost/health'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as HealthReport
    expect(body.status).toBe('ok')
  })

  it('returns 503 when a dependency is down', async () => {
    const app = createApp({ healthService: service({ database: down }) })
    const response = await app.handle(new Request('http://localhost/health'))
    expect(response.status).toBe(503)
    const body = (await response.json()) as HealthReport
    expect(body.dependencies.database).toBe('down')
  })
})
