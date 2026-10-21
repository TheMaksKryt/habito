# Plan: Quality Gates Parity — Phase 6 (OpenAPI contract in git + drift check)

Тикет: https://github.com/TheMaksKryt/habito/issues/13

## Summary

Взять `apps/api/openapi.json` под контроль версий и добавить в `bun run check`
шаг дрейфа: после `gen:api` контракт в рабочей копии обязан совпадать с
проиндексированным (`git diff --exit-code`). Локально это заставляет
разработчика осознанно `git add` изменённый контракт, в CI ловит PR, где
схему изменили, а контракт не обновили. Побочный эффект — главный: изменения
API видны ревьюеру прямо в diff PR (Принцип III, contract-first).

## User Story

As a ревьюер PR (и автор, меняющий схему Elysia),
I want видеть изменения контракта API в diff и не иметь возможности
«забыть» обновить его,
So that контракт остаётся источником правды, а не побочным продуктом сборки.

## Problem → Solution

`openapi.json` экспортируется при каждом `check` и сборке образа web, но
ignored: ревью не видит, что изменился контракт; «дрейф» никем не измеряется.
Дрейф самого SDK невозможен — `check` регенерирует его всегда. →
Контракт в git + `git diff --exit-code -- apps/api/openapi.json` в хвосте
`check`. SDK (`apps/web/generated/`) остаётся untracked.

## Metadata

- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/quality-gates-parity.prd.md`
- **PRD Phase**: 6 — SDK drift (Could)
- **Estimated Files**: 4 (`.gitignore`, `package.json`, `CLAUDE.md`) + новый tracked `apps/api/openapi.json`

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────┐
│ PR меняет t.Object в health.controller.ts                    │
│ → diff PR: только .ts; контракт невидим                      │
│ → check: gen:api молча перегенерировал всё, зелёный          │
└──────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────┐
│ PR меняет t.Object → bun run check:                          │
│   gen:api → openapi.json перезаписан                         │
│   git diff --exit-code apps/api/openapi.json → КРАСНЫЙ, diff │
│ dev: git add apps/api/openapi.json → check зелёный           │
│ → diff PR: .ts + openapi.json — ревьюер видит контракт       │
│ CI: контракт в коммите ≠ экспорт из кода → quality красный   │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint              | Before                         | After                                                     | Notes                                      |
| ----------------------- | ------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| `bun run check`         | 5 шагов                        | + `git diff --exit-code -- apps/api/openapi.json`         | ~0.1 с; при дрейфе печатает сам diff       |
| Изменение схемы API     | ничего дополнительно           | `git add apps/api/openapi.json` перед коммитом/пушем      | pre-push подскажет красным `check`         |
| Ревью PR                | контракт не виден              | `openapi.json` в diff                                     | `.prettierignore` оставляет файл как есть  |
| Docker web              | стадия `api-spec` экспортирует | без изменений (экспорт из исходников остаётся)            | источник правды — код; git-копия для ревью |
| Агент `cto`             | —                              | получает новый гейт автоматически (внутри `check`)        |                                            |

---

## Mandatory Reading

| Priority       | File                                  | Lines | Why                                                                          |
| -------------- | ------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| P0 (critical)  | `apps/api/scripts/export-openapi.ts`  | all   | как создаётся файл: `app.handle('/openapi/json')`, `JSON.stringify(spec, null, 2) + '\n'`, детерминирован (проверено двумя запусками) |
| P0 (critical)  | `package.json`                        | 19    | строка `check` — точка вставки                                               |
| P1 (important) | `.gitignore`                          | 16-19 | блок «Сгенерированный код»: убрать только `apps/api/openapi.json`            |
| P1 (important) | `.prettierignore`                     | 8     | `apps/api/openapi.json` остаётся в ignore — файл генерируется, формат не наш |
| P1 (important) | `CLAUDE.md`                           | 66-78 | раздел «Contract-first цепочка» — куда добавить правило                      |
| P1 (important) | `CLAUDE.md`                           | 32    | таблица «Проверки», строка `check` — обновить состав                         |
| P1 (important) | `apps/api/src/modules/health/health.controller.ts` | 30 | `summary: 'Состояние API и его зависимостей'` — строка для сценария дрейфа |
| P2 (reference) | `apps/web/Dockerfile`                 | стадия `api-spec` | экспорт из исходников остаётся; git-копия не используется сборкой |
| P2 (reference) | `.github/workflows/ci.yaml`           | 33    | job `quality` вызывает `check` — правок в CI не нужно                        |

## External Documentation

| Topic                     | Source                    | Key Takeaway                                                                                   |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `git diff --exit-code`    | git-scm.com/docs/git-diff | без ревизий сравнивает рабочую копию с индексом; exit 1 при различиях; печатает diff — сразу видно, что изменилось в контракте |
| Детерминизм экспорта      | проверено 2026-10-21      | два подряд `openapi:export` дают побайтово одинаковый файл (3529 байт), volatile-полей (дата, host) нет |

---

## Patterns to Mirror

### SCRIPT_COMPOSITION

```jsonc
// SOURCE: package.json:19 — check = цепочка через &&, первый красный останавливает
"check": "bun run db:generate && bun run gen:api && bun run lint && bun run typecheck && bun run test",
```

### GITIGNORE_BLOCK

```gitignore
# SOURCE: .gitignore:16-19 — блок с комментарием «почему»
# Сгенерированный код (воссоздаётся: bun run gen:api / db:generate)
apps/web/generated/
apps/api/openapi.json
apps/api/generated/
```

### DOCS_RULE_PATTERN

```markdown
<!-- SOURCE: CLAUDE.md:74-75 -->
- `bun run gen:api` регенерирует всё; Docker-образ web собирает спеку из
  исходников api отдельной стадией (паттерн ranch).
```

### TEST_STRUCTURE

N/A — конфигурация; поведение проверяется сценарием дрейфа (Task 4).

---

## Files to Change

| File                     | Action | Justification                                                  |
| ------------------------ | ------ | -------------------------------------------------------------- |
| `.gitignore`             | UPDATE | убрать `apps/api/openapi.json` из ignore                        |
| `apps/api/openapi.json`  | ADD    | контракт под контролем версий                                   |
| `package.json`           | UPDATE | `check` += шаг дрейфа                                           |
| `CLAUDE.md`              | UPDATE | правило в «Contract-first», состав `check` в «Команды» и «Проверки» |

## NOT Building

- Трекинг `apps/web/generated/` — SDK регенерируется каждым `check`, дрейф невозможен; 16 файлов с `@ts-nocheck` в git только шумели бы в diff.
- Изменение Docker-стадии `api-spec` на `COPY` git-копии — экспорт из исходников надёжнее (образ собирается из кода, а не из артефакта).
- Отдельный CI-шаг — дрейф внутри `check`, паритет локально/CI сохраняется автоматически.
- Breaking-change детектор контракта (oasdiff) — отдельная идея, не в PRD.

---

## Step-by-Step Tasks

### Task 1: `.gitignore`

- **ACTION**: убрать строку `apps/api/openapi.json`, обновить комментарий.
- **IMPLEMENT**:
  ```gitignore
  # Сгенерированный код (воссоздаётся: bun run gen:api / db:generate).
  # apps/api/openapi.json — исключение: контракт трекается, чтобы изменения API
  # были видны в diff PR; свежесть проверяет `bun run check` (git diff --exit-code)
  apps/web/generated/
  apps/api/generated/
  ```
- **MIRROR**: GITIGNORE_BLOCK.
- **GOTCHA**: `.prettierignore` не трогать — файл генерируется с отступами `JSON.stringify(…, null, 2)`, Prettier мог бы переформатировать и создать ложный дрейф.
- **VALIDATE**: `git check-ignore apps/api/openapi.json` → пусто (exit 1).

### Task 2: Добавить контракт в git

- **ACTION**: экспортировать и проиндексировать.
- **IMPLEMENT**:
  ```bash
  bun run --filter api openapi:export
  git add apps/api/openapi.json
  ```
- **GOTCHA**: `.gitattributes` даёт LF; `Bun.write` пишет LF — на Windows файл не превратится в CRLF. Коммитить вместе с Task 1 и 3 одним коммитом.
- **VALIDATE**: `git diff --cached --stat` показывает `apps/api/openapi.json | +N`.

### Task 3: `check` += дрейф

- **ACTION**: обновить `package.json`.
- **IMPLEMENT**:
  ```json
  "check": "bun run db:generate && bun run gen:api && bun run lint && bun run typecheck && bun run test && git diff --exit-code -- apps/api/openapi.json",
  ```
- **MIRROR**: SCRIPT_COMPOSITION.
- **GOTCHA**: шаг последний, чтобы красный дрейф не прятал ошибки lint/typecheck/test. `git diff --exit-code` сравнивает с индексом: после `git add` контракта локальный `check` зелёный ещё до коммита. В CI индекс = коммит → ловит забытый контракт. Без git (Docker) `check` не запускается — ок.
- **VALIDATE**: `bun run check` зелёный на чистом дереве.

### Task 4: Сценарий дрейфа

- **ACTION**: доказать, что гейт срабатывает и отпускает.
- **IMPLEMENT**:
  ```bash
  # 1) меняем контракт в коде (health.controller.ts:30)
  perl -pi -e "s/summary: 'Состояние API и его зависимостей'/summary: 'Состояние API (drift test)'/" apps/api/src/modules/health/health.controller.ts
  bun run check; echo "exit=$?"            # ожидается ≠0, в выводе diff по openapi.json
  git add apps/api/openapi.json && bun run check; echo "exit=$?"   # ожидается 0
  # 2) откат
  git checkout -- apps/api/src/modules/health/health.controller.ts
  git reset -q apps/api/openapi.json && bun run --filter api openapi:export && git status --short
  ```
- **GOTCHA**: после отката `openapi.json` обязан совпасть с индексом (`git status` пуст). Не запускать Task 4 с незакоммиченными правками Task 1–3 в индексе, которые нужно сохранить — `git reset` по пути трогает только контракт.
- **VALIDATE**: первая проверка красная с diff, вторая зелёная, после отката дерево чистое.

### Task 5: CLAUDE.md

- **ACTION**: правило и состав `check`.
- **IMPLEMENT**:
  1. «Contract-first цепочка», после bullet про `gen:api`:
     ```markdown
     - **`apps/api/openapi.json` трекается в git**, хотя генерируется: так
       изменение контракта видно в diff PR, а не только в `.ts`. Свежесть
       гарантирует хвост `bun run check` — `git diff --exit-code` по этому файлу:
       изменил схему → `git add apps/api/openapi.json`, иначе pre-push и CI
       красные. SDK (`apps/web/generated/`) не трекается — его `check`
       регенерирует всегда, дрейфовать нечему.
     ```
  2. «Команды»: `bun run check   # всё как в CI: generate → lint → typecheck → test → дрейф контракта`.
  3. «Проверки», строка `check`: `generate → lint → typecheck → test → openapi drift`.
- **MIRROR**: DOCS_RULE_PATTERN.
- **VALIDATE**: `bunx prettier --check CLAUDE.md`.

### Task 6: Коммит, PR, мерж

- **ACTION**: `chore(api): track openapi.json and fail check on contract drift (#13)`; push; PR в `main` с `Closes #13`; после зелёного CI — squash-merge (как предыдущие).
- **GOTCHA**: PR не меняет UI-пути → ожидается `e2e` skipped.
- **VALIDATE**: `quality` зелёный; в diff PR виден `apps/api/openapi.json`.

---

## Testing Strategy

### Unit Tests

N/A.

### Edge Cases Checklist

- [ ] Чистое дерево → `check` зелёный (нет ложного дрейфа).
- [ ] Схема изменена, контракт не добавлен → красный с diff.
- [ ] Контракт добавлен в индекс → зелёный до коммита.
- [ ] CI на коммите с устаревшим контрактом → `quality` красный на последнем шаге.
- [ ] Windows: файл остаётся LF после экспорта (`git ls-files --eol apps/api/openapi.json`).

---

## Validation Commands

### Static Analysis

```bash
bunx prettier --check CLAUDE.md package.json
git check-ignore apps/api/openapi.json; echo "exit=$? (ожидается 1)"
```

### Unit Tests

```bash
bun run test
```

### Full Test Suite

```bash
bun run check
```

EXPECT: exit 0 на чистом дереве; Task 4 — красный/зелёный по сценарию.

### Database Validation

N/A.

### Browser Validation

N/A.

### Manual Validation

- [ ] `git ls-files apps/api/openapi.json` → файл трекается.
- [ ] diff PR содержит `openapi.json`.
- [ ] `e2e` skipped на этом PR.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `check` ловит дрейф контракта и отпускает после `git add`
- [ ] Контракт в git, SDK — нет
- [ ] CLAUDE.md объясняет, зачем и что делать при красном дрейфе
- [ ] CI зелёный, PR смержен

## Completion Checklist

- [ ] Code follows discovered patterns
- [ ] Error handling matches codebase style (цепочка `&&`, diff в выводе)
- [ ] Logging follows codebase conventions (N/A)
- [ ] Tests follow test patterns (N/A)
- [ ] No hardcoded values
- [ ] Documentation updated
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk                                                            | Likelihood | Impact | Mitigation                                                        |
| --------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Экспорт станет недетерминированным (дата/версия в spec)         | L          | M      | сейчас проверено; при появлении `APP_VERSION` в spec — фиксировать значение в экспорте |
| Prettier/EOL переформатируют файл и создадут ложный дрейф        | L          | M      | `.prettierignore` сохраняется; `.gitattributes` LF; экспорт пишет LF |
| Разработчик правит `openapi.json` руками                         | L          | L      | следующий `check` перезапишет из кода и покажет diff — правка невозможна по построению |
| Шум в diff PR при массовых изменениях схемы                     | M          | L      | это и есть цель: контракт на ревью                               |

## Notes

- Это Could-фаза: PRD #9 закрыт, работа идёт по новому тикету #13.
- «SDK drift» из PRD переосмыслен как «contract drift»: SDK регенерируется
  каждым `check`, а вот контракт без трекинга невидим ревью. Это и есть
  полезная половина идеи.
