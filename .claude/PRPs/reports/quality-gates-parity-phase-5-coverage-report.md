# Implementation Report: Quality Gates Parity — Phase 5 (Coverage report)

## Summary

Coverage как отчёт без порога: api — `bun test --coverage` (text + lcov через
`apps/api/bunfig.toml`), web — Vitest `--coverage` с `@vitest/coverage-v8`
той же версии и `include: ['app/**/*.{ts,vue}']`. Единый парсер lcov
(`scripts/lib/lcov.ts`, чистые функции, 8 unit-тестов) сводит оба отчёта в
Markdown-таблицу; `bun run test:coverage` печатает её локально, CI дописывает
в Job Summary job `quality` отдельным report-only шагом. Попутно закрыт
пробел: `scripts/` теперь типизируются (`scripts/tsconfig.json`, `@types/bun`
в корне, `tsc -p scripts` внутри корневого `typecheck`).

## Assessment vs Reality

| Metric        | Predicted (Plan) | Actual                                          |
| ------------- | ---------------- | ----------------------------------------------- |
| Complexity    | Medium           | Medium                                          |
| Confidence    | 8                | 8 — два небольших отклонения, оба в сторону полноты |
| Files Changed | 11 + bun.lock    | 12 + bun.lock (+ `scripts/tsconfig.json`)       |

## Tasks Completed

| #   | Task                            | Status | Notes                                                                                  |
| --- | ------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| 1   | `scripts/lib/lcov.ts`           | done   | как в плане                                                                            |
| 2   | `scripts/lib/lcov.test.ts`      | done   | 8 pass (`it.each` разворачивается в три кейса)                                         |
| 3   | `scripts/coverage-summary.ts`   | done   | как в плане                                                                            |
| 4   | api: bunfig + `test:coverage`   | done   |                                                                                        |
| 5   | web: coverage-v8 + конфиг       | done   | Отклонение: `include: ['app/**/*.{ts,vue}']` — с `app/**` в lcov попадал `app/slices/.gitkeep` |
| 6   | корневые скрипты                | done   | `test` += `bun test scripts`; `typecheck` += `tsc -p scripts` (отклонение, см. ниже)   |
| 7   | CI шаг Coverage                 | done   | `continue-on-error: true`, запись в `$GITHUB_STEP_SUMMARY`                             |
| 8   | CLAUDE.md                       | done   | команда + строка таблицы «Проверки»                                                    |
| 9   | Коммит, push, PR                | done   | PR #10, секция «Фаза 5»                                                                |

## Validation Results

| Level           | Status | Notes                                                                                   |
| --------------- | ------ | --------------------------------------------------------------------------------------- |
| Static Analysis | Pass   | eslint + prettier на `scripts/`; `tsc -p scripts` (включая `dev.ts`, `install-hooks.ts`) чисто |
| Unit Tests      | Pass   | 8 новых тестов парсера; api 5, web 1 без изменений                                      |
| Build           | Pass   | `bun run check` exit 0 за 9 с (тёплый кэш)                                              |
| Integration     | Pass   | `bun run test:coverage`: api 89.2% lines (74/83), 93.3% functions; web 64.7% lines (11/17), 80.0% functions; lcov web содержит только `app/*.{ts,vue}` |
| Edge Cases      | Pass   | 0/0 → «—»; CRLF и неизвестные ключи игнорируются; запись без SF отбрасывается; `coverage/` под ignore (git, prettier, eslint) |

## Files Changed

| File                          | Action  | Lines     |
| ----------------------------- | ------- | --------- |
| `scripts/lib/lcov.ts`         | CREATED | +82       |
| `scripts/lib/lcov.test.ts`    | CREATED | +74       |
| `scripts/coverage-summary.ts` | CREATED | +28       |
| `scripts/tsconfig.json`       | CREATED | +7        |
| `apps/api/bunfig.toml`        | CREATED | +6        |
| `apps/api/package.json`       | UPDATED | +1        |
| `apps/web/vitest.config.ts`   | UPDATED | +8        |
| `apps/web/package.json`       | UPDATED | +2        |
| `package.json`                | UPDATED | +3 / -2   |
| `bun.lock`                    | UPDATED | coverage-v8, @types/bun в корне |
| `.github/workflows/ci.yaml`   | UPDATED | +8        |
| `CLAUDE.md`                   | UPDATED | +2        |

## Deviations from Plan

1. **`include: ['app/**/*.{ts,vue}']` вместо `['app/**']`.** С широким
   паттерном Vitest включал в lcov `app/slices/.gitkeep` как файл без
   покрытия. Ограничение по расширениям убирает шум.
2. **Typecheck для `scripts/`.** План отмечал риск «корневой tsconfig не
   покрывает scripts/»; подтвердилось — `@types/bun` не был доступен в корне
   (isolated-линкер Bun), `tsc` не мог проверить скрипты. Добавлены
   `scripts/tsconfig.json` (extends корневой, `types: ["@types/bun"]`),
   `@types/bun` в корневые devDependencies (тот же диапазон, что у api — одна
   версия в lock) и `tsc -p scripts` в корневой `typecheck`. `dev.ts` и
   `install-hooks.ts` прошли без правок.

## Issues Encountered

- `bunx vitest --version` печатает две строки (`vitest/4.1.10 …` и версию
  Node), и `grep -oE` из плана выдал две версии — в `package.json` попало
  `"4.1.10\n24.15.0"`. Исправлено вручную на `4.1.10`; при повторении брать
  `head -1`. После мержа PR #8 нужно `bun add -d @vitest/coverage-v8@5.0.5`.
- Предупреждение vue-tsc про `vue-router/volar/sfc-route-blocks` остаётся на
  этой ветке (исправлено в PR #8), на результат не влияет.

## Tests Written

| Test File                    | Tests | Coverage                                                         |
| ---------------------------- | ----- | ---------------------------------------------------------------- |
| `scripts/lib/lcov.test.ts`   | 8     | parseLcov (3), summarize (1), percent (3 через it.each), toMarkdown (1) |

## Next Steps

- [ ] Убедиться, что в Summary job `quality` на PR #10 видна таблица.
- [ ] После мержа PR #8: `bun add -d @vitest/coverage-v8@5.0.5`.
- [ ] Фаза 4 (e2e в CI) после мержа PR #7; Фаза 6 (SDK drift) — Could.
