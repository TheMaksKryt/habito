# Implementation Report: Quality Gates Parity — Phase 4 (E2E in CI)

## Summary

В CI добавлены jobs `changes` (`dorny/paths-filter@v4`, только на
`pull_request`) и `e2e`: при изменениях UI поднимается полный стек через
`docker compose up --build --wait`, ставится Chromium, прогоняется Playwright
из PR #7, отчёт уходит артефактом, стек гасится. Job не required. Перед этим
в ветку влит `main` после мержей #4, #8, #7 (конфликты в 5 файлах разрешены),
`@vitest/coverage-v8` поднят до 5.0.5 под Vitest 5.

## Assessment vs Reality

| Metric        | Predicted (Plan) | Actual                                                     |
| ------------- | ---------------- | ---------------------------------------------------------- |
| Complexity    | Medium           | Medium                                                     |
| Confidence    | 7                | 8 — job прошёл в CI с первого раза                          |
| Files Changed | 5 + merge        | 4 + merge-коммит (`.github/workflows/ci.yaml`, `apps/web/playwright.config.ts`, `CLAUDE.md`, `README.md`) |

## Tasks Completed

| #   | Task                           | Status | Notes                                                                                   |
| --- | ------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| 0   | Слить PR #7                    | done   | PR #7 смержен в `main` до реализации → `git merge origin/main`; конфликты: `.gitignore`, `package.json`, `apps/web/package.json`, `apps/web/vitest.config.ts`, `bun.lock` — по правилам плана; `bun.lock` пересобран `bun install` |
| 1   | Локальный прогон Playwright    | done   | 1 passed против живого стека (PG 18, образы ветки #5)                                   |
| 2   | `playwright.config.ts`         | done   | `github` + `html` в CI, `workers: 1`, `retries: 1`, комментарий обновлён               |
| 3   | CI jobs `changes` + `e2e`      | done   | `checkout@v7`, `bun-version-file` — как в `quality` после #8                            |
| 4   | CLAUDE.md, README              | done   | строка «Проверки», bullet «Тесты», фраза про required checks                            |
| 5   | Коммит, push, PR               | done   | run 39636426224: changes ✔, e2e ✔ (все шаги), артефакт `playwright-report` 229 KB       |

## Validation Results

| Level           | Status | Notes                                                                                   |
| --------------- | ------ | --------------------------------------------------------------------------------------- |
| Static Analysis | Pass   | prettier на ci.yaml/config/docs; eslint на `playwright.config.ts`                       |
| Unit Tests      | Pass   | без новых; `bun run check` после merge зелёный (api 5, web 1, scripts 8) на Vitest 5    |
| Build           | Pass   | `check` 28 с после merge; `bun run test:coverage` на coverage-v8 5.0.5 — таблица без изменений |
| Integration     | Pass   | Playwright локально (`list`) и с `CI=1` (html-отчёт создан); в CI job `e2e` success      |
| Edge Cases      | Partial| «PR без UI → e2e skipped» не наблюдался: этот PR меняет `ci.yaml`, фильтр даёт `ui=true`. Проверить на следующем не-UI PR |

## Files Changed

| File                            | Action | Lines                                       |
| ------------------------------- | ------ | ------------------------------------------- |
| `.github/workflows/ci.yaml`     | UPDATED| +62                                         |
| `apps/web/playwright.config.ts` | UPDATED| +8 / -4                                     |
| `CLAUDE.md`                     | UPDATED| +5 / -4                                     |
| `README.md`                     | UPDATED| +3 / -1                                     |
| merge `main`                    | MERGE  | 5 конфликтов; `@vitest/coverage-v8` 4.1.10 → 5.0.5; `@types/bun` → ^1.4.3 |

## Deviations from Plan

1. **Task 0 выполнен через `git merge origin/main`**, а не слиянием ветки
   PR #7: по решению пользователя PR мержились в порядке #4 → #8 → #7 до
   реализации. План это предусматривал.
2. **`@types/bun` в корне поднят до `^1.4.3`** — чтобы совпасть с диапазоном
   api после #8 и держать одну версию в lock.

## Issues Encountered

- Серверный `update-branch` для PR #7 вернул 422 (конфликт); слияние `main`
  в `test/6-playwright` сделано в detached-worktree и запушено как
  `HEAD:test/6-playwright`. В том worktree perl-замены не сработали из-за
  CRLF (на `main` ещё не было `.gitattributes`), и первый merge-коммит ушёл с
  маркерами конфликта — исправлено `--amend` до push.
- MSYS превращал `origin/main:.gitignore` в `origin\main;.gitignore` —
  `MSYS_NO_PATHCONV=1` при `git show <rev>:<path>`.

## Tests Written

| Test File | Tests | Coverage                                  |
| --------- | ----- | ----------------------------------------- |
| —         | 0     | прогоняется `apps/web/e2e/smoke.spec.ts` из PR #7 |

## Next Steps

- [ ] Смержить PR #10, затем в каждом клоне: `git rm -rf --cached . && git reset --hard HEAD && bun install`.
- [ ] На следующем PR без UI-изменений убедиться, что `e2e` skipped — отметить в issue #9.
- [ ] Фаза 6 (SDK drift) — Could, по желанию.
