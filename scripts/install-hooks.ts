// Установка git-хуков Lefthook из `bun install` (root postinstall).
//
// Почему свой скрипт, а не postinstall пакета lefthook: Bun не исполняет
// lifecycle-скрипты зависимостей (allow-list trustedDependencies), а
// root-скрипты проекта исполняет всегда — в том числе при --frozen-lockfile.
//
// Пропуск (тихий, exit 0):
//   CI=true            — на раннере хуки не нужны (lefthook сам так делает)
//   LEFTHOOK=0         — пользователь отключил lefthook
//   не git-репозиторий — Docker-сборка (там и так --ignore-scripts), архив
import { spawnSync } from 'bun'
import { fileURLToPath } from 'node:url'

// fileURLToPath, а не URL.pathname: на Windows pathname даёт «/E:/…», и
// spawnSync с таким cwd падает ENOENT (на команду, а не на каталог — сбивает с толку)
const ROOT = fileURLToPath(new URL('..', import.meta.url))

const enabled = (value: string | undefined) =>
  value !== undefined && value !== '' && value !== '0' && value !== 'false'

const run = (cmd: string[], opts: { quiet?: boolean } = {}) =>
  spawnSync({
    cmd,
    cwd: ROOT,
    stdout: opts.quiet ? 'pipe' : 'inherit',
    stderr: opts.quiet ? 'pipe' : 'inherit',
  }).exitCode

if (enabled(process.env.CI) || process.env.LEFTHOOK === '0') {
  process.exit(0)
}
if (run(['git', 'rev-parse', '--git-dir'], { quiet: true }) !== 0) {
  process.exit(0)
}

console.log('\n▸ Установка git-хуков (lefthook install)')
if (run(['bunx', 'lefthook', 'install']) !== 0) {
  // Не валим bun install: без хуков работать можно, CI всё равно проверит
  console.warn('lefthook install не удался — выполните `bun run hooks` вручную.')
}
