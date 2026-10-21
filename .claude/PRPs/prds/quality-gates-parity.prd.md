# Quality Gates Parity — локальные проверки = CI

Тикет: https://github.com/TheMaksKryt/habito/issues/9

## Problem Statement

Единственный разработчик и его агентские сессии не могут предсказать, пройдёт ли
PR проверки, пока не запушат: локальный `bun run lint` на Windows красный из-за
CRLF, хотя CI на Linux зелёный; хуков нет, прогон легко забыть; Playwright из
PR #7 запускается только руками. Цена: ожидание CI вместо быстрой обратной
связи, недоверие к локальному сигналу и ручные правила «что запускать», которые
каждая новая сессия открывает заново.

## Evidence

- `core.autocrlf=true` на машине разработчика, в репо нет `.gitattributes`, а в
  `.prettierrc` не задан `endOfLine` → `prettier --check .` помечает все файлы
  (наблюдение 2026-10-21, 31 файл с «Code style issues»).
- Пользователь: «часто сталкивался с тем, когда локально нет некоторых
  проверок, а CI на lint падала».
- В репо нет `.husky/`, `lefthook.yml`, `core.hooksPath`; единственная
  автоматика — pre-flight тесты в `bun dev` (scripts/dev.ts).
- PR #7: Playwright-спек есть, в CI не включён, нужен поднятый стек.
- Все пять PR проекта имеют зелёный CI — проблема не в CI, а в локальной
  стороне контура и в неполноте покрытия сценариев.

## Proposed Solution

Сделать один контур проверок, который запускается одной командой
`bun run check` и даёт одинаковый результат локально (любая ОС) и в GitHub
Actions. Расхождения по переводам строк убираются на уровне репозитория
(`.gitattributes` + `endOfLine`), чтобы сигнал lint снова значил «ошибка в
коде». Git-хуки через Lefthook делают прогон невозможным забыть: быстрый
pre-commit на изменённых файлах, полный `check` на pre-push. CI получает
`concurrency`, условный Playwright-job на изменения UI в `apps/web` и
coverage-отчёт. Знание о контуре фиксируется в CLAUDE.md, а рутина прогона
выносится в субагента `cto`, которого основная сессия запускает параллельно и
получает вердикт, не тратя контекст на логи.

## Key Hypothesis

We believe одна команда `check`, идентичная CI, плюс хуки Lefthook will
устранят расхождения «локально/CI» и забытые прогоны for разработчика и
агентских сессий. We'll know we're right when за 30 дней ни один PR не имеет
красного первого прогона CI, а `bun run check` укладывается в 120 секунд.

## What We're NOT Building

- Nightly/scheduled прогоны и matrix по ОС — один разработчик, нет прод-трафика.
- Визуальная регрессия (скриншоты) — UI ещё не стабилизирован.
- `act` для локального запуска GitHub Actions — паритет достигается общей
  командой, а не эмуляцией раннера.
- Порог coverage как блокер — сначала отчёт, порог после появления
  домен-логики (Принцип VII говорит о тестах домен-логики, её ещё нет).
- Playwright на каждый PR безусловно — только при изменениях UI (решение
  пользователя), иначе CI медленнее на 2–3 минуты без пользы.

## Success Metrics

| Metric                                      | Target               | How Measured                                     |
| ------------------------------------------- | -------------------- | ------------------------------------------------ |
| PR с зелёным CI с первой попытки            | 100 % за 30 дней     | `gh run list --event pull_request`, первый run   |
| Время `bun run check` локально              | ≤ 120 с              | `time bun run check` на машине разработчика      |
| Время pre-commit хука                       | ≤ 10 с               | вывод Lefthook (summary с таймингами)            |
| Локальный `lint` на Windows совпадает с CI  | 0 ложных файлов      | `prettier --check .` после renormalize           |
| Playwright в CI при изменении UI            | job запускается/зелёный | вкладка Checks на PR с правкой в `apps/web/app` |

## Open Questions

- [ ] Typecheck в pre-commit или только в pre-push? Рабочая гипотеза: только
      pre-push (`nuxt typecheck` на web ~20–40 с, в pre-commit это раздражает).
- [ ] Какие пути считать «UI»: `apps/web/app/**` целиком или ещё
      `apps/web/nuxt.config.ts` и `apps/api/src/**` (контракт влияет на UI)?
      Рабочая гипотеза: `apps/web/**` минус тесты и конфиги тестов, плюс
      `apps/api/openapi`-цепочка не включается (покрыта unit/smoke).
- [ ] Lefthook под Bun на Windows: установка бинарника через npm-пакет
      `lefthook` — проверить на месте (источники Bun-специфику не описывают).
- [ ] Нужен ли `check` в `bun dev` вместо нынешних только-тестов?

---

## Users & Context

**Primary User**

- **Who**: разработчик-владелец проекта (новичок в тестировании) и его
  параллельные агентские сессии Claude Code; позже — любой новый разработчик,
  который делает `bun install` и получает тот же контур.
- **Current behavior**: пишет код, запускает `bun run lint`/`typecheck`/`test`
  вручную и не всегда, пушит, ждёт CI, чинит по результатам.
- **Trigger**: момент перед коммитом/пушем и момент «CI красный, а локально
  было зелёно (или наоборот)».
- **Success state**: «локально зелёно → в CI зелёно», без ручных правил.

**Job to Be Done**
When я готов пушить, I want to один раз запустить проверку и быть уверенным, что
PR будет зелёным, so I can не ждать CI и не гонять правки по кругу.

**Non-Users**
Прод-эксплуатация и нагрузочное тестирование — вне контура. Сложные
бизнес-сценарии — их ещё нет; учимся на `health` и landing.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability                                                                                                    | Rationale                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Must     | `.gitattributes` (`* text=auto eol=lf`), `endOfLine: "lf"` в Prettier, разовый `git add --renormalize`        | убирает ложный красный lint на Windows; сигнал снова значит ошибку      |
| Must     | Скрипт `check` в корне: lint → typecheck → test, те же команды, что в CI; CI вызывает `bun run check`          | один источник правды, паритет по построению                             |
| Must     | Lefthook: pre-commit (eslint + prettier на staged), pre-push (`bun run check`)                                 | нельзя забыть; быстрая обратная связь на коммите                        |
| Must     | Субагент `.claude/agents/cto.md`: прогоняет check/e2e/health параллельно, возвращает вердикт и выжимку логов   | решение пользователя; разгружает контекст основной сессии               |
| Must     | CLAUDE.md, раздел «Проверки»: карта «что / где / когда», как звать `cto`, правила с «почему»                   | знание для будущих сессий — явная просьба пользователя                  |
| Should   | CI `concurrency` (отмена устаревших прогонов на той же ветке)                                                  | меньше очереди при частых пушах агентов                                 |
| Should   | CI job `e2e`: при изменениях в `apps/web` (UI) поднять `docker compose`, прогнать Playwright, артефакт-репорт | решение пользователя; реальная цепочка SSR → SDK → API                  |
| Should   | Coverage как отчёт (bun test --coverage, vitest --coverage) в summary CI, без порога                           | видимость, не блокер; порог позже                                       |
| Could    | Проверка дрейфа SDK: `gen:api` + `git diff --exit-code apps/web/generated`                                     | ловит забытую регенерацию; `generated/` сейчас в .gitignore — пересмотр |
| Could    | `bun dev` запускает `check` вместо только тестов (флаг `--no-check`)                                           | расширение существующего pre-flight                                     |
| Won't    | Nightly, matrix по ОС, визуальная регрессия, `act`                                                            | избыточно для одного разработчика                                       |

### MVP Scope

Must-пункты: паритет (gitattributes + endOfLine + `check`), Lefthook, агент
`cto`, раздел в CLAUDE.md. Этого достаточно, чтобы проверить гипотезу «первый
прогон CI зелёный».

### User Flow

1. Правка кода → `git commit` → Lefthook за ≤10 с гоняет eslint/prettier по
   staged-файлам → коммит.
2. `git push` → pre-push запускает `bun run check` (≤120 с) → пуш.
3. Параллельно основная сессия просит `cto` прогнать `check` + e2e + `/health`
   на поднятом стеке и получает вердикт одним сообщением.
4. PR → CI выполняет тот же `check`, `images`, при изменениях UI — `e2e`.

---

## Technical Approach

**Feasibility**: HIGH — все инструменты уже в репо (ESLint flat, Prettier,
bun test, Vitest, Playwright в PR #7, docker compose, CI workflow); добавляются
конфиги и один dev-пакет (lefthook).

**Architecture Notes**

- `check` живёт в корневом package.json и композирует существующие
  `lint`/`typecheck`/`test`; CI (`.github/workflows/ci.yaml`, job `quality`)
  заменяет три шага на один `bun run check`. Так локальный и серверный прогон —
  буквально одна команда.
- Переводы строк: `.gitattributes` (`* text=auto eol=lf`) гарантирует LF в
  индексе и при checkout независимо от `core.autocrlf`; разовый
  `git add --renormalize .` переводит уже закоммиченные файлы. Prettier читает
  файл с диска, поэтому после renormalize и повторного checkout рабочая копия
  тоже LF, и `endOfLine: "lf"` перестаёт ложно срабатывать. `endOfLine: "auto"`
  не используем — он маскирует смешанные окончания. Проверяется на машине
  пользователя первым шагом Фазы 1.
- Lefthook: `lefthook.yml` в корне, установка хуков через `postinstall`
  (`lefthook install`), чтобы новый разработчик получил хуки из `bun install`.
  В CI хуки не нужны — `lefthook install` пропускается по `CI=true`.
- Агент `cto`: Markdown-описание субагента с инструментами Bash/Read/Grep;
  обязанности — запустить `bun run check`, при поднятом стеке `curl /health` и
  `bun run --filter web test:e2e`, вернуть таблицу «гейт → статус → первая
  ошибка». Не правит код. Основная сессия вызывает его через Agent tool
  параллельно с работой.
- CI e2e: job с условием по `paths` (через `dorny/paths-filter` или
  `on.pull_request.paths` в отдельном workflow), `docker compose up --build
  -d`, ожидание health, `bunx playwright install --with-deps chromium`,
  `bun run --filter web test:e2e`, upload `playwright-report`. Зависит от
  мержа PR #7.
- Coverage: `bun test --coverage` (api), `vitest run --coverage` (web, нужен
  `@vitest/coverage-v8`), вывод в job summary.

**Technical Risks**

| Risk                                                             | Likelihood | Mitigation                                                                  |
| ---------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Lefthook-бинарник не ставится через Bun на Windows               | M          | проверить первым шагом; запасной вариант — husky + lint-staged              |
| `endOfLine: lf` + autocrlf всё равно даёт красный lint на Windows | M          | рекомендовать `core.autocrlf=input` в CLAUDE.md; `.gitattributes` защищает репо |
| Playwright-job в CI нестабилен (ожидание стека, браузеры)        | M          | healthcheck-ожидание с таймаутом, retries=1, артефакт trace при падении     |
| Условный job по путям ломает branch protection (required check)  | H          | не делать `e2e` required; либо job всегда есть и «skip» считается success   |
| `postinstall` с `lefthook install` падает в Docker-сборке        | L          | уже используется `--ignore-scripts` в Dockerfile; плюс guard по `CI`        |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| #   | Phase            | Description                                                                                  | Status  | Parallel   | Depends | PRP Plan |
| --- | ---------------- | -------------------------------------------------------------------------------------------- | ------- | ---------- | ------- | -------- |
| 1   | Parity           | `.gitattributes`, `endOfLine`, renormalize, корневой `check`, CI вызывает `check`, `concurrency` | in-progress | -      | -       | `.claude/PRPs/plans/quality-gates-parity-phase-1-parity.plan.md` |
| 2   | Hooks            | Lefthook: pre-commit staged lint/format, pre-push `check`, установка через postinstall        | pending | with 3     | 1       | -        |
| 3   | CTO agent + docs | `.claude/agents/cto.md`, раздел «Проверки» в CLAUDE.md с правилами и «почему»               | pending | with 2     | 1       | -        |
| 4   | E2E in CI        | job `e2e` по изменениям UI: compose up, Playwright, артефакты (после мержа PR #7)            | pending | with 2, 3  | 1       | -        |
| 5   | Coverage report  | coverage api/web в job summary без порога                                                    | pending | with 4     | 1       | -        |
| 6   | SDK drift (Could)| `gen:api` + diff в CI; пересмотр `.gitignore` для `generated/`                               | pending | -          | 1       | -        |

### Phase Details

**Phase 1: Parity**

- **Goal**: локальный и CI-прогон — одна команда, одинаковый результат на Windows и Linux.
- **Scope**: `.gitattributes`, `.prettierrc.endOfLine`, `git add --renormalize .`, скрипт `check`, замена шагов в `ci.yaml` на `bun run check`, `concurrency`.
- **Success signal**: `bun run check` зелёный на Windows без флагов; CI зелёный тем же скриптом.

**Phase 2: Hooks**

- **Goal**: прогон нельзя забыть.
- **Scope**: `lefthook.yml`, dev-зависимость `lefthook`, `postinstall` с guard по `CI`; pre-commit ≤10 с, pre-push = `check`.
- **Success signal**: коммит с ошибкой prettier блокируется; пуш с падающим тестом блокируется; `bun install` на чистом клоне ставит хуки.

**Phase 3: CTO agent + docs**

- **Goal**: будущие сессии знают контур и делегируют прогон.
- **Scope**: `.claude/agents/cto.md` (роль, команды, формат вердикта, запрет на правки), раздел «Проверки» в CLAUDE.md (таблица что/где/когда, правила с «почему», как звать агента параллельно).
- **Success signal**: вызов `cto` из основной сессии возвращает таблицу гейтов за один ответ; CLAUDE.md не требует догадок.

**Phase 4: E2E in CI**

- **Goal**: UI-изменения проверяются реальной цепочкой SSR → SDK → API.
- **Scope**: условный job по путям `apps/web/**` (кроме тестов), compose up + health wait, Playwright chromium, артефакт отчёта; не делать required.
- **Success signal**: PR с правкой в `apps/web/app` запускает `e2e`, PR только по api — нет.

**Phase 5: Coverage report**

- **Goal**: видимость покрытия без блокировки.
- **Scope**: `--coverage` в тестовых скриптах CI, `@vitest/coverage-v8`, summary.
- **Success signal**: в job summary есть проценты для api и web.

**Phase 6: SDK drift (Could)**

- **Goal**: ловить забытую регенерацию SDK.
- **Scope**: шаг CI `bun run gen:api && git diff --exit-code`, при необходимости коммит `generated/`.
- **Success signal**: PR, меняющий схему без регенерации, падает понятной ошибкой.

### Parallelism Notes

Фаза 1 первая — остальные опираются на `check` и паритет строк. Фазы 2 и 3
независимы (конфиг хуков против Markdown). Фаза 4 ждёт мержа PR #7, но её можно
готовить параллельно с 2 и 3. Фаза 5 независима от 4. Фаза 6 отложена.

---

## Decisions Log

| Decision               | Choice                        | Alternatives                       | Rationale                                                               |
| ---------------------- | ----------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| Менеджер хуков         | Lefthook                      | husky + lint-staged, simple-git-hooks | один yaml, параллельный запуск, монорепо-aware; husky — запасной вариант |
| Паритет                | общий скрипт `check`          | `act`, дублирование шагов          | одна команда — паритет по построению, без эмуляции раннера              |
| Переводы строк         | LF в репо + `endOfLine: lf`   | `endOfLine: auto`                  | `auto` маскирует проблему; LF — единый стандарт для Linux-CI и Docker   |
| Playwright в CI        | условно, по изменениям UI     | всегда / никогда                   | решение пользователя; экономия 2–3 мин на не-UI PR                      |
| Coverage               | отчёт без порога              | порог 80 %                         | домен-логики ещё нет, порог был бы шумом                                |
| Запуск проверок        | субагент `cto` параллельно    | хуки только / ручной запуск        | решение пользователя; разгружает контекст, даёт вердикт одним ответом   |

---

## Research Summary

**Market Context**

- Husky + lint-staged — привычная связка; Lefthook — Go-бинарник, один
  конфиг, параллельный запуск, заявлен как замена обоим
  ([pkgpulse](https://www.pkgpulse.com/guides/husky-vs-lefthook-vs-lint-staged-git-hooks-nodejs-2026),
  [dev.to](https://dev.to/saltyshiomix/saying-goodbye-to-husky-how-lefthook-supercharged-our-typescript-workflow-35c8),
  [bitovi](https://www.bitovi.com/blog/how-to-migrate-husky-to-lefthook)).
- Bun-специфика в источниках не описана — проверяется на месте.
- Общая практика «одна команда для человека, хука и CI» — стандарт де-факто.

**Technical Context**

- Гейты `lint`/`typecheck`/`test` существуют в каждом workspace, CI требует их
  через branch protection (`quality`, `images (api)`, `images (web)`,
  strict).
- Тесты: `apps/api/tests/health.test.ts` (unit + `app.handle()`),
  `apps/web/tests/smoke.test.ts` (Vitest + `mountSuspended`, SDK через
  `vi.mock`). Playwright-спек в PR #7.
- `scripts/dev.ts` уже делает pre-flight тесты (`--no-test`) — прецедент
  локальной автоматики.
- Расхождение CRLF: `core.autocrlf=true`, нет `.gitattributes`, нет
  `endOfLine`.

---

_Generated: 2026-10-21_
_Status: DRAFT - needs validation_
