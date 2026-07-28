export interface AppConfig {
  databaseUrl: string
  redisUrl: string
  apiPort: number
  appVersion: string
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL
  const redisUrl = env.REDIS_URL

  const missing: string[] = []
  if (!databaseUrl) missing.push('DATABASE_URL')
  if (!redisUrl) missing.push('REDIS_URL')

  if (!databaseUrl || !redisUrl) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
        'Copy .env.example at the repository root to .env and fill in the values:\n' +
        '  cp .env.example .env',
    )
  }

  return {
    databaseUrl,
    redisUrl,
    apiPort: Number(env.API_PORT ?? 3333),
    appVersion: env.APP_VERSION ?? 'dev',
  }
}
