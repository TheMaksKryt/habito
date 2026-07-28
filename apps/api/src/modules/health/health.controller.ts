import { Elysia, t } from 'elysia'
import type { HealthService } from './health.service'

const dependencyStatus = t.Union([t.Literal('up'), t.Literal('down')])

const healthReportSchema = t.Object({
  status: t.Union([t.Literal('ok'), t.Literal('degraded')]),
  version: t.String(),
  dependencies: t.Object({
    database: dependencyStatus,
    cache: dependencyStatus,
  }),
})

export const createHealthController = (healthService: HealthService) =>
  new Elysia({ name: 'health' }).get(
    '/health',
    async ({ set }) => {
      const report = await healthService.report()
      // 503 при degraded — чтобы healthcheck-механизмы (Compose/k8s) различали
      // состояния по статусу, не разбирая тело (data-model.md)
      set.status = report.status === 'ok' ? 200 : 503
      return report
    },
    {
      response: { 200: healthReportSchema, 503: healthReportSchema },
      detail: {
        operationId: 'getHealth',
        tags: ['health'],
        summary: 'Состояние API и его зависимостей',
      },
    },
  )
