# Plan: Quality Gates Parity — Phase 2 (Hooks)

## Summary

Поставить Lefthook как единственный менеджер git-хуков: pre-commit за ≤10 с
гоняет ESLint и Prettier только по staged-файлам, pre-push выполняет полный
`bun run check` (та же команда, что CI). Хуки ставятся автоматически из
`bun install` через собственный root-скрипт `postinstall` с guard'ами (CI,
Docker, не-git окружение), потому что Bun не исполняет postinstall зависимостей.

## User Story

As a разработчик (и агентская сессия) в habito,
I want чтобы проверки запускались сами на commit и push,
So that красный CI из-за забытого прогона стал невозможен.

## Problem → Solution

Нет ни одного git-хука; `check` существует (Фаза 1), но его надо помнить. →
`lefthook.yml` с двумя хуками; установка — из `bun install` без ручных шагов;
обход в экстренном случае — `LEFTHOOK=0`, не `--no-verify`.

## Metadata

- **Complexity**: Small
- **Source PRD**: `.claude/PRPs/prds/quality-gates-parity.prd.md`
- **PRD Phase**: 2 — Hooks
- **Estimated Files**: 5 (lefthook.yml, scripts/install-hooks.ts, package.json, .gitignore, CLAUDE.md) + bun.lock

---

## UX Design

### Before

```
┌──────────────────────────────────────────────────────────────┐
│ git commit → мгновенно, без проверок                         │
│ git push   → мгновенно; через 1–3 мин CI может покраснеть    │
└──────────────────────────────────────────────────────────────┘
```

### After

```
┌──────────────────────────────────────────────────────────────┐
│ git commit → lefthook pre-commit (≤10 с):                    │
│   eslint  "{staged *.ts,*.mjs,*.vue}"                        │
│   prettier --check --ignore-unknown "{staged}"               │
│   красный → коммит отклонён с выводом ошибок                 │
│ git push   → lefthook pre-push: bun run check (≈40 с)        │
│   красный → push отклонён                                    │
│ экстренно: LEFTHOOK=0 git commit / git push                  │
└──────────────────────────────────────────────────────────────┘
```

### Interaction Changes

| Touchpoint        | Before            | After                                             | Notes                                      |
| ----------------- | ----------------- | ------------------------------------------------- | ------------------------------------------ |
| `bun install`     | ставит пакеты     | + `lefthook install` (хуки в `.git/hooks`)        | пропуск при `CI`, `--ignore-scripts`, не-git |
| `git commit`      | без проверок      | eslint + prettier по staged                       | параллельно, только изменённые файлы       |
| `git push`        | без проверок      | `bun run check`                                   | идентично CI job `quality`                 |
| Ручной прогон     | —                 | `bunx lefthook run pre-commit` / `pre-push`       | без коммита                                |
| Другие worktree   | —                 | хук общий; без lefthook в node_modules → пропуск  | после мержа `bun install` в каждом         |

---

## Mandatory Reading

| Priority       | File                         | Lines   | Why                                                                 |
| -------------- | ---------------------------- | ------- | ------------------------------------------------------------------- |
| P0 (critical)  | `scripts/dev.ts`             | 1-25, 44-74 | стиль скриптов на Bun: шапка-комментарий, `spawnSync` из `bun`, `step()`, `process.exit(1)` |
| P0 (critical)  | `package.json`               | 9-19    | куда добавить `postinstall` и dev-зависимость                       |
| P1 (important) | `apps/api/Dockerfile`, `apps/web/Dockerfile` | 12-13 | оба используют `--ignore-scripts` → root postinstall в Docker не запускается |
| P1 (important) | `eslint.config.mjs`          | all     | `ignores` для generated — eslint по явным файлам нужен `--no-warn-ignored` |
| P1 (important) | `.prettierignore`            | all     | `.claude/`, `specs/`, `images/` игнорируются — `--ignore-unknown` для png и прочего |
| P1 (important) | `CLAUDE.md`                  | 8-22, 86-98 | блок «Команды» и хвост «Правил с „почему“» — точки вставки     |
| P2 (reference) | `.github/workflows/ci.yaml`  | job `quality` | хук pre-push обязан совпадать с ним (`bun run check`)         |

## External Documentation

| Topic                           | Source                                                                | Key Takeaway                                                                                     |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Lefthook jobs/run/glob          | lefthook.dev/configuration (jobs.md, run.md, glob.md)                 | `jobs:` с `name/glob/run`; шаблон `{staged_files}`; двойные кавычки вокруг шаблона «полезны на Windows» |
| Lefthook skip                   | docs/configuration/skip.md                                            | `skip: [merge, rebase]` — не гонять на merge/rebase; `LEFTHOOK=0` отключает хук целиком          |
| Lefthook hook template          | internal/templates/hook.tmpl                                          | ищет бинарник в `node_modules/lefthook-<os>-<cpu>` от git top-level; если не найден — печатает и выходит 0 (коммит проходит) |
| Lefthook npm postinstall        | lefthook@2.2.2/postinstall.js                                         | вызывает `lefthook install`; пропускает при `CI` (если не `LEFTHOOK=1`); у нас не выполняется — Bun блокирует postinstall зависимостей |
| Lefthook на Windows             | internal/system/sh_windows.go                                         | команды исполняются через Git Bash `sh.exe` (из хука — `sh` из PATH), синтаксис POSIX на всех ОС |
| Bun lifecycle scripts           | bun.com/docs/install/lifecycle                                        | postinstall зависимостей блокируются (allow-list `trustedDependencies`); **root-скрипты проекта исполняются всегда**, в т.ч. при `--frozen-lockfile` (проверено: ROOT_POSTINSTALL_RAN на повторном install); `--ignore-scripts` отключает всё |
| Bun untrusted сейчас            | `bun pm untrusted` в репо                                             | 0 заблокированных скриптов → `trustedDependencies` не нужен, и его появление не сломает другие пакеты |

---

## Patterns to Mirror

### NAMING_CONVENTION

```ts
// SOURCE: scripts/dev.ts:1-11 — скрипт на Bun с шапкой: что делает, как вызывать, порядок шагов
// Dev-оркестратор (по образцу `ranch dev`): одна команда поднимает зависимости
// и dev-серверы с hot-reload.
//
//   bun dev            — api + web (+ postgres + redis в Docker)
```

Скрипты лежат в `scripts/*.ts`, вызываются из `package.json` как `bun scripts/<name>.ts`.

### ERROR_HANDLING

```ts
// SOURCE: scripts/dev.ts:71-74 — понятное сообщение + exit 1; для «мягких» пропусков — просто return/лог
if (run(['bun', 'install', '--frozen-lockfile']) !== 0) {
  console.error('Зависимости не в порядке — см. вывод выше.')
  process.exit(1)
}
```

### LOGGING_PATTERN

```ts
// SOURCE: scripts/dev.ts:60 — шаги печатаются как «▸ сообщение»
const step = (message: string) => console.log(`\n▸ ${message}`)
```

### SPAWN_PATTERN

```ts
// SOURCE: scripts/dev.ts:11, 44-53 — spawnSync из 'bun', stdout/stderr inherit или pipe
import { spawnSync, spawn } from 'bun'
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
```

### DOCS_RULE_PATTERN

```markdown
<!-- SOURCE: CLAUDE.md:95-97 — правило = жирный тезис + «почему» -->
- **`bun run check` — единственная «проверка как в CI»**: job `quality`
  вызывает ровно её, поэтому зелёный локальный `check` означает зелёный CI
  по этому job. Отдельные `lint`/`typecheck`/`test` — для быстрых итераций.
```

### TEST_STRUCTURE

N/A — исполняемой домен-логики нет; `scripts/install-hooks.ts` проверяется
поведенчески (см. Validation Commands), как и `scripts/dev.ts`.

---

## Files to Change

| File                       | Action | Justification                                                                      |
| -------------------------- | ------ | ---------------------------------------------------------------------------------- |
| `lefthook.yml`             | CREATE | конфиг хуков                                                                       |
| `scripts/install-hooks.ts` | CREATE | установка хуков из `bun install` с guard'ами (CI / не-git / `LEFTHOOK=0`)          |
| `package.json`             | UPDATE | devDependency `lefthook`, скрипт `postinstall`, скрипт `hooks` (ручная установка)  |
| `bun.lock`                 | UPDATE | результат `bun add -d lefthook`                                                    |
| `.gitignore`               | UPDATE | `lefthook-local.yml` — личные переопределения не коммитятся                        |
| `CLAUDE.md`                | UPDATE | команды `lefthook run`, правило про хуки с «почему»                                |

## NOT Building

- Агент `cto` и раздел «Проверки» в CLAUDE.md (Phase 3) — здесь только одно правило про хуки.
- Typecheck в pre-commit — решено: только в pre-push (через `check`), иначе коммит ждёт `nuxt typecheck` 20–40 с.
- `commit-msg` хук с проверкой Conventional Commits — отдельная идея, не в PRD.
- `stage_fixed` / автоформат в pre-commit — хук проверяет, а не правит (как `check`).
- `trustedDependencies` — не нужен: хуки ставит собственный root-скрипт.

---

## Step-by-Step Tasks

### Task 1: Зависимость `lefthook`

- **ACTION**: `bun add -d lefthook@^2.2.2` в корне (worktree `habito-gates`).
- **IMPLEMENT**: команда добавит `"lefthook": "^2.2.2"` в `devDependencies` корневого `package.json` и обновит `bun.lock`; Bun поставит optional-пакет `lefthook-windows-x64` (и соответствующий в CI/Linux).
- **MIRROR**: dev-зависимости корня — только инструменты (eslint, prettier, typescript).
- **GOTCHA**: postinstall самого пакета Bun заблокирует — это ожидаемо и не нужно (ставим хуки сами). Проверить, что бинарник разрешается: `bunx lefthook version`.
- **VALIDATE**: `bunx lefthook version` печатает `2.2.2`; `bun pm untrusted` показывает `lefthook` в заблокированных — ок.

### Task 2: `lefthook.yml`

- **ACTION**: создать в корне.
- **IMPLEMENT**:
  ```yaml
  # yaml-language-server: $schema=https://lefthook.dev/schema.json
  # Git-хуки (Принцип VII): pre-commit — быстрые проверки только staged-файлов,
  # pre-push — полный `bun run check`, та же команда, что CI job quality.
  # Обход в экстренном случае: LEFTHOOK=0 git commit (не --no-verify — он глушит
  # и будущие хуки). Личные переопределения — lefthook-local.yml (в .gitignore).
  min_version: 2.0.0

  pre-commit:
    parallel: true
    skip:
      - merge
      - rebase
    jobs:
      - name: eslint
        glob: '*.{ts,mjs,vue}'
        # --no-warn-ignored: явно переданный файл из ignores (generated/) — не warning
        run: bunx eslint --no-warn-ignored "{staged_files}"
      - name: prettier
        # --ignore-unknown: png/lock и прочее без парсера не считаются ошибкой
        run: bunx prettier --check --ignore-unknown "{staged_files}"

  pre-push:
    jobs:
      - name: check
        run: bun run check
  ```
- **MIRROR**: комментарии «что + почему», как в `docker-compose.yml` и `ci.yaml`.
- **IMPORTS**: нет.
- **GOTCHA**: шаблон в двойных кавычках — рекомендация Lefthook для Windows (имена с пробелами, например `images/Habito Play-selection.png`). `glob` у prettier не задаём: пусть сам решает по `.prettierignore` и `--ignore-unknown`.
- **VALIDATE**: `bunx lefthook validate` (если команда есть в 2.2) либо `bunx lefthook run pre-commit` на чистом индексе → «no files for inspection»/зелёный.

### Task 3: `scripts/install-hooks.ts`

- **ACTION**: создать скрипт установки хуков.
- **IMPLEMENT**:
  ```ts
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

  const ROOT = new URL('..', import.meta.url).pathname

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
  ```
- **MIRROR**: NAMING_CONVENTION (шапка), SPAWN_PATTERN, LOGGING_PATTERN (`▸`), ERROR_HANDLING (мягкий пропуск — предупреждение, не падение, потому что это postinstall).
- **IMPORTS**: `import { spawnSync } from 'bun'`.
- **GOTCHA**: `ROOT` через `new URL('..', import.meta.url).pathname` — как в dev.ts (на Windows даёт путь вида `/E:/...`, Bun его понимает, dev.ts так работает). В worktree `git rev-parse --git-dir` возвращает `.git/worktrees/<name>` — тоже успех, хуки Lefthook кладёт в общий `git rev-parse --git-path hooks`.
- **VALIDATE**: `bun scripts/install-hooks.ts` → печатает шаг и «sync hooks: ✔️»; `CI=true bun scripts/install-hooks.ts` → молча exit 0; `LEFTHOOK=0 ...` → молча exit 0.

### Task 4: `package.json` — скрипты

- **ACTION**: добавить два скрипта.
- **IMPLEMENT**:
  ```json
  "postinstall": "bun scripts/install-hooks.ts",
  "hooks": "lefthook install"
  ```
  `postinstall` — после `"dev"`; `hooks` — рядом с `check`.
- **MIRROR**: `"dev": "bun scripts/dev.ts"`.
- **GOTCHA**: Dockerfile'ы ставят с `--ignore-scripts` → postinstall там не исполняется (не трогать Dockerfile). В CI `CI=true` → скрипт выходит сразу.
- **VALIDATE**: `bun install` печатает «▸ Установка git-хуков» и `lefthook` отчёт; `bun install --frozen-lockfile` — то же (root-скрипт исполняется повторно, это нормально и быстро).

### Task 5: `.gitignore`

- **ACTION**: добавить в блок «Служебное».
- **IMPLEMENT**:
  ```gitignore
  # Личные переопределения хуков (lefthook-local.yml — merge поверх lefthook.yml)
  lefthook-local.yml
  ```
- **MIRROR**: комментарий + паттерн, как у остальных блоков.
- **VALIDATE**: `git check-ignore lefthook-local.yml` → путь напечатан.

### Task 6: CLAUDE.md

- **ACTION**: команды + правило.
- **IMPLEMENT**:
  1. В блок «Команды» после строки `bun run check ...`:
     ```bash
     bunx lefthook run pre-commit   # хуки вручную: pre-commit (staged lint/format) | pre-push (check)
     ```
  2. В «Правила с „почему“» после правила про `bun run check`:
     ```markdown
     - **Git-хуки — Lefthook, ставятся из `bun install` собственным
       `postinstall` ([scripts/install-hooks.ts](scripts/install-hooks.ts))**: Bun
       не исполняет postinstall зависимостей, поэтому штатная установка пакета
       `lefthook` хуки бы не создала. pre-commit гоняет eslint/prettier только по
       staged-файлам (≤10 с), pre-push — полный `bun run check`. Экстренный обход —
       `LEFTHOOK=0 git commit`, не `--no-verify`. Хуки общие для всех worktree:
       если в worktree нет `node_modules/lefthook-*`, хук печатает «Can't find
       lefthook» и пропускает проверку — после мержа сделать `bun install` в
       каждом.
     ```
- **MIRROR**: DOCS_RULE_PATTERN.
- **GOTCHA**: раздел «Тесты» не трогать (PR #7). Раздел «Проверки» целиком — Phase 3.
- **VALIDATE**: `bunx prettier --check CLAUDE.md`.

### Task 7: Поведенческая проверка хуков

- **ACTION**: убедиться, что хуки реально блокируют и пропускают.
- **IMPLEMENT**:
  ```bash
  bun install                                   # ставит хуки
  cat "$(git rev-parse --git-path hooks)/pre-commit" | head -5   # шапка lefthook
  # 1) красный pre-commit
  printf 'const x = {a:1}\n' > scripts/tmp-bad.ts && git add scripts/tmp-bad.ts
  git commit -q -m tmp; echo "exit=$?"         # ожидается ≠0, prettier/eslint в выводе
  git reset -q scripts/tmp-bad.ts && rm scripts/tmp-bad.ts
  # 2) зелёный pre-commit на реальных файлах
  time bunx lefthook run pre-commit --all-files # или на staged после git add -A
  # 3) pre-push вручную
  bunx lefthook run pre-push                    # = bun run check, зелёный
  # 4) обход
  LEFTHOOK=0 bunx lefthook run pre-commit       # пропуск
  ```
- **GOTCHA**: не оставлять `scripts/tmp-bad.ts`; не коммитить тестовые файлы. `prisma generate` внутри `check` может один раз спросить про установку agent-skills — в хуке без TTY пропускается; если спросит в терминале, ответить «нет».
- **VALIDATE**: сценарий 1 — exit ≠ 0; сценарии 2–4 — exit 0; pre-commit на всех файлах ≤10 с.

### Task 8: Коммит, push, PR

- **ACTION**: коммит `chore(hooks): lefthook pre-commit and pre-push via root postinstall (#9)`; push в ту же ветку `chore/9-quality-gates-parity` (PR #10 уже открыт — дополнить описание секцией «Фаза 2»).
- **VALIDATE**: pre-push хук сам прогонит `check` при `git push`; CI зелёный; в логе job `quality` нет попытки `lefthook install` (CI=true).

---

## Testing Strategy

### Unit Tests

N/A — конфигурация и glue-скрипт; поведенческая проверка в Task 7.

### Edge Cases Checklist

- [ ] `bun install` в CI (`CI=true`) — хуки не ставятся, install зелёный.
- [ ] Docker build (`--ignore-scripts`) — postinstall не исполняется, образы собираются.
- [ ] Commit в другом worktree без lefthook в node_modules — проходит с сообщением «Can't find lefthook».
- [ ] Staged-файл с пробелом в имени (`images/Habito Play-selection.png`) — prettier с `--ignore-unknown` не падает.
- [ ] Только md/json staged — eslint job пропускается (glob), prettier проверяет.
- [ ] Merge/rebase — pre-commit пропущен (`skip`).
- [ ] `LEFTHOOK=0` — хук не запускается.

---

## Validation Commands

### Static Analysis

```bash
bunx eslint scripts/install-hooks.ts
bunx prettier --check lefthook.yml scripts/install-hooks.ts package.json .gitignore CLAUDE.md
```

EXPECT: чисто.

### Unit Tests

```bash
bun run test
```

EXPECT: без регрессий (api 5, web 1).

### Full Test Suite

```bash
bun run check
```

EXPECT: exit 0.

### Database Validation

N/A.

### Browser Validation

N/A.

### Manual Validation

- [ ] `bunx lefthook version` → 2.2.2.
- [ ] `git rev-parse --git-path hooks` содержит `pre-commit` и `pre-push` с шапкой lefthook.
- [ ] Task 7, сценарии 1–4.
- [ ] `CI=true bun install --frozen-lockfile` — без «▸ Установка git-хуков».
- [ ] `docker build -q -f apps/api/Dockerfile .` — собирается.

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Коммит с ошибкой prettier/eslint блокируется, пуш с красным `check` блокируется
- [ ] `bun install` на чистом клоне ставит хуки без ручных шагов
- [ ] CI и Docker не затронуты (нет `lefthook install` в логах)
- [ ] CLAUDE.md описывает хуки и обход

## Completion Checklist

- [ ] Code follows discovered patterns (скрипт в стиле dev.ts)
- [ ] Error handling matches codebase style (мягкий пропуск в postinstall)
- [ ] Logging follows codebase conventions (`▸`)
- [ ] Tests follow test patterns (N/A)
- [ ] No hardcoded values
- [ ] Documentation updated (CLAUDE.md)
- [ ] No unnecessary scope additions
- [ ] Self-contained — no questions needed during implementation

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                                 |
| -------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Optional-пакет `lefthook-windows-x64` не ставится Bun'ом              | L          | H      | Task 1 проверяет `bunx lefthook version` первым; запасной вариант — husky + lint-staged |
| `ROOT` с `URL.pathname` на Windows даёт `/E:/...` и spawnSync не находит cwd | L     | M      | dev.ts уже использует этот приём; при проблеме — `fileURLToPath` из `node:url` |
| pre-commit дольше 10 с из-за старта bunx eslint                      | M          | L      | параллельный запуск; при росте — `glob` уже режет список; замерить в Task 7 |
| `check` в pre-push спрашивает prisma про agent-skills                | L          | L      | без TTY пропускается; задокументировано в GOTCHA                          |
| Хук мешает другим worktree на ветках без lefthook                    | L          | L      | шаблон хука выходит 0, если бинарник не найден; записано в CLAUDE.md       |

## Notes

- Решение «typecheck только в pre-push» закрывает первый open question PRD.
- `postinstall` Bun исполняет и при повторном `bun install --frozen-lockfile`
  (проверено в scratch-тесте), поэтому `lefthook install` будет вызываться при
  каждой установке — он идемпотентен и быстрый.
- После мержа PR #10 каждому worktree нужен один `bun install`, чтобы хуки
  находили бинарник; до этого они пропускаются с сообщением.
