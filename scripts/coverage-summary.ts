// Сводка покрытия по workspace'ам из lcov-файлов (apps/*/coverage/lcov.info)
// в Markdown. Используется локально (`bun run test:coverage`) и в CI —
// вывод дописывается в $GITHUB_STEP_SUMMARY. Порога нет: это отчёт, не гейт
// (PRD quality-gates-parity, «What We're NOT Building»).
//
//   bun scripts/coverage-summary.ts          — таблица в stdout
//   bun run test:coverage                    — тесты с coverage + таблица
import { fileURLToPath } from 'node:url'
import { parseLcov, summarize, toMarkdown, type CoverageSummary } from './lib/lcov'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WORKSPACES = ['api', 'web'] as const

const rows: Array<{ name: string; summary: CoverageSummary }> = []
for (const name of WORKSPACES) {
  const file = Bun.file(`${ROOT}apps/${name}/coverage/lcov.info`)
  if (!(await file.exists())) {
    console.error(
      `coverage: apps/${name}/coverage/lcov.info не найден — запустите bun run test:coverage`,
    )
    continue
  }
  rows.push({ name, summary: summarize(parseLcov(await file.text())) })
}

if (rows.length === 0) process.exit(1)
console.log('## Coverage\n')
console.log(toMarkdown(rows))
