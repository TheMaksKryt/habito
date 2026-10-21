# Plan: Quality Gates Parity — Phase 1 (Parity)

## Summary

Сделать локальный прогон проверок и CI одной и той же командой `bun run check`
и убрать ложный красный Prettier на Windows: LF фиксируется в репозитории через
`.gitattributes`, Prettier получает явный `endOfLine: "lf"`, CI-job `quality`
вызывает `check` вместо пяти отдельных шагов и получает `concurrency`, чтобы
устаревшие прогоны на той же ветке отменялись.

## User Story

As a разработчик (и агентская сессия) в habito,
I want запускать одну команду, которая даёт тот же вердикт, что CI, на любой ОС,
So that не ждать CI ради обратной связи и доверять локальному сигналу.

## Problem → Solution

Индекс Git уже хранит LF (76 файлов `i/lf`), но `core.autocrlf=true` на машине
разработчика выдаёт CRLF в рабочую копию, а Prettier (default `endOfLine: lf`)
помечает все файлы. Локально lint красный, в CI на Linux зелёный; команда
«проверь как CI» отсутствует, шаги CI дублируются руками. →
`.gitattributes` с `eol=lf` заставляет checkout выдавать LF независимо от
autocrlf; `check` в корне композирует существующие скрипты; CI вызывает тот же
`check`.

## Metadata

- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/quality-gates-parity.prd.md`
- **PRD Phase**: 1 — Parity
- **Estimated Files**: 5 (2 CREATE/UPDATE конфигов, package.json, ci.yaml, CLAUDE.md)

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────┐
│ dev: bun run lint  → [warn] 31 files "Code style issues"     │
│      (CRLF в рабочей копии, ошибок в коде нет)               │
│ dev: bun run typecheck; bun run test  (отдельно, вручную)    │
│ push → CI: 5 шагов (generate, gen:api, lint, typecheck, test)│
│ локальный сигнал ≠ серверный                                 │
└──────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────┐
│ dev: bun run check → generate → lint → typecheck → test      │
│      зелёный на Windows без флагов                           │
│ push → CI job quality: bun run check (та же команда)         │
│ новый push в ту же ветку отменяет предыдущий прогон          │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint          | Before                                  | After                                  | Notes                                   |
| ------------------- | --------------------------------------- | -------------------------------------- | --------------------------------------- |
| Локальная проверка  | три команды, lint ложно красный         | `bun run check`, чистый                | `lint`/`typecheck`/`test` остаются      |
| CI job `quality`    | 5 шагов                                 | 1 шаг `bun run check`                  | имя job не меняется (branch protection) |
| Повторный push      | старый прогон доедет до конца           | отменяется                             | `concurrency` + `cancel-in-progress`    |
| Checkout на Windows | CRLF                                    | LF                                     | `.gitattributes` `eol=lf`               |

---

## Mandatory Reading

| Priority      | File                         | Lines | Why                                                              |
| ------------- | ---------------------------- | ----- | ---------------------------------------------------------------- |
| P0 (critical) | `.github/workflows/ci.yaml`  | all   | job `quality`: какие шаги заменяются; имена jobs — required checks |
| P0 (critical) | `package.json`               | 9-17  | существующие скрипты, которые композирует `check`                |
| P1 (important)| `.prettierrc`                | all   | добавить `endOfLine`                                             |
| P1 (important)| `CLAUDE.md`                  | 8-19, 53-89 | блок «Команды» и список «Правила с „почему“» — куда писать правило |
| P2 (reference)| `scripts/dev.ts`             | 44-74 | стиль шагов/сообщений (на будущее для Phase 6, здесь не трогаем) |
| P2 (reference)| `docs/constitution.md`       | «VII. Обязательные quality gates» | формулировка гейтов, которой должен соответствовать `check` |

## External Documentation

| Topic                         | Source                                                   | Key Takeaway                                                                      |
| ----------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| gitattributes `eol`           | git-scm.com/docs/gitattributes                           | `eol=lf` задаёт LF в рабочей копии и переопределяет `core.autocrlf`; `text=auto` оставляет автодетект бинарников |
| `git add --renormalize`       | git-scm.com/docs/git-add                                 | пересчитывает индекс по новым атрибутам; у нас индекс уже LF — ожидаем 0 изменений |
| Prettier `endOfLine`          | prettier.io/docs/en/options#end-of-line                  | default `lf` с 2.0; `auto` только маскирует смешанные окончания — не использовать  |
| Actions `concurrency`         | docs.github.com/actions/using-jobs/using-concurrency     | группа по PR-номеру или ref; `cancel-in-progress: true` отменяет старые прогоны    |

---

## Patterns to Mirror

### NAMING_CONVENTION

```jsonc
// SOURCE: package.json:9-17 — скрипты-композиции через `bun run --filter`
"gen:api": "bun run --filter api openapi:export && bun run --filter web generate:api",
"lint": "eslint . && prettier --check .",
"typecheck": "bun run --filter '*' typecheck",
"test": "bun run --filter '*' test",
```

### ERROR_HANDLING

```ts
// SOURCE: scripts/dev.ts:71-74 — фейл шага = понятное сообщение + exit 1, без try/catch-обёрток
if (run(['bun', 'install', '--frozen-lockfile']) !== 0) {
  console.error('Зависимости не в порядке — см. вывод выше.')
  process.exit(1)
}
```

Для `check` ошибку даёт сам упавший скрипт; цепочка `&&` останавливается на
первом красном — так же, как шаги CI.

### LOGGING_PATTERN

```ts
// SOURCE: scripts/dev.ts:60 — шаги печатаются как «▸ сообщение»
const step = (message: string) => console.log(`\n▸ ${message}`)
```

В Phase 1 логирования нет (bun run печатает имена скриптов сам).

### CI_STEP_PATTERN

```yaml
# SOURCE: .github/workflows/ci.yaml:19-27 — именованные шаги с run:, bun через setup-bun
- name: Install (frozen lockfile)
  run: bun install --frozen-lockfile
- name: Generate Prisma client
  run: bun run db:generate
```

### DOCS_RULE_PATTERN

```markdown
<!-- SOURCE: CLAUDE.md:77-79 — правило = жирный тезис + «почему» (failure mode) -->
- **Хостовые порты хранилищ параметризованы** (`POSTGRES_PORT`/`REDIS_PORT`
  в .env): 5432/6379 на машине разработчика могут быть заняты другим проектом;
  внутри compose-сети всегда `postgres:5432`/`redis:6379`.
```

### TEST_STRUCTURE

N/A — фаза не добавляет исполняемой логики; проверка через команды (см.
Validation Commands).

---

## Files to Change

| File                        | Action | Justification                                                                 |
| --------------------------- | ------ | ----------------------------------------------------------------------------- |
| `.gitattributes`            | CREATE | LF для текстовых файлов на всех ОС, явные binary для картинок                 |
| `.prettierrc`               | UPDATE | явный `"endOfLine": "lf"` — фиксирует намерение, не полагаясь на default      |
| `package.json`              | UPDATE | скрипт `check`                                                                |
| `.github/workflows/ci.yaml` | UPDATE | job `quality` → `bun run check`; блок `concurrency`; комментарий в шапке      |
| `CLAUDE.md`                 | UPDATE | `check` в «Команды»; правило про LF/`.gitattributes` в «Правила с „почему“»  |

## NOT Building

- Git-хуки (Phase 2), агент `cto` и раздел «Проверки» (Phase 3), e2e в CI
  (Phase 4), coverage (Phase 5), SDK-drift (Phase 6).
- Удаление закоммиченных `.DS_Store` — отдельный микро-PR, не смешивать.
- Изменение `bun dev` (pre-flight) — Phase 6 (Could).
- Перевод `images (api|web)` jobs на `check` — они собирают Docker и остаются как есть.

---

## Step-by-Step Tasks

### Task 1: `.gitattributes`

- **ACTION**: создать `.gitattributes` в корне.
- **IMPLEMENT**:
  ```gitattributes
  # LF везде: CI и Docker — Linux, а core.autocrlf=true на Windows выдавал CRLF в
  # рабочую копию и красил Prettier (endOfLine: lf) на всех файлах без ошибок в коде.
  * text=auto eol=lf

  # Бинарники — без нормализации и диффов
  *.png binary
  *.jpg binary
  *.jpeg binary
  *.gif binary
  *.ico binary
  *.webp binary
  *.woff binary
  *.woff2 binary
  ```
- **MIRROR**: комментарии в стиле «что + почему» (DOCS_RULE_PATTERN, как в `docker-compose.yml`).
- **IMPORTS**: нет.
- **GOTCHA**: `text=auto` — Git сам определяет бинарники по содержимому, но явные `binary` защищают от ложной детекции небольших PNG. `.DS_Store` уже `-text` по автодетекту.
- **VALIDATE**: `git check-attr -a images/logo-mini.png` → `binary`; `git check-attr -a package.json` → `text: auto`, `eol: lf`.

### Task 2: Prettier `endOfLine`

- **ACTION**: добавить ключ в `.prettierrc`.
- **IMPLEMENT**:
  ```json
  {
    "semi": false,
    "singleQuote": true,
    "printWidth": 100,
    "trailingComma": "all",
    "endOfLine": "lf"
  }
  ```
- **MIRROR**: существующий плоский JSON без комментариев.
- **GOTCHA**: не ставить `"auto"` — он скрывает смешанные окончания и ломает паритет с CI.
- **VALIDATE**: `bunx prettier --check .prettierrc` → чисто.

### Task 3: Перевыдача рабочей копии в LF

- **ACTION**: применить атрибуты к индексу и рабочему дереву в этом worktree.
- **IMPLEMENT** (только при чистом `git status`):
  ```bash
  git add --renormalize .          # ожидается: без изменений (индекс уже LF)
  git status --short               # пусто или только .gitattributes/.prettierrc
  git rm -rf --cached . -q && git reset -q --hard HEAD   # перевыдача файлов по новым атрибутам
  git ls-files --eol | awk '{print $2}' | sort | uniq -c  # ожидается: w/lf для текстовых
  ```
  Перед `git rm --cached` закоммитить Task 1–2, иначе `reset --hard` их снесёт.
- **MIRROR**: —
- **GOTCHA**: `reset --hard` уничтожает незакоммиченные правки — выполнять только в чистом дереве. Остальные worktree (`habito`, `habito-deps`) получат LF после мержа этой ветки тем же приёмом; до этого их локальный Prettier остаётся красным — это ожидаемо.
- **VALIDATE**: `bunx prettier --check .` без флага `--end-of-line` → «All matched files use Prettier code style!».

### Task 4: Скрипт `check`

- **ACTION**: добавить в `package.json` → `scripts`.
- **IMPLEMENT**:
  ```json
  "check": "bun run db:generate && bun run gen:api && bun run lint && bun run typecheck && bun run test"
  ```
  Порядок = порядок шагов CI: генерация до typecheck, потому что `apps/api/generated` и `apps/web/generated` в `.gitignore` и без них typecheck врёт.
- **MIRROR**: NAMING_CONVENTION — композиция через `&&`, без новых зависимостей.
- **GOTCHA**: `gen:api` перезаписывает `apps/web/generated` и патчит `@ts-nocheck` — это детерминированно и ожидаемо; не добавлять `format` в `check` (проверка, не правка).
- **VALIDATE**: `time bun run check` → exit 0, ≤120 с на машине разработчика.

### Task 5: CI вызывает `check` + `concurrency`

- **ACTION**: отредактировать `.github/workflows/ci.yaml`.
- **IMPLEMENT**:
  1. После `on:` добавить:
     ```yaml
     # Новый push в ту же ветку/PR отменяет незавершённый прогон — агентские
     # сессии пушат часто, очередь из устаревших прогонов бесполезна
     concurrency:
       group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
       cancel-in-progress: true
     ```
  2. В job `quality` заменить пять шагов (`Generate Prisma client`, `Generate API SDK from OpenAPI`, `Lint`, `Typecheck`, `Test`) одним:
     ```yaml
     - name: Check (same command as local `bun run check`)
       run: bun run check
     ```
     Шаг `Install (frozen lockfile)` остаётся отдельным — так падение lock-файла видно как отдельный шаг.
  3. Обновить комментарий в шапке: «lint → typecheck → test» → «`bun run check` (та же команда, что локально)».
- **MIRROR**: CI_STEP_PATTERN — именованные шаги, `run:` однострочный.
- **GOTCHA**: имя job `quality` не менять — оно required в branch protection. Ветка основана на `main` до мержа PR #8 (пин Bun, actions v7): правки держать минимальными, чтобы конфликт при мерже свёлся к соседним строкам; после мержа #8 — `git rebase origin/main`.
- **VALIDATE**: `bunx prettier --check .github/workflows/ci.yaml`; после push — `gh pr checks` показывает `quality` зелёным с одним шагом `Check`.

### Task 6: CLAUDE.md

- **ACTION**: два точечных дополнения.
- **IMPLEMENT**:
  1. В блок «Команды» (после строки `bun run lint | typecheck | test | format`):
     ```bash
     bun run check                  # всё как в CI: generate → lint → typecheck → test
     ```
  2. В «Правила с „почему“» (рядом с правилом про `no-undef`):
     ```markdown
     - **Переводы строк — LF через `.gitattributes` (`eol=lf`)**, Prettier с
       `endOfLine: lf`: с `core.autocrlf=true` на Windows checkout давал CRLF, и
       `prettier --check` красил все файлы без единой ошибки в коде, тогда как CI
       на Linux был зелёным. После смены атрибутов рабочую копию перевыдают
       `git rm -rf --cached . && git reset --hard HEAD` (только в чистом дереве).
     - **`bun run check` — единственная «проверка как в CI»**: job `quality`
       вызывает ровно её, поэтому зелёный локальный `check` означает зелёный CI
       по этому job. Отдельные `lint`/`typecheck`/`test` — для быстрых итераций.
     ```
- **MIRROR**: DOCS_RULE_PATTERN.
- **GOTCHA**: PR #7 тоже правит CLAUDE.md (раздел «Тесты») — не трогать этот раздел, чтобы не плодить конфликт.
- **VALIDATE**: `bunx prettier --check CLAUDE.md`.

### Task 7: Коммит, push, PR-проверка

- **ACTION**: Conventional Commits с `(#9)`, push, PR в `main`.
- **IMPLEMENT**: `chore(ci): single check command, LF via gitattributes, workflow concurrency (#9)`; PR-описание по шаблону проекта (Что / Проверка), ссылка в issue #9.
- **VALIDATE**: все три required checks зелёные; в логе job `quality` один шаг `Check`; при повторном push старый run получает статус `cancelled`.

---

## Testing Strategy

### Unit Tests

N/A — конфигурационная фаза без исполняемой логики. Регрессию существующих
тестов ловит сам `check`.

### Edge Cases Checklist

- [ ] Чистый клон на Windows: `git clone` → файлы LF (проверить `git ls-files --eol`).
- [ ] Чистый клон на Linux/CI: без изменений поведения.
- [ ] Бинарные PNG не изменились в диффе после renormalize (`git status` пуст).
- [ ] `bun.lock` остаётся LF и не «переформатирован».
- [ ] Повторный push в PR → предыдущий run `cancelled`, новый зелёный.
- [ ] Push в `main` (merge) не отменяет PR-прогоны (разные группы).

---

## Validation Commands

### Static Analysis

```bash
bunx prettier --check .
bunx eslint .
```

EXPECT: чисто без флага `--end-of-line auto`.

### Unit Tests

```bash
bun run test
```

EXPECT: api 5 pass, web 1 passed.

### Full Test Suite

```bash
time bun run check
```

EXPECT: exit 0; длительность ≤ 120 с.

### Database Validation

N/A (генерация Prisma входит в `check`).

### Browser Validation

N/A.

### Manual Validation

- [ ] `git check-attr -a package.json images/logo-mini.png` даёт ожидаемые атрибуты.
- [ ] `git ls-files --eol | grep -c 'w/crlf'` → 0.
- [ ] `gh pr checks <N>` → `quality`, `images (api)`, `images (web)` pass.
- [ ] Повторный push → в `gh run list` предыдущий run `cancelled`.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] `bun run check` зелёный локально на Windows без флагов
- [ ] CI job `quality` выполняет `bun run check`
- [ ] Повторный push отменяет устаревший прогон
- [ ] CLAUDE.md содержит `check` и правило про LF с «почему»

## Completion Checklist

- [ ] Code follows discovered patterns
- [ ] Error handling matches codebase style (цепочка `&&`, первый красный останавливает)
- [ ] Logging follows codebase conventions (N/A)
- [ ] Tests follow test patterns (N/A)
- [ ] No hardcoded values
- [ ] Documentation updated (CLAUDE.md)
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk                                                                  | Likelihood | Impact | Mitigation                                                                    |
| --------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| `reset --hard` в грязном дереве стирает чужие правки                  | M          | H      | Task 3 только при пустом `git status`; остальные worktree обновляются после мержа |
| Конфликт в `ci.yaml` с PR #8 (пин Bun, actions v7)                    | H          | L      | минимальный дифф; rebase на `main` после мержа #8                            |
| `gen:api` в `check` замедляет локальный прогон                        | L          | L      | ~3 с; при росте — вынести в `check:fast` без генерации                        |
| Prettier всё ещё красный на Windows после Task 3                      | L          | M      | проверить `git ls-files --eol`; при `w/crlf` — повторить перевыдачу, проверить `core.eol` |
| `cancel-in-progress` отменяет прогон на `main` при частых мержах      | L          | L      | группа включает `github.ref`; для `main` это допустимо (следующий прогон покроет) |

## Notes

- Индекс уже LF (`git ls-files --eol`: 76 × `i/lf w/crlf`), поэтому
  `--renormalize` ожидаемо ничего не меняет; суть фикса — атрибут `eol=lf`,
  который переопределяет `core.autocrlf` при checkout.
- В репо закоммичены `.DS_Store` и `images/.DS_Store` несмотря на `.gitignore`
  — кандидат на отдельный микро-коммит (`git rm --cached`), вне этой фазы.
- После мержа этой ветки каждая параллельная сессия должна один раз выполнить
  перевыдачу рабочей копии (Task 3) в своём worktree — иначе у неё останется
  CRLF и красный Prettier.
