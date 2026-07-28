import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { createHealthController } from './modules/health/health.controller'
import type { HealthService } from './modules/health/health.service'

export interface AppDeps {
  healthService: HealthService
}

// createApp отделён от listen (src/index.ts): один и тот же граф используется
// сервером, тестами (app.handle) и экспортом OpenAPI без открытия порта
export const createApp = ({ healthService }: AppDeps) =>
  new Elysia()
    .use(
      openapi({
        documentation: {
          info: { title: 'Habito API', version: '0.1.0' },
        },
      }),
    )
    .onError(({ code, error, set }) => {
      if (code === 'NOT_FOUND') set.status = 404
      else if (code === 'VALIDATION') set.status = 422
      else set.status = 500
      return {
        error: {
          code: String(code),
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    })
    .use(createHealthController(healthService))
