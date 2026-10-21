# Plan: Quality Gates Parity — Phase 5 (Coverage report)

## Summary

Добавить coverage как отчёт без порога: `bun test --coverage` для api и Vitest
`--coverage` (провайдер v8) для web пишут `lcov.info`; единый скрипт
`scripts/coverage-summary.ts` сводит оба lcov в Markdown-таблицу, которую CI
дописывает в job summary. Парсер lcov — чистая функция с unit-тестом на
`bun:test` (учебный образец теста на простом интерфейсе, Принцип VII).
Команда `bun run test:coverage` работает и локально.

## User Story

As a разработчик, новичок в тестировании,
I want видеть на каждом PR проценты покрытия api и web и иметь простой пример
unit-теста чистой функции,
So that понимать, что уже покрыто, и учиться писать тесты на понятном коде.

## Problem → Solution

Покрытие не измеряется; тесты есть, но «сколько кода они трогают» неизвестно;
примера unit-теста на plain-функции в репо нет (есть только сервис + HTTP). →
Два lcov → один парсер → таблица в summary CI и в терминале; парсер покрыт
тестом; порога нет (домен-логики ещё нет — PRD «What We're NOT Building»).

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/quality-gates-parity.prd.md`
- **PRD Phase**: 5 — Coverage report
- **Estimated Files**: 9 (3 CREATE в `scripts/`, 1 CREATE `apps/api/bunfig.toml`, UPDATE: `apps/web/vitest.config.ts`, `apps/web/package.json`, `apps/api/package.json`, `package.json`, `.github/workflows/ci.yaml`, `CLAUDE.md`) + `bun.lock`

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────┐
│ CI: quality ✔ — и всё. Сколько кода покрыто — неизвестно.    │
│ Локально: bun test --coverage руками, только api            │
└──────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────┐
│ bun run test:coverage                                        │
│                                                              │
│ ## Coverage                                                  │
│ | Workspace | Lines        | Functions   | Files |           │
│ | --------- | ------------ | ----------- | ----- |           │
│ | api       | 87.0% (20/23)| 83.3% (5/6) | 3     |           │
│ | web       | 61.5% (8/13) | 50.0% (1/2) | 4     |           │
│                                                              │
│ CI → та же таблица в Job Summary у job quality               │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint          | Before                | After                                        | Notes                                  |
| ------------------- | --------------------- | -------------------------------------------- | -------------------------------------- |
| `bun run test`      | тесты                 | без изменений (+ `bun test scripts`)         | coverage не замедляет обычный прогон   |
| `bun run test:coverage` | —                 | api + web с coverage, затем таблица          | новая команда                          |
| CI job `quality`    | Install, Check        | + Coverage (report-only, `continue-on-error`) | summary в PR → Checks → quality       |
| `coverage/`         | —                     | `apps/*/coverage/` (gitignored)              | уже в `.gitignore`/`.prettierignore`/eslint ignores |

---

## Mandatory Reading

| Priority       | File                           | Lines   | Why                                                                               |
| -------------- | ------------------------------ | ------- | --------------------------------------------------------------------------------- |
| P0 (critical)  | `scripts/install-hooks.ts`     | all     | свежий образец скрипта: шапка-комментарий, `fileURLToPath`, стиль                |
| P0 (critical)  | `apps/api/tests/health.test.ts`| 1-40    | стиль тестов `bun:test`: `describe/it/expect`, хелперы-стрелки, `toEqual`         |
| P1 (important) | `apps/web/vitest.config.ts`    | all     | `defineVitestConfig` из `@nuxt/test-utils/config` — сюда `coverage`               |
| P1 (important) | `package.json`                 | 9-20    | скрипты корня; `test` расширяется                                                 |
| P1 (important) | `.github/workflows/ci.yaml`    | job `quality` | куда добавить шаг Coverage                                                   |
| P1 (important) | `CLAUDE.md`                    | 8-43    | «Команды» и таблица «Проверки»                                                    |
| P2 (reference) | `scripts/dev.ts`               | 44-60   | `run`/`capture`/`step` хелперы                                                    |

## External Documentation

| Topic                         | Source                                  | Key Takeaway                                                                                                   |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| bun test coverage             | bun.com/docs/test/coverage              | `--coverage`, `--coverage-reporter=text\|lcov` (повторяемый), `--coverage-dir`; bunfig `[test]`: `coverageReporter`, `coverageDir`, `coverageSkipTestFiles` (default true), `coveragePathIgnorePatterns`; порог — `coverageThreshold` (не ставим) |
| Vitest coverage               | vitest.dev/guide/coverage, /config/coverage | провайдер v8 через `@vitest/coverage-v8` **той же версии, что vitest**; `--coverage` в CLI; `coverage.include` относительно корня проекта, без include — только импортированные файлы; `reporter: ['text','lcov']`; `reportsDirectory` default `./coverage` |
| Проба (2026-10-21)            | локально, vitest 4.1.10 + coverage-v8 4.1.10 | под `environment: nuxt` coverage работает; без `include` в отчёт попадают `generated/api/*` и Nuxt-служебные файлы → нужен `include: ['app/**']` |
| lcov-формат обоих раннеров    | локально                                | bun и Vitest пишут `SF`, `LF/LH`, `FNF/FNH`, `end_of_record`; bun на Windows — `SF:src\app.ts` (бэкслеши) |
| GitHub job summary            | docs.github.com → workflow commands     | `echo "…" >> "$GITHUB_STEP_SUMMARY"`, GFM-таблицы рендерятся, лимит 1 MiB на шаг                               |

---

## Patterns to Mirror

### NAMING_CONVENTION

```ts
// SOURCE: scripts/install-hooks.ts:1-10 — шапка: что делает, почему так, какие пропуски
// Установка git-хуков Lefthook из `bun install` (root postinstall).
//
// Почему свой скрипт, а не postinstall пакета lefthook: …
```

### ERROR_HANDLING

```ts
// SOURCE: scripts/install-hooks.ts:28-33 — мягкие пропуски через exit 0; жёсткие ошибки — console.error + exit 1 (dev.ts:71-74)
if (enabled(process.env.CI) || process.env.LEFTHOOK === '0') {
  process.exit(0)
}
```

### LOGGING_PATTERN

```ts
// SOURCE: scripts/dev.ts:60
const step = (message: string) => console.log(`\n▸ ${message}`)
```

### PATH_PATTERN

```ts
// SOURCE: scripts/install-hooks.ts:11-16 — fileURLToPath, не URL.pathname (Windows)
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
```

### TEST_STRUCTURE

```ts
// SOURCE: apps/api/tests/health.test.ts:1-30 — bun:test, хелперы-стрелки, describe/it, toEqual на целом объекте
import { describe, expect, it } from 'bun:test'

const up = async () => {}
const down = async () => {
  throw new Error('connection refused')
}

describe('HealthService', () => {
  it('reports ok when all probes succeed', async () => {
    const report = await service({}).report()
    expect(report).toEqual({
      status: 'ok',
      version: 'test',
      dependencies: { database: 'up', cache: 'up' },
    })
  })
```

### SCRIPT_COMPOSITION

```jsonc
// SOURCE: package.json:16 — композиция по workspace'ам
"test": "bun run --filter '*' test",
```

### CI_STEP_PATTERN

```yaml
# SOURCE: .github/workflows/ci.yaml — именованные шаги, однострочный run
- name: Check (same command as local `bun run check`)
  run: bun run check
```

---

## Files to Change

| File                           | Action | Justification                                                              |
| ------------------------------ | ------ | -------------------------------------------------------------------------- |
| `scripts/lib/lcov.ts`          | CREATE | чистые функции: `parseLcov(text)`, `summarize(records)`, `toMarkdown(rows)` |
| `scripts/lib/lcov.test.ts`     | CREATE | unit-тесты парсера и форматтера (`bun:test`)                               |
| `scripts/coverage-summary.ts`  | CREATE | CLI: читает `apps/*/coverage/lcov.info`, печатает Markdown                 |
| `apps/api/bunfig.toml`         | CREATE | `[test] coverageReporter = ["text", "lcov"]` — один источник настроек       |
| `apps/api/package.json`        | UPDATE | `test:coverage: bun test --coverage`                                       |
| `apps/web/vitest.config.ts`    | UPDATE | `coverage: { provider: 'v8', include: ['app/**'], reporter: ['text','lcov'] }` |
| `apps/web/package.json`        | UPDATE | devDep `@vitest/coverage-v8` = версии vitest; `test:coverage: vitest run --coverage` |
| `package.json`                 | UPDATE | `test` += `&& bun test scripts`; `test:coverage` = по workspace'ам + summary |
| `bun.lock`                     | UPDATE | результат `bun add`                                                        |
| `.github/workflows/ci.yaml`    | UPDATE | шаг Coverage после Check, `continue-on-error: true`, запись в summary      |
| `CLAUDE.md`                    | UPDATE | команда и строка в «Проверки»                                              |

## NOT Building

- Порог покрытия (`coverageThreshold`, `coverage.thresholds`) — PRD: порог после появления домен-логики.
- Загрузка lcov как артефакта и внешние action'ы для coverage-комментариев в PR — лишняя зависимость; summary достаточно.
- Coverage внутри `bun run check` / pre-push — удваивает время тестов, отчёт не гейт.
- Branch coverage в таблице — bun не пишет `BRF/BRH`; показываем lines и functions.
- Phase 4 (e2e в CI) — ждёт мерж PR #7.

---

## Step-by-Step Tasks

### Task 1: `scripts/lib/lcov.ts` — чистые функции

- **ACTION**: создать модуль без побочных эффектов.
- **IMPLEMENT**:
  ```ts
  // Парсер lcov и сводка покрытия. Чистые функции без I/O — тестируются напрямом
  // (scripts/lib/lcov.test.ts). Оба раннера (bun test, Vitest v8) пишут одинаковые
  // ключи: SF (файл), LF/LH (строки всего/покрыто), FNF/FNH (функции), end_of_record.
  // Branch-метрик нет: bun их не пишет.

  export type LcovRecord = {
    file: string
    linesFound: number
    linesHit: number
    functionsFound: number
    functionsHit: number
  }

  export type CoverageSummary = {
    files: number
    linesFound: number
    linesHit: number
    functionsFound: number
    functionsHit: number
  }

  const EMPTY = (): LcovRecord => ({
    file: '',
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
  })

  // SF у bun на Windows с бэкслешами — нормализуем, чтобы отчёт был одинаков на всех ОС
  const normalizePath = (p: string) => p.replace(/\\/g, '/')

  export const parseLcov = (text: string): LcovRecord[] => {
    const records: LcovRecord[] = []
    let current = EMPTY()
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim()
      if (line === 'end_of_record') {
        if (current.file) records.push(current)
        current = EMPTY()
        continue
      }
      const sep = line.indexOf(':')
      if (sep === -1) continue
      const key = line.slice(0, sep)
      const value = line.slice(sep + 1)
      if (key === 'SF') current.file = normalizePath(value)
      else if (key === 'LF') current.linesFound = Number(value)
      else if (key === 'LH') current.linesHit = Number(value)
      else if (key === 'FNF') current.functionsFound = Number(value)
      else if (key === 'FNH') current.functionsHit = Number(value)
    }
    return records
  }

  export const summarize = (records: LcovRecord[]): CoverageSummary =>
    records.reduce(
      (acc, r) => ({
        files: acc.files + 1,
        linesFound: acc.linesFound + r.linesFound,
        linesHit: acc.linesHit + r.linesHit,
        functionsFound: acc.functionsFound + r.functionsFound,
        functionsHit: acc.functionsHit + r.functionsHit,
      }),
      { files: 0, linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
    )

  // 0/0 — «нет данных», показываем «—», а не 100%
  export const percent = (hit: number, found: number): string =>
    found === 0 ? '—' : `${((hit / found) * 100).toFixed(1)}%`

  export const toMarkdown = (rows: Array<{ name: string; summary: CoverageSummary }>): string => {
    const header = [
      '| Workspace | Lines | Functions | Files |',
      '| --------- | ----- | --------- | ----- |',
    ]
    const body = rows.map(({ name, summary: s }) =>
      `| ${name} | ${percent(s.linesHit, s.linesFound)} (${s.linesHit}/${s.linesFound}) | ${percent(s.functionsHit, s.functionsFound)} (${s.functionsHit}/${s.functionsFound}) | ${s.files} |`,
    )
    return [...header, ...body].join('\n')
  }
  ```
- **MIRROR**: NAMING_CONVENTION (шапка «что/почему»), стиль стрелочных функций как в dev.ts.
- **IMPORTS**: нет (чистый модуль).
- **GOTCHA**: `split(/\r?\n/)` — lcov может прийти с CRLF из старого checkout; `Number('')` = 0 — допустимо. Не использовать `Bun.file` здесь: модуль должен тестироваться без диска.
- **VALIDATE**: `bunx eslint scripts/lib/lcov.ts && bunx tsc --noEmit -p tsconfig.json` (корневой tsconfig покрывает `scripts/`? — проверить `tsconfig.json` `include`; если нет, `bunx tsc --noEmit scripts/lib/lcov.ts --strict --target esnext --moduleResolution bundler`).

### Task 2: `scripts/lib/lcov.test.ts`

- **ACTION**: unit-тесты (учебный образец: таблица входов → ожиданий).
- **IMPLEMENT**:
  ```ts
  import { describe, expect, it } from 'bun:test'
  import { parseLcov, percent, summarize, toMarkdown } from './lcov'

  const sample = [
    'TN:',
    'SF:src\\app.ts',
    'FNF:2',
    'FNH:1',
    'DA:1,3',
    'LF:10',
    'LH:6',
    'end_of_record',
    'SF:app/pages/index.vue',
    'FNF:1',
    'FNH:1',
    'BRF:4',
    'BRH:2',
    'LF:5',
    'LH:5',
    'end_of_record',
  ].join('\n')

  describe('parseLcov', () => {
    it('reads one record per end_of_record and normalizes Windows paths', () => {
      expect(parseLcov(sample)).toEqual([
        { file: 'src/app.ts', linesFound: 10, linesHit: 6, functionsFound: 2, functionsHit: 1 },
        { file: 'app/pages/index.vue', linesFound: 5, linesHit: 5, functionsFound: 1, functionsHit: 1 },
      ])
    })

    it('ignores unknown keys, CRLF and records without SF', () => {
      expect(parseLcov('BRF:1\r\nend_of_record\r\nSF:a.ts\r\nLF:1\r\nLH:1\r\nend_of_record\r\n')).toEqual([
        { file: 'a.ts', linesFound: 1, linesHit: 1, functionsFound: 0, functionsHit: 0 },
      ])
    })

    it('returns [] for empty input', () => {
      expect(parseLcov('')).toEqual([])
    })
  })

  describe('summarize', () => {
    it('sums lines and functions across files', () => {
      expect(summarize(parseLcov(sample))).toEqual({
        files: 2,
        linesFound: 15,
        linesHit: 11,
        functionsFound: 3,
        functionsHit: 2,
      })
    })
  })

  describe('percent', () => {
    it.each([
      [11, 15, '73.3%'],
      [5, 5, '100.0%'],
      [0, 0, '—'],
    ])('percent(%i, %i) → %s', (hit, found, expected) => {
      expect(percent(hit, found)).toBe(expected)
    })
  })

  describe('toMarkdown', () => {
    it('renders a GFM table with one row per workspace', () => {
      const md = toMarkdown([{ name: 'api', summary: summarize(parseLcov(sample)) }])
      expect(md.split('\n')).toEqual([
        '| Workspace | Lines | Functions | Files |',
        '| --------- | ----- | --------- | ----- |',
        '| api | 73.3% (11/15) | 66.7% (2/3) | 2 |',
      ])
    })
  })
  ```
- **MIRROR**: TEST_STRUCTURE (`describe/it/expect`, `toEqual` на целых объектах); `it.each` — табличный стиль для чистых функций.
- **IMPORTS**: `bun:test`, `./lcov`.
- **GOTCHA**: файл рядом с модулем, не в `tests/` — для `scripts/` это первый тест, конвенция «тест рядом с plain-функцией». Запуск — `bun test scripts` из корня (см. Task 6).
- **VALIDATE**: `bun test scripts` → 7 pass.

### Task 3: `scripts/coverage-summary.ts` — CLI

- **ACTION**: собрать таблицу из `apps/*/coverage/lcov.info`.
- **IMPLEMENT**:
  ```ts
  // Сводка покрытия по workspace'ам из lcov-файлов (apps/*/coverage/lcov.info)
  // в Markdown. Используется локально (`bun run test:coverage`) и в CI —
  // вывод дописывается в $GITHUB_STEP_SUMMARY. Порога нет: это отчёт, не гейт
  // (PRD quality-gates-parity, «What We're NOT Building»).
  //
  //   bun scripts/coverage-summary.ts          — таблица в stdout
  //   bun run test:coverage                    — тесты с coverage + таблица
  import { fileURLToPath } from 'node:url'
  import { parseLcov, summarize, toMarkdown } from './lib/lcov'

  const ROOT = fileURLToPath(new URL('..', import.meta.url))
  const WORKSPACES = ['api', 'web'] as const

  const rows = []
  for (const name of WORKSPACES) {
    const file = Bun.file(`${ROOT}apps/${name}/coverage/lcov.info`)
    if (!(await file.exists())) {
      console.error(`coverage: apps/${name}/coverage/lcov.info не найден — запустите bun run test:coverage`)
      continue
    }
    rows.push({ name, summary: summarize(parseLcov(await file.text())) })
  }

  if (rows.length === 0) process.exit(1)
  console.log('## Coverage\n')
  console.log(toMarkdown(rows))
  ```
- **MIRROR**: PATH_PATTERN, ERROR_HANDLING (понятное сообщение в stderr; exit 1 только если нет ни одного файла).
- **IMPORTS**: `node:url`, `./lib/lcov`; `Bun.file` глобален.
- **GOTCHA**: `ROOT` заканчивается на разделитель (`new URL('..')` даёт `…/habito-gates/`), поэтому конкатенация без `/`. `console.error` не попадает в summary (туда идёт stdout).
- **VALIDATE**: после `bun run --filter '*' test:coverage` — `bun scripts/coverage-summary.ts` печатает таблицу с двумя строками.

### Task 4: api — bunfig + скрипт

- **ACTION**: `apps/api/bunfig.toml` (CREATE) и скрипт.
- **IMPLEMENT**:
  ```toml
  # Coverage как отчёт (Phase 5 quality-gates): text в терминал, lcov для сводки
  # scripts/coverage-summary.ts. Включается только флагом --coverage
  # (bun run test:coverage), обычный `bun test` не замедляется. Порога нет.
  [test]
  coverageReporter = ["text", "lcov"]
  coverageDir = "coverage"
  ```
  `apps/api/package.json` → `"test:coverage": "bun test --coverage"`.
- **MIRROR**: комментарии «что/почему» как в compose/ci.
- **GOTCHA**: `coverage = true` в bunfig НЕ ставить — включит coverage для каждого `bun test`. `coverageDir` относительно cwd workspace → `apps/api/coverage/` (уже gitignored).
- **VALIDATE**: `cd apps/api && bun run test:coverage && head -3 coverage/lcov.info` → `TN:`/`SF:`.

### Task 5: web — coverage-v8 + конфиг + скрипт

- **ACTION**: dev-зависимость и конфиг.
- **IMPLEMENT**:
  ```bash
  cd apps/web && V=$(bunx vitest --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+') && bun add -d "@vitest/coverage-v8@$V"
  ```
  `apps/web/vitest.config.ts`:
  ```ts
  import { defineVitestConfig } from '@nuxt/test-utils/config'

  export default defineVitestConfig({
    test: {
      environment: 'nuxt',
      // Coverage как отчёт (bun run test:coverage): только наш код в app/ —
      // без include в отчёт попадают generated/api и служебные файлы Nuxt
      coverage: {
        provider: 'v8',
        include: ['app/**'],
        reporter: ['text', 'lcov'],
      },
    },
  })
  ```
  `apps/web/package.json` → `"test:coverage": "vitest run --coverage"`.
- **MIRROR**: существующий `defineVitestConfig`, комментарий «почему».
- **GOTCHA**: версия `@vitest/coverage-v8` обязана совпадать с `vitest` (на этой ветке 4.1.10; после мержа PR #8 — 5.0.5, тогда `bun add -d @vitest/coverage-v8@5.0.5`). PR #7 тоже правит `vitest.config.ts` (добавляет `exclude: ['e2e/**', …]`) — при мерже объединить оба блока в `test`. `coverage.clean` по умолчанию чистит `coverage/` перед прогоном — ок.
- **VALIDATE**: `cd apps/web && bun run test:coverage` → таблица v8 только с файлами из `app/`; `coverage/lcov.info` существует.

### Task 6: корневые скрипты

- **ACTION**: обновить `package.json`.
- **IMPLEMENT**:
  ```json
  "test": "bun run --filter '*' test && bun test scripts",
  "test:coverage": "bun run --filter '*' test:coverage && bun scripts/coverage-summary.ts",
  ```
- **MIRROR**: SCRIPT_COMPOSITION.
- **GOTCHA**: `bun test scripts` из корня ищет `*.test.ts` только под `scripts/` — не заденет Vitest-тесты web. `check` автоматически получает тест парсера через `test`. Хук pre-push тоже.
- **VALIDATE**: `bun run test` → api 5, web 1, scripts 7; `bun run test:coverage` → таблица.

### Task 7: CI — шаг Coverage в job summary

- **ACTION**: добавить шаг после Check.
- **IMPLEMENT**:
  ```yaml
      - name: Coverage report (informational, no threshold)
        continue-on-error: true
        run: |
          bun run test:coverage > coverage.md
          bun scripts/coverage-summary.ts >> "$GITHUB_STEP_SUMMARY"
  ```
  Проще: первая команда уже печатает таблицу в конце, но вместе с логами тестов; во summary нужна только таблица → отдельный вызов скрипта.
  ```yaml
      - name: Coverage report (informational, no threshold)
        continue-on-error: true
        run: |
          bun run --filter '*' test:coverage
          bun scripts/coverage-summary.ts >> "$GITHUB_STEP_SUMMARY"
  ```
- **MIRROR**: CI_STEP_PATTERN; многострочный `run: |` допустим.
- **GOTCHA**: `continue-on-error: true` — отчёт не гейт; падение тестов уже поймал Check. Имя job `quality` не менять. На Linux `$GITHUB_STEP_SUMMARY` всегда задан.
- **VALIDATE**: после push — в PR → Checks → quality → Summary видна таблица с api и web.

### Task 8: CLAUDE.md

- **ACTION**: команда + строка таблицы.
- **IMPLEMENT**:
  1. «Команды», после `bunx lefthook run pre-commit …`:
     ```bash
     bun run test:coverage          # тесты с покрытием + таблица (в CI — в job summary, без порога)
     ```
  2. Таблица «Проверки», после строки `check`:
     ```markdown
     | coverage (lines/functions, api + web)       | `bun run test:coverage`; CI `quality` → Summary       | отчёт, не гейт; порог — после домен-логики |
     ```
- **MIRROR**: существующие строки таблицы.
- **GOTCHA**: `bunx prettier --write CLAUDE.md` для выравнивания таблицы.
- **VALIDATE**: `bunx prettier --check CLAUDE.md`.

### Task 9: Коммит, push, PR

- **ACTION**: `test(coverage): lcov summary for api and web, report-only CI step (#9)`; push; дополнить PR #10 секцией «Фаза 5».
- **VALIDATE**: pre-push `check` зелёный (включая `bun test scripts`); CI quality зелёный, summary с таблицей.

---

## Testing Strategy

### Unit Tests

| Test                                   | Input                                   | Expected Output                                  | Edge Case? |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------ | ---------- |
| parseLcov: два записи, Windows-путь    | sample с `SF:src\app.ts`                | `src/app.ts`, числа как в LF/LH/FNF/FNH          | нет        |
| parseLcov: CRLF, неизвестные ключи, запись без SF | строка с `\r\n`, `BRF`       | одна запись, функции 0                           | да         |
| parseLcov: пусто                       | `''`                                    | `[]`                                             | да         |
| summarize                              | два записи                              | суммы, files=2                                   | нет        |
| percent 0/0                            | `(0, 0)`                                | `'—'`                                            | да         |
| percent округление                     | `(11, 15)`                              | `'73.3%'`                                        | нет        |
| toMarkdown                             | одна строка api                         | три строки GFM-таблицы                           | нет        |

### Edge Cases Checklist

- [ ] Нет `lcov.info` у одного workspace → строка пропущена, сообщение в stderr, exit 0.
- [ ] Нет ни одного `lcov.info` → exit 1 с подсказкой.
- [ ] `coverage/` не попадает в git/prettier/eslint (ignores уже есть).
- [ ] `bun run test` не стал медленнее (coverage только в `test:coverage`).
- [ ] Vitest отчёт не содержит `generated/` (include ограничен `app/**`).

---

## Validation Commands

### Static Analysis

```bash
bunx eslint scripts
bunx prettier --check scripts apps/web/vitest.config.ts apps/api/bunfig.toml package.json apps/api/package.json apps/web/package.json CLAUDE.md .github/workflows/ci.yaml
```

EXPECT: чисто (prettier понимает toml? — нет парсера: исключить `bunfig.toml` из списка или `--ignore-unknown`).

### Unit Tests

```bash
bun test scripts
```

EXPECT: 7 pass.

### Full Test Suite

```bash
bun run check
bun run test:coverage
```

EXPECT: `check` exit 0; `test:coverage` печатает таблицу с api и web.

### Database Validation

N/A.

### Browser Validation

N/A.

### Manual Validation

- [ ] `apps/api/coverage/lcov.info` и `apps/web/coverage/lcov.info` существуют после `test:coverage`.
- [ ] Таблица web не содержит `generated/`.
- [ ] В CI summary job `quality` видна таблица.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Tests written and passing (парсер lcov, 7 кейсов)
- [ ] No type errors
- [ ] No lint errors
- [ ] Таблица покрытия в терминале и в job summary CI; порога нет

## Completion Checklist

- [ ] Code follows discovered patterns (шапки, `fileURLToPath`, стрелочные функции)
- [ ] Error handling matches codebase style (stderr + exit 1 только при полном отсутствии данных)
- [ ] Logging follows codebase conventions
- [ ] Tests follow test patterns (`bun:test`, `describe/it`, `toEqual`)
- [ ] No hardcoded values (список workspace'ов — константа в одном месте)
- [ ] Documentation updated (CLAUDE.md)
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Версия `@vitest/coverage-v8` разойдётся с vitest после мержа PR #8    | H          | M      | ставить через `$(bunx vitest --version)`; при мерже #8 повторить `bun add` |
| Конфликт `vitest.config.ts` и `apps/web/package.json` с PR #7/#8     | H          | L      | минимальные правки; при мерже объединить `test.exclude` (#7) и `coverage`  |
| Vitest с `environment: nuxt` считает покрытие неточно (SSR-обёртки)  | M          | L      | отчёт информационный; `include: ['app/**']` убирает шум                    |
| `bun test scripts` подхватит будущие не-тестовые файлы `*.test.ts`    | L          | L      | конвенция: тесты рядом с модулем в `scripts/lib/`                          |
| Корневой tsconfig не покрывает `scripts/` → typecheck не видит ошибок | M          | L      | проверить `tsconfig.json` `include` в Task 1; при необходимости добавить `scripts/**` |

## Notes

- Этот план реализуем сейчас на vitest 4.1.10; после мержа PR #8 — один
  `bun add -d @vitest/coverage-v8@5.0.5`. Остальное не зависит от версии.
- Phase 4 (e2e в CI) пропущена как заблокированная мержем PR #7; статус в
  PRD не менялся.
- Тест парсера — первый «учебный» unit-тест на plain-функции в репо: без
  моков, без фреймворка, табличные кейсы через `it.each`. Для новичка в
  тестах — образец, на который ссылаться.
