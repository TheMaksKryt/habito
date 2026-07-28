// Dev-оркестратор (по образцу `ranch dev`): одна команда поднимает зависимости
// и dev-серверы с hot-reload.
//
//   bun dev            — api + web (+ postgres + redis в Docker)
//   bun dev api        — только api (+ хранилища)
//   bun dev web        — только web
//   bun dev --no-test  — пропустить pre-flight тесты
//
// Порядок повторяет ranch: Docker → зависимости → pre-flight тесты →
// освобождение портов → хранилища → dev-серверы.
import { spawnSync, spawn } from 'bun'

const ROOT = new URL('..', import.meta.url).pathname

const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith('--'))
const noTest = args.includes('--no-test')

if (target && !['api', 'web'].includes(target)) {
  console.error(`Unknown target: ${target}. Use: bun dev [api|web]`)
  process.exit(1)
}

// Bun загружает .env только из cwd процесса, а dev-серверы работают в
// apps/* — переменные корневого .env пробрасываются явно
const loadRootEnv = async (): Promise<Record<string, string>> => {
  const env: Record<string, string> = {}
  try {
    const text = await Bun.file(`${ROOT}.env`).text()
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match?.[1] && match[2] !== undefined) env[match[1]] = match[2]
    }
  } catch {
    console.error('Нет .env в корне. Создайте его: cp .env.example .env')
    process.exit(1)
  }
  return env
}

const rootEnv = await loadRootEnv()
const childEnv = { ...process.env, ...rootEnv }

const run = (cmd: string[], opts: { quiet?: boolean } = {}) => {
  const result = spawnSync({
    cmd,
    cwd: ROOT,
    env: childEnv,
    stdout: opts.quiet ? 'pipe' : 'inherit',
    stderr: opts.quiet ? 'pipe' : 'inherit',
  })
  return result.exitCode
}

const capture = (cmd: string[]): string => {
  const result = spawnSync({ cmd, cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
  return result.stdout.toString().trim()
}

const step = (message: string) => console.log(`\n▸ ${message}`)

// 1. Docker должен работать (хранилища живут в контейнерах)
const needsStores = !target || target === 'api'
if (needsStores && run(['docker', 'info'], { quiet: true }) !== 0) {
  console.error('Docker не запущен. Запустите Docker Desktop и повторите.')
  process.exit(1)
}

// 2. Свежесть зависимостей: frozen-install быстрый и падает при рассинхроне lock-файла
step('Проверка зависимостей (bun install --frozen-lockfile)')
if (run(['bun', 'install', '--frozen-lockfile']) !== 0) {
  console.error('Зависимости не в порядке — см. вывод выше.')
  process.exit(1)
}

// 3. Pre-flight тесты — падаем быстро, до запуска серверов (как в ranch;
//    обход: bun dev --no-test)
if (!noTest) {
  step(target ? `Pre-flight тесты (${target})` : 'Pre-flight тесты (api + web)')
  const testCmd = target
    ? ['bun', 'run', '--filter', target, 'test']
    : ['bun', 'run', '--filter', '*', 'test']
  if (run(testCmd) !== 0) {
    console.error('Тесты красные — dev-серверы не стартуют. Обход: bun dev --no-test')
    process.exit(1)
  }
}

// 4. Освобождение портов — идемпотентный повторный запуск (ranch free-ports).
//    Порт, проброшенный контейнером, освобождается остановкой КОНТЕЙНЕРА:
//    kill по pid попал бы в port-proxy Docker Desktop и сломал бы его.
const ports = target === 'api' ? [3333] : target === 'web' ? [3000] : [3000, 3333]
step(`Освобождение портов: ${ports.join(', ')}`)
for (const port of ports) {
  const containers = capture(['docker', 'ps', '-q', '--filter', `publish=${port}`])
  if (containers) {
    for (const id of containers.split('\n')) run(['docker', 'stop', id], { quiet: true })
    console.log(`  порт ${port}: остановлен контейнер ${containers.replaceAll('\n', ', ')}`)
  }
  const pids = capture(['lsof', '-ti', `:${port}`])
  for (const pid of pids ? pids.split('\n') : []) {
    const name = capture(['ps', '-p', pid, '-o', 'comm='])
    if (name.toLowerCase().includes('docker')) continue
    run(['kill', '-9', pid], { quiet: true })
    console.log(`  порт ${port}: kill ${pid} (${name})`)
  }
}

// 5. Хранилища + ожидание готовности (healthcheck'и описаны в docker-compose.yml)
if (needsStores) {
  step('PostgreSQL + Redis (docker compose up -d --wait)')
  if (run(['docker', 'compose', 'up', '-d', '--wait', 'postgres', 'redis']) !== 0) {
    console.error('Хранилища не поднялись — см. вывод выше.')
    process.exit(1)
  }
}

// 6. Актуальный SDK перед стартом web (contract-first цепочка)
if (!target || target === 'web') {
  step('Генерация SDK из OpenAPI (gen:api)')
  if (run(['bun', 'run', 'gen:api']) !== 0) process.exit(1)
}

// 7. Dev-серверы с hot-reload; bun run --filter запускает их параллельно
//    с префиксованным выводом
step(target ? `Dev-сервер: ${target}` : 'Dev-серверы: api (:3333) + web (:3000)')
const devCmd = target
  ? ['bun', 'run', '--filter', target, 'dev']
  : ['bun', 'run', '--filter', '*', 'dev']

const server = spawn({
  cmd: devCmd,
  cwd: ROOT,
  env: childEnv,
  stdout: 'inherit',
  stderr: 'inherit',
})
process.on('SIGINT', () => server.kill('SIGINT'))
process.exit(await server.exited)
