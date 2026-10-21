# Plan: Quality Gates Parity — Phase 4 (E2E in CI)

## Summary

Добавить в CI условный job `e2e`: при изменениях UI в `apps/web` (фильтр
путей через `dorny/paths-filter`) поднять полный стек `docker compose up
--build --wait`, прогнать Playwright-спеки из PR #7 против живого web
(SSR → SDK → API), выложить отчёт артефактом и погасить стек. Job не входит в
required checks: на PR без UI-изменений он пропускается, и обязательная
проверка зависла бы в «ожидании». Предварительно ветка PR #7 (Playwright)
вливается в текущую, конфликты в `vitest.config.ts`, `.gitignore`,
`apps/web/package.json`, `CLAUDE.md` разрешаются по описанным правилам.

## User Story

As a разработчик, меняющий UI,
I want чтобы на PR автоматически прогонялась реальная цепочка браузер → SSR →
SDK → API, а на PR без UI-правок CI не тратил 4–5 минут,
So that ловить поломки интеграции до мержа, не замедляя остальные PR.

## Problem → Solution

Playwright-спек и конфиг есть (PR #7), но запускаются только руками поверх
поднятого стека. → Job `e2e` с фильтром путей, стек через compose с
`--wait`, Chromium через `bunx playwright install --with-deps chromium`,
артефакты `playwright-report/` и `test-results/`, логи compose при падении.

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/quality-gates-parity.prd.md`
- **PRD Phase**: 4 — E2E in CI
- **Estimated Files**: 5 (`.github/workflows/ci.yaml`, `apps/web/playwright.config.ts`, `CLAUDE.md`, `README.md`, `.claude/PRPs/...`) + файлы, пришедшие из PR #7 при слиянии

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────┐
│ PR с правкой index.vue → CI: quality ✔, images ✔             │
│ Playwright: только руками, если вспомнил поднять стек        │
└──────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────┐
│ PR с правкой index.vue → CI: quality ✔, images ✔,            │
│   changes → ui=true → e2e: compose up --wait → chromium →    │
│   smoke.spec ✔ → артефакт playwright-report → compose down   │
│ PR только по api → changes → ui=false → e2e skipped          │
│ Required checks не меняются (quality, images api/web)        │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint             | Before                       | After                                               | Notes                                  |
| ---------------------- | ---------------------------- | --------------------------------------------------- | -------------------------------------- |
| PR с UI-изменениями    | без e2e                      | job `e2e` ~4–6 мин (сборка образов + Chromium)      | не required; `concurrency` уже есть    |
| PR без UI-изменений    | без e2e                      | `e2e` skipped, `changes` ~10 с                      |                                        |
| push в `main`          | без e2e                      | без e2e (`changes` только на `pull_request`)        | push-режим фильтра требует git-историю |
| Падение e2e            | —                            | аннотации `github`-репортера, артефакт с trace, логи compose | `retain-on-failure` уже в конфиге |
| Локально               | `bunx playwright install chromium` + `test:e2e` | без изменений                      | агент `cto` подхватит скрипт автоматически |

---

## Mandatory Reading

| Priority       | File                               | Lines   | Why                                                                                   |
| -------------- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| P0 (critical)  | `.github/workflows/ci.yaml`        | all     | структура jobs, `concurrency`, версии action'ов (checkout/setup-bun — как в `quality`) |
| P0 (critical)  | PR #7: `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts` | all | что прогоняем; `reporter: process.env.CI ? 'github' : 'list'`, `baseURL` из `E2E_BASE_URL` |
| P0 (critical)  | `docker-compose.yml`               | api/web services | healthcheck'и обоих сервисов (условие для `--wait`), `NUXT_PUBLIC_API_URL` default `http://localhost:3333` — браузер на раннере ходит в опубликованный порт |
| P1 (important) | `apps/web/vitest.config.ts`        | all     | конфликт слияния: `exclude` из PR #7 + `coverage` из Фазы 5 — оба внутри `test`       |
| P1 (important) | `.gitignore`                       | tail    | PR #7 добавляет `playwright-report/`, `test-results/`; наш хвост — lefthook + graft   |
| P1 (important) | `CLAUDE.md`                        | «Проверки» (строка e2e), «Тесты» (bullet из PR #7) | обновить «в CI не входит»             |
| P1 (important) | `README.md`                        | секция мейнтейнера про required checks | добавить фразу, что `e2e` не required            |
| P2 (reference) | `.claude/agents/cto.md`            | шаг 6   | агент уже ищет `test:e2e` динамически — правок не нужно                              |

## External Documentation

| Topic                          | Source                                   | Key Takeaway                                                                                                   |
| ------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `dorny/paths-filter@v4`        | github.com/dorny/paths-filter            | на `pull_request` checkout не нужен, нужен `permissions: pull-requests: read`; outputs `<filter>` = `'true'/'false'`; гейт `if: needs.changes.outputs.ui == 'true'`; v4 — Node 24 runtime; push-режим требует git-историю, поэтому ограничиваем `pull_request` |
| Playwright в CI                | playwright.dev/docs/ci                   | `playwright install --with-deps`; `workers: 1` в CI для стабильности; отчёт грузить `upload-artifact` с `if: ${{ !cancelled() }}`; кэш браузеров не рекомендуется |
| `docker compose up --wait`     | docs.docker.com compose up               | ждёт `running|healthy` (подразумевает `-d`), `--wait-timeout <s>`; у api и web есть healthcheck'и → `--wait` достаточно |
| `actions/upload-artifact`      | releases                                 | актуальный мажор v7; `if-no-files-found: ignore`, `retention-days`                                              |
| Проверено локально (Фаза 2–5)  | —                                        | образы собираются на `oven/bun`, стек поднимается ~15 с после сборки, `/health` 200, web 200                     |

---

## Patterns to Mirror

### CI_JOB_PATTERN

```yaml
# SOURCE: .github/workflows/ci.yaml — job images: matrix, именованные шаги, актуальные action'ы
  images:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, web]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Build ${{ matrix.app }} image (no push)
        uses: docker/build-push-action@v6
```

### CI_COMMENT_PATTERN

```yaml
# SOURCE: .github/workflows/ci.yaml:1-6 — шапка-комментарий «что/почему» на русском
# CI-гейты (Принцип VII конституции): каждый PR и push в main проходит
# `bun run check` (та же команда, что локально …
```

### PLAYWRIGHT_CONFIG (PR #7)

```ts
// SOURCE: PR #7 apps/web/playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
```

### DOCS_TABLE_ROW

```markdown
<!-- SOURCE: CLAUDE.md «Проверки» -->
| e2e Playwright                              | `bun run --filter web test:e2e` на поднятом стеке     | изменения UI (в CI — Фаза 4)       |
```

### TEST_STRUCTURE

N/A — новых тестов нет, прогоняется спек из PR #7.

---

## Files to Change

| File                             | Action | Justification                                                              |
| -------------------------------- | ------ | -------------------------------------------------------------------------- |
| (merge) `origin/test/6-playwright` | MERGE | Playwright-конфиг, спек, скрипт, зависимость — из PR #7                   |
| `apps/web/vitest.config.ts`      | UPDATE | разрешение конфликта: `exclude` + `coverage` в одном `test`                |
| `.github/workflows/ci.yaml`      | UPDATE | jobs `changes` и `e2e`                                                     |
| `apps/web/playwright.config.ts`  | UPDATE | html-репортер для артефакта, `workers: 1`/`retries: 1` в CI, комментарий   |
| `CLAUDE.md`                      | UPDATE | строка e2e в «Проверки», bullet в «Тесты»                                  |
| `README.md`                      | UPDATE | фраза про `e2e` вне required checks                                        |

## NOT Building

- `e2e` как required check — иначе PR без UI зависнут на «Expected».
- Кэш браузеров Playwright — Playwright не рекомендует; `--with-deps` ставит и системные пакеты.
- GHA-кэш для `docker compose build` — compose не умеет `type=gha` без bake; при росте времени — отдельная задача (bake или переиспользование образов из job `images` через артефакты).
- e2e на `push` в `main` — фильтр путей в push-режиме требует git-истории и `base`; PR-гейта достаточно.
- Новые e2e-спеки — Принцип VII: вместе с первым критическим потоком.

---

## Step-by-Step Tasks

### Task 0: Слить ветку PR #7

- **ACTION**: в worktree `habito-gates` влить `origin/test/6-playwright` (если PR #7 к этому моменту смержен в `main` — вместо этого `git merge origin/main`).
- **IMPLEMENT**:
  ```bash
  git fetch origin test/6-playwright          # SSH иногда падает с 128 — повторить
  git merge --no-ff origin/test/6-playwright -m "merge: playwright smoke from test/6-playwright into quality-gates (#9)"
  ```
  Конфликты и правила:
  - `apps/web/vitest.config.ts` — оставить **оба** блока внутри `test`:
    ```ts
    test: {
      environment: 'nuxt',
      // Playwright-спеки живут отдельно и запускаются через `bun run test:e2e`
      exclude: ['e2e/**', '**/node_modules/**'],
      // Coverage как отчёт (bun run test:coverage): только наш код в app/ —
      // без include в отчёт попадают generated/api и служебные файлы Nuxt
      coverage: { provider: 'v8', include: ['app/**/*.{ts,vue}'], reporter: ['text', 'lcov'] },
    },
    ```
  - `apps/web/package.json` — оба скрипта (`test:coverage`, `test:e2e`) и обе devDependencies (`@vitest/coverage-v8`, `@playwright/test`).
  - `.gitignore` — все хвосты: lefthook, graft, playwright.
  - `CLAUDE.md` — bullet про e2e из PR #7 принять, текст «в CI не входит» править в Task 4.
  - `bun.lock` — не мержить руками: взять любую сторону, затем `bun install` (не frozen) пересоберёт; проверить `git diff --stat bun.lock` — только playwright-пакеты.
- **GOTCHA**: после `bun install` выполнить `bunx playwright install chromium` для локального прогона. Коммит слияния пройдёт pre-commit (lefthook `skip: merge` — пропустит).
- **VALIDATE**: `bun run check` зелёный; `ls apps/web/e2e apps/web/playwright.config.ts`; `grep -c test:e2e apps/web/package.json` → 1.

### Task 1: Локальный прогон Playwright

- **ACTION**: убедиться, что спек зелёный против живого стека до правок CI.
- **IMPLEMENT**:
  ```bash
  docker compose ps --format '{{.Name}} {{.Health}}'     # стек должен быть healthy (иначе POSTGRES_PORT=55432 docker compose up -d)
  cd apps/web && bunx playwright install chromium && bun run test:e2e
  ```
- **GOTCHA**: стек сейчас поднят из worktree `habito-deps` (образы ветки #5) — для smoke это не важно. Не делать `compose down`: стек общий с другими сессиями.
- **VALIDATE**: `1 passed`.

### Task 2: `playwright.config.ts` — артефакт и стабильность в CI

- **ACTION**: обновить конфиг из PR #7.
- **IMPLEMENT**:
  ```ts
  import { defineConfig, devices } from '@playwright/test'

  // Полный прогон UI поверх поднятого стека (`bun dev` или `docker compose up`).
  // В CI — job e2e при изменениях UI (фильтр путей в .github/workflows/ci.yaml),
  // не required check. Новые спеки — вместе с первым критическим потоком
  // (конституция, Принцип VII).
  export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    // CI: аннотации в PR + html-отчёт для артефакта; один worker и один retry —
    // стабильность на раннере важнее скорости одного спека
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
    workers: process.env.CI ? 1 : undefined,
    retries: process.env.CI ? 1 : 0,
    use: {
      baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
      trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  })
  ```
- **MIRROR**: PLAYWRIGHT_CONFIG, комментарии «что/почему».
- **GOTCHA**: html-репортер пишет в `apps/web/playwright-report/` (в `.gitignore` из PR #7). `open: 'never'` — иначе репортер пытается открыть браузер.
- **VALIDATE**: `cd apps/web && CI=1 bun run test:e2e` → проходит, появляется `playwright-report/index.html`; `bunx prettier --check playwright.config.ts`.

### Task 3: CI — jobs `changes` и `e2e`

- **ACTION**: добавить в `.github/workflows/ci.yaml` после `images`.
- **IMPLEMENT**:
  ```yaml
    # Фильтр путей для условного e2e: на pull_request paths-filter читает список
    # файлов через API (checkout не нужен); на push фильтр требует git-истории,
    # поэтому e2e только для PR. Job e2e НЕ в required checks — на PR без UI он
    # skipped, а обязательная проверка зависла бы в «Expected».
    changes:
      if: github.event_name == 'pull_request'
      runs-on: ubuntu-latest
      permissions:
        pull-requests: read
      outputs:
        ui: ${{ steps.filter.outputs.ui }}
      steps:
        - uses: dorny/paths-filter@v4
          id: filter
          with:
            filters: |
              ui:
                - 'apps/web/app/**'
                - 'apps/web/nuxt.config.ts'
                - 'apps/web/e2e/**'
                - 'apps/web/playwright.config.ts'
                - 'apps/web/Dockerfile'
                - 'docker-compose.yml'
                - '.github/workflows/ci.yaml'

    # Реальная цепочка браузер → SSR (nitro-bun) → SDK → API на полном стеке
    e2e:
      needs: changes
      if: needs.changes.outputs.ui == 'true'
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        - uses: oven-sh/setup-bun@v2
          with:
            bun-version: latest

        - name: Install (frozen lockfile)
          run: bun install --frozen-lockfile

        - name: Install Chromium
          run: bunx playwright install --with-deps chromium

        - name: Start stack (compose, wait for healthchecks)
          run: docker compose up --build --wait --wait-timeout 300

        - name: Playwright
          run: bun run --filter web test:e2e
          env:
            E2E_BASE_URL: http://localhost:3000

        - name: Stack logs (on failure)
          if: failure()
          run: docker compose logs --no-color --tail=200

        - uses: actions/upload-artifact@v7
          if: ${{ !cancelled() }}
          with:
            name: playwright-report
            path: |
              apps/web/playwright-report/
              apps/web/test-results/
            if-no-files-found: ignore
            retention-days: 14

        - name: Stop stack
          if: always()
          run: docker compose down -v
  ```
  `checkout`/`setup-bun` — те же версии и опции, что в job `quality` на момент реализации (после мержа PR #8 там `checkout@v7` и `bun-version-file: package.json` — повторить).
- **MIRROR**: CI_JOB_PATTERN, CI_COMMENT_PATTERN.
- **GOTCHA**: `'.github/workflows/ci.yaml'` в фильтре — чтобы правка самого workflow (этот PR) прогнала e2e и проверила себя. `docker compose up --build` в CI без кэша: ~3–4 мин; `--wait` ждёт healthy api и web (healthcheck'и есть). `down -v` в `always()` — раннер эфемерный, но так логи и порты не мешают повторным шагам. Не добавлять `e2e` в branch protection.
- **VALIDATE**: `bunx prettier --check .github/workflows/ci.yaml`; после push в PR #10 (меняет `ci.yaml`) — job `changes` даёт `ui=true`, `e2e` зелёный, артефакт `playwright-report` в run.

### Task 4: CLAUDE.md и README

- **ACTION**: три точечные правки.
- **IMPLEMENT**:
  1. «Проверки», строка e2e:
     ```markdown
     | e2e Playwright                              | `bun run --filter web test:e2e` на поднятом стеке; CI job `e2e` | изменения UI (фильтр путей в ci.yaml), не required |
     ```
  2. «Тесты», bullet из PR #7: заменить «Запускается вручную, в CI не входит — e2e добавляются в CI вместе с первым критическим пользовательским потоком (Принцип VII).» на «В CI — job `e2e` при изменениях UI (список путей в `.github/workflows/ci.yaml`), не блокирует merge; новые спеки — вместе с первым критическим потоком (Принцип VII). Локально один раз `bunx playwright install chromium`.»
  3. README, секция мейнтейнера про required checks: после перечисления `quality`, `images (api)`, `images (web)` добавить «Job `e2e` (Playwright при изменениях UI) в required не добавлять: на PR без UI он пропускается.»
- **MIRROR**: DOCS_TABLE_ROW; стиль README.
- **GOTCHA**: `bunx prettier --write CLAUDE.md README.md` для таблиц.
- **VALIDATE**: `bunx prettier --check CLAUDE.md README.md`.

### Task 5: Коммит, push, PR

- **ACTION**: `ci(e2e): run Playwright on UI changes against compose stack (#9)`; push; дополнить PR #10 секцией «Фаза 4».
- **VALIDATE**: pre-push `check` зелёный; в run PR #10 jobs `changes` → `e2e` зелёные; артефакт есть. Негативный сценарий (PR без UI → `e2e` skipped) проверить на следующем не-UI PR и отметить в тикете.

---

## Testing Strategy

### Unit Tests

N/A — конфигурация CI; прогоняется существующий спек.

### Edge Cases Checklist

- [ ] PR меняет только `apps/api/**` → `changes.ui=false`, `e2e` skipped, required checks зелёные.
- [ ] PR меняет `docker-compose.yml` → `e2e` запускается (стек — часть цепочки).
- [ ] Стек не поднялся за 300 с → шаг Start stack красный, логи compose в выводе, артефакта нет, `down -v` выполнен.
- [ ] Спек упал → аннотация `github`-репортера, артефакт с trace, retry один раз.
- [ ] `concurrency` отменяет устаревший `e2e` при новом push.

---

## Validation Commands

### Static Analysis

```bash
bunx prettier --check .github/workflows/ci.yaml apps/web/playwright.config.ts CLAUDE.md README.md
bunx eslint apps/web
```

EXPECT: чисто.

### Unit Tests

```bash
bun run test
```

EXPECT: web Vitest не подхватывает `e2e/**` (exclude), api/web/scripts зелёные.

### Full Test Suite

```bash
bun run check
cd apps/web && CI=1 bun run test:e2e
```

EXPECT: `check` exit 0; Playwright 1 passed, `playwright-report/index.html` создан.

### Database Validation

N/A.

### Browser Validation

```bash
docker compose ps --format '{{.Name}} {{.Health}}'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/
```

EXPECT: api/web healthy, 200.

### Manual Validation

- [ ] В run PR #10: `changes` (ui=true), `e2e` success, артефакт `playwright-report`.
- [ ] Branch protection не менялась (`gh api repos/TheMaksKryt/habito/branches/main/protection`).
- [ ] Следующий PR без UI-правок: `e2e` skipped — записать в issue #9.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Ветка содержит Playwright из PR #7 с разрешёнными конфликтами
- [ ] Job `e2e` запускается только при UI-изменениях и зелёный на PR #10
- [ ] Артефакт отчёта и логи при падении настроены
- [ ] CLAUDE.md/README отражают новый контур; `e2e` не в required

## Completion Checklist

- [ ] Code follows discovered patterns (jobs как `images`, комментарии «что/почему»)
- [ ] Error handling matches codebase style (логи compose при падении, `down -v` в `always()`)
- [ ] Logging follows codebase conventions (N/A)
- [ ] Tests follow test patterns (спек из PR #7 без изменений)
- [ ] No hardcoded values (порты — из compose; URL через `E2E_BASE_URL`)
- [ ] Documentation updated
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Слияние PR #7: конфликты в 4 файлах + bun.lock                       | H          | L      | правила разрешения в Task 0; lock пересобрать `bun install`                |
| `git fetch` по SSH падает (наблюдалось дважды)                       | M          | L      | повторить; при упорном сбое — `gh pr checkout 7`-подход через HTTPS-remote |
| compose build в CI без кэша ~4 мин → e2e самый долгий job            | H          | L      | не required; при росте — bake + `type=gha` отдельной задачей               |
| `--wait` не дождался web (healthcheck через fetch внутри контейнера) | L          | M      | таймаут 300 с, логи compose при падении                                   |
| Браузер на раннере не достучится до api `localhost:3333`             | L          | M      | порт опубликован compose; `NUXT_PUBLIC_API_URL` default совпадает         |
| `dorny/paths-filter@v4` требует `pull-requests: read` — забыли       | L          | L      | в job прописано явно                                                       |

## Notes

- Решение по open question PRD «какие пути считать UI»: `apps/web/app/**`,
  `apps/web/nuxt.config.ts`, `apps/web/e2e/**`, `apps/web/playwright.config.ts`,
  `apps/web/Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yaml`.
  `apps/api/**` не включён: контракт покрыт unit/smoke, а e2e на каждый
  api-PR — те самые 4–5 минут без пользы (решение пользователя).
- Агент `cto` после слияния начнёт запускать `test:e2e` при живом стеке без
  правок — он проверяет наличие скрипта динамически.
- Если PR #7 смержат в `main` до реализации — Task 0 превращается в
  `git merge origin/main`, остальное без изменений.
