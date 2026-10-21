# Implementation Report: Quality Gates Parity — Phase 2 (Hooks)

## Summary

Lefthook 2.2.2 поставлен как менеджер git-хуков: pre-commit параллельно гоняет
ESLint и Prettier по staged-файлам (~1.3 с на всём репо), pre-push выполняет
`bun run check`. Хуки ставятся из `bun install` собственным root-скриптом
`scripts/install-hooks.ts` с пропуском при `CI`, `LEFTHOOK=0` и вне git.
CLAUDE.md дополнен командой и правилом с «почему». PR #10 (та же ветка, что
Фаза 1).

## Assessment vs Reality

| Metric        | Predicted (Plan) | Actual                                             |
| ------------- | ---------------- | -------------------------------------------------- |
| Complexity    | Small            | Small                                              |
| Confidence    | 8                | 8 — два отклонения, оба предсказаны в рисках плана |
| Files Changed | 5 + bun.lock     | 5 + bun.lock                                       |

## Tasks Completed

| #   | Task                           | Status | Notes                                                                                              |
| --- | ------------------------------ | ------ | -------------------------------------------------------------------------------------------------- |
| 1   | Зависимость `lefthook`         | done   | `bunx lefthook version` → 2.2.2; optional-пакет `lefthook-windows-x64` поставлен Bun'ом            |
| 2   | `lefthook.yml`                 | done   | Отклонение: шаблон `{staged_files}` без двойных кавычек (см. ниже)                                  |
| 3   | `scripts/install-hooks.ts`     | done   | Отклонение: `ROOT` через `fileURLToPath` (см. ниже)                                                |
| 4   | `package.json` скрипты         | done   | `postinstall`, `hooks`                                                                             |
| 5   | `.gitignore`                   | done   | `lefthook-local.yml`                                                                               |
| 6   | CLAUDE.md                      | done   | команда + правило                                                                                  |
| 7   | Поведенческая проверка         | done   | красный коммит заблокирован (eslint `no-unused-vars`, prettier); all-files 1.4 с; pre-push 9 с; `LEFTHOOK=0` пропуск |
| 8   | Коммит, push, PR               | done   | хуки сработали на реальном commit/push; PR #10 дополнен                                            |

## Validation Results

| Level           | Status | Notes                                                                                   |
| --------------- | ------ | --------------------------------------------------------------------------------------- |
| Static Analysis | Pass   | eslint на `install-hooks.ts`, prettier на yml/ts/json/md                                |
| Unit Tests      | Pass   | без новых тестов (конфигурация + glue-скрипт); api 5 / web 1 через `check`              |
| Build           | Pass   | `bun run check` exit 0 (9 с с тёплыми кэшами); `docker build` api-образа — ok           |
| Integration     | Pass   | хук из чужого worktree без lefthook в node_modules → сообщение и exit 0, коммит проходит |
| Edge Cases      | Pass   | `CI=true bun install` без установки хуков; `--ignore-scripts` в Docker; merge/rebase skip в конфиге; имя с пробелом (`images/Habito Play-selection.png`) после фикса кавычек |

## Files Changed

| File                       | Action  | Lines      |
| -------------------------- | ------- | ---------- |
| `lefthook.yml`             | CREATED | +27        |
| `scripts/install-hooks.ts` | CREATED | +39        |
| `package.json`             | UPDATED | +3         |
| `bun.lock`                 | UPDATED | lefthook + optional-бинарники |
| `.gitignore`               | UPDATED | +3         |
| `CLAUDE.md`                | UPDATED | +11        |

## Deviations from Plan

1. **`{staged_files}` без двойных кавычек.** План (по совету документации
   Lefthook) ставил шаблон в `"…"`. На Windows lefthook исполняет job как
   `sh.exe -c "<команда>"`, и вложенные двойные кавычки ломают имена с
   пробелами: `images/Habito Play-selection.png` превращался в два аргумента,
   prettier падал с «No files matching the pattern». Без кавычек lefthook сам
   экранирует такие имена одинарными. Зафиксировано комментарием в
   `lefthook.yml`.
2. **`ROOT` через `fileURLToPath`, а не `URL.pathname`.** `pathname` даёт
   `/E:/…`, и `spawnSync` с таким cwd падает `ENOENT: uv_spawn 'git'` — ошибка
   указывает на команду, а не на каталог. Риск был в плане, запасной вариант
   применён. `scripts/dev.ts` использует `pathname` и, вероятно, подвержен той
   же проблеме — вне этой фазы, стоит проверить отдельно.

## Issues Encountered

- `bun pm untrusted` показал 0 заблокированных: `lefthook` входит в дефолтный
  allow-list Bun, и его собственный postinstall выполнился при `bun add`
  (поставил только `prepare-commit-msg`, конфига ещё не было). Это не
  отменяет наш `postinstall`: при `--frozen-lockfile` скрипты зависимостей
  для уже установленных пакетов не запускаются, а root-скрипт — всегда.
- В плане валидация `prettier --check .gitignore` некорректна: у файла нет
  парсера, prettier завершается ошибкой. Проверять с `--ignore-unknown` или не
  включать.

## Tests Written

| Test File | Tests | Coverage                                      |
| --------- | ----- | --------------------------------------------- |
| —         | 0     | поведенческие сценарии Task 7 вместо unit     |

## Next Steps

- [ ] После мержа PR #10: `bun install` в каждом worktree, чтобы хук находил бинарник.
- [ ] Фаза 3: агент `cto` + раздел «Проверки» в CLAUDE.md.
- [ ] Проверить `scripts/dev.ts` на ту же проблему с `URL.pathname` на Windows.
