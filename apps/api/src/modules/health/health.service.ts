export type DependencyStatus = 'up' | 'down'

export interface HealthReport {
  status: 'ok' | 'degraded'
  version: string
  dependencies: {
    database: DependencyStatus
    cache: DependencyStatus
  }
}

export interface HealthProbes {
  database: () => Promise<void>
  cache: () => Promise<void>
}

// Таймаут держит health-ответ быстрым даже при зависшем соединении (SC-003)
const DEFAULT_PROBE_TIMEOUT_MS = 2000

export class HealthService {
  constructor(
    private readonly probes: HealthProbes,
    private readonly version: string,
    private readonly timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
  ) {}

  async report(): Promise<HealthReport> {
    const [database, cache] = await Promise.all([
      this.check(this.probes.database),
      this.check(this.probes.cache),
    ])

    return {
      status: database === 'up' && cache === 'up' ? 'ok' : 'degraded',
      version: this.version,
      dependencies: { database, cache },
    }
  }

  private async check(probe: () => Promise<void>): Promise<DependencyStatus> {
    try {
      await this.withTimeout(probe())
      return 'up'
    } catch {
      return 'down'
    }
  }

  private withTimeout(promise: Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('probe timeout')), this.timeoutMs)
      promise.then(
        () => {
          clearTimeout(timer)
          resolve()
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error instanceof Error ? error : new Error(String(error)))
        },
      )
    })
  }
}
