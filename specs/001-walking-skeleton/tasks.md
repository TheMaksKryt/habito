---

description: "Task list for Walking Skeleton implementation"
---

# Tasks: Walking Skeleton — рабочий каркас проекта

**Input**: Design documents from `/specs/001-walking-skeleton/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/health.openapi.yaml, quickstart.md

**Tests**: Включены — спека требует тестовый харнесс с минимум одним осмысленным тестом на приложение (FR-010), Принцип VII конституции делает гейты обязательными.

**Organization**: Задачи сгруппированы по user story. Пути — от корня репозитория.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: разные файлы, нет зависимостей от незавершённых задач — можно параллельно
- **[Story]**: US1 (запуск одной командой), US2 (quality gates), US3 (онбординг)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: корень монорепо и общие конфигурации

- [X] T001 Создать корень Bun-монорепо: `package.json` (workspaces `apps/*`, `packages/*`; скрипты `lint`/`typecheck`/`test`, проксирующие в workspaces через `bun run --filter`), `packages/.gitkeep`, `.gitignore` (`.env`, `.env.*`, `!.env.example`, `node_modules`, `.nuxt`, `.output`, `dist`, сгенерированный SDK и prisma client)
- [X] T002 Создать базовый `tsconfig.json` в корне: `strict: true`, `noUncheckedIndexedAccess: true`, общие compilerOptions для наследования обоими приложениями
- [X] T003 [P] Создать `eslint.config.mjs` (flat: `@eslint/js` + `typescript-eslint` + `eslint-plugin-vue` override для `apps/web/**`; ignore сгенерированных директорий) и конфиг Prettier в корне (research.md R7)
- [X] T004 [P] Создать `.env.example` с заведомо фиктивными значениями: `POSTGRES_USER=habito`, `POSTGRES_PASSWORD=dev-change-me`, `POSTGRES_DB=habito`, `DATABASE_URL`, `REDIS_URL`, `API_PORT=3333`, `APP_VERSION=dev`, `NUXT_PUBLIC_API_URL=http://localhost:3333`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: каркасы обоих приложений с рабочими скриптами `lint`/`typecheck`/`test` — без них не стартует ни одна история

**⚠️ CRITICAL**: истории начинаются только после этой фазы

- [X] T005 Скаффолд `apps/api`: `package.json` (deps: `elysia`, `@elysiajs/openapi`, `prisma`, `@prisma/client`, `ioredis`; scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `db:generate`), `tsconfig.json` (extends корневой), пустой `src/index.ts`-заглушка, компилирующаяся и проходящая lint
- [X] T006 Скаффолд `apps/web`: Nuxt `^4.5.1` — `package.json` (deps: `nuxt`, devDeps: `vitest`, `@nuxt/test-utils`, `@hey-api/openapi-ts`; те же 5 скриптов + `typecheck` через `nuxt typecheck`), `nuxt.config.ts` (nitro `preset: 'bun'`, `runtimeConfig.public.apiUrl` с дефолтом `?? ''`), `app/app.vue`, пустая `app/slices/.gitkeep`
- [X] T007 Создать `apps/api/prisma/schema.prisma` (datasource postgresql из `DATABASE_URL` + generator client, БЕЗ моделей — data-model.md) и включить `prisma generate` в скрипты `postinstall`/`db:generate`; выполнить `bun install` в корне и зафиксировать `bun.lock`

**Checkpoint**: `bun install --frozen-lockfile && bun run lint && bun run typecheck` проходят в чистом клоне

---

## Phase 3: User Story 1 — Запуск всей системы одной командой (Priority: P1) 🎯 MVP

**Goal**: `docker compose up --build` поднимает web + api + postgres + redis; заглушка отвечает, `/health` показывает статус каждой зависимости

**Independent Test**: quickstart.md сценарии 1–3 (запуск, отказ зависимости, перезапуск без потери данных)

### Implementation for User Story 1

- [X] T008 [US1] Реализовать `apps/api/src/config.ts`: чтение env (`DATABASE_URL`, `REDIS_URL`, `API_PORT`, `APP_VERSION`) с валидацией при старте — отсутствие обязательной переменной даёт понятную ошибку со ссылкой на `.env.example` (FR-007, US3-приёмка 2)
- [X] T009 [US1] Реализовать `apps/api/src/modules/health/health.service.ts`: probes PostgreSQL (`$queryRaw SELECT 1` через Prisma) и Redis (`PING` через ioredis) с таймаутом 2 s каждая; сборка `HealthReport` по data-model.md (`ok`/`degraded`, статус каждой зависимости отдельно)
- [X] T010 [US1] Реализовать `apps/api/src/modules/health/health.controller.ts`: `GET /health` со схемой ответа Elysia (t.Object по contracts/health.openapi.yaml), HTTP 200 при `ok` / 503 при `degraded`
- [X] T011 [US1] Реализовать `apps/api/src/index.ts`: bootstrap Elysia — подключение `@elysiajs/openapi` (публикация OpenAPI-документа), глобальный `onError` с единым JSON-форматом ошибки, регистрация health-модуля, listen на `API_PORT`
- [X] T012 [P] [US1] Написать `apps/api/tests/health.test.ts` (bun:test): unit-тесты health.service — `ok` при живых probes, `degraded` + конкретная зависимость при отказе, соблюдение таймаута (probes мокируются)
- [X] T013 [US1] Настроить генерацию SDK в web: `apps/web/openapi-ts.config.ts` (`@hey-api/openapi-ts` из OpenAPI-документа api), скрипт `generate:api`, вызов перед `dev`/`build` (паттерн main-site); сгенерированная директория — в `.gitignore` и eslint-ignore
- [X] T014 [US1] Реализовать `apps/web/app/pages/index.vue` (страница-заглушка Habito, показывает статус API через сгенерированный SDK) и минимальный `apps/web/app/error.vue`
- [X] T015 [P] [US1] Написать `apps/web/tests/smoke.test.ts` (Vitest + @nuxt/test-utils): страница-заглушка рендерится и содержит маркер приложения
- [X] T016 [P] [US1] Написать `apps/api/Dockerfile`: multi-stage из корня репо — `oven/bun:1` builder (слой зависимостей по манифестам workspaces → исходники → prisma generate + build), `oven/bun:1-slim` runtime, `ARG APP_VERSION` (конвенция ranch)
- [X] T017 [P] [US1] Написать `apps/web/Dockerfile`: multi-stage из корня репо — сборка Nuxt (nitro bun preset), runtime `oven/bun:1-slim`, запуск `.output/server/index.mjs`, `ARG APP_VERSION`
- [X] T018 [US1] Написать `docker-compose.yml`: сервисы `postgres` (postgres:17-alpine, named volume, healthcheck `pg_isready`), `redis` (redis:8-alpine, named volume, healthcheck `redis-cli ping`), `api` (build из корня с `-f apps/api/Dockerfile`, healthcheck `GET /health`, `depends_on: service_healthy` на оба хранилища), `web` (аналогично, depends_on api); порты 3000/3333/5432/6379; env из `.env` (research.md R5, R9)
- [X] T019 [US1] Реализовать dev-оркестратор `scripts/dev.ts` (запуск: `bun dev [api|web]` через скрипт корневого `package.json`) по образцу `ranch dev`: проверка, что Docker запущен → проверка свежести зависимостей → pre-flight `bun run test` с обходом `--no-test` → освобождение портов 3000/3333 → `docker compose up -d postgres redis` + ожидание healthy → параллельный старт dev-серверов обоих приложений (или одного по target) с hot-reload
- [X] T020 [US1] Checkpoint-валидация: прогнать quickstart.md сценарии 1–3 (полный старт ≤ 2 мин, отказ redis → 503 с `"cache":"down"` ≤ 30 s → самовосстановление, перезапуск без потери данных) плюс запуск через `bun dev`; зафиксировать результат в PR-описании

**Checkpoint**: US1 полностью работоспособна и проверяема независимо

---

## Phase 4: User Story 2 — Автоматические quality gates (Priority: P2)

**Goal**: каждый PR автоматически проходит lint/typecheck/test/build; сломанное изменение не сливается

**Independent Test**: quickstart.md сценарий 4 + пара тестовых PR (зелёный проходит, красный блокируется)

### Implementation for User Story 2

- [X] T021 [US2] Написать `.github/workflows/ci.yaml`: on PR + push в main; job `quality` — `bun install --frozen-lockfile` → `bun run db:generate` (api) → `bun run lint` → `bun run typecheck` → `bun run test`; job `images` — `docker build` обоих Dockerfile из корня (без push); суммарно ≤ 10 минут (SC-004)
- [ ] T022 [US2] Включить branch protection для `main` (required status checks: `quality`, `images`) через `gh api` или настройки репозитория; команду/шаги задокументировать в README (секция для мейнтейнера) — ⏳ команда задокументирована в README; применить можно только после первого push в TheMaksKryt/habito
- [ ] T023 [US2] Негативная валидация гейтов: PR с намеренной ошибкой типов — CI красный, слияние заблокировано; исправление — CI зелёный; результат зафиксировать в PR-описании (US2-приёмки 1–3) — ⏳ локальная часть выполнена 2026-07-28 (битый код валит typecheck, чистый проходит); PR-часть — после первого push и включения branch protection

**Checkpoint**: US1 и US2 работают независимо друг от друга

---

## Phase 5: User Story 3 — Онбординг по документации (Priority: P3)

**Goal**: новый разработчик доводит систему до рабочего состояния только по README

**Independent Test**: quickstart.md сценарий 5 — прогон онбординга «с нуля», ноль устных вопросов

### Implementation for User Story 3

- [X] T024 [US3] Написать `README.md`: назначение проекта, prerequisites (Docker, Bun, версии), полный путь «клон → `.env` → `docker compose up --build` → проверки», dev-режим одной командой (`bun dev`, оркестратор из T019, включая `bun dev api`/`bun dev web` и `--no-test`), troubleshooting (занятые порты, отсутствующие env), ссылки на спеки и конституцию
- [X] T025 [P] [US3] Создать первичный `CLAUDE.md` (живой архитектурный документ по конституции): структура монорепо, конвенции именования, правила «почему» (runtimeConfig `?? ''`, frozen lockfile, contract-first цепочка), команды; без вымышленных разделов — только то, что реально существует в каркасе
- [X] T026 [US3] Валидация онбординга: прогон README-пути на чистом окружении (или коллегой), каждый возникший вопрос — правка README; результат зафиксировать в PR-описании (SC-005)

**Checkpoint**: все три истории независимо работоспособны

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Сверка соответствия конституции: все public runtimeConfig-ключи имеют дефолт `?? ''`; `.env*` не попадает в git; сгенерированные директории вне lint; версии зафиксированы `bun.lock`
- [X] T028 Финальный полный прогон quickstart.md (сценарии 1–5) от чистого клона с замером времени (SC-001: ≤ 10 минут) и фиксацией результатов

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: после Setup — БЛОКИРУЕТ все истории
- **US1 (Phase 3)**: после Foundational
- **US2 (Phase 4)**: после Foundational; тестовые цели (T012, T015) созданы в US1, поэтому практический порядок — после US1
- **US3 (Phase 5)**: после Foundational; описывает результаты US1–US2, практический порядок — последней
- **Polish (Phase 6)**: после всех историй

### Внутри US1

- T008 → T009 → T010 → T011 (config → service → controller → bootstrap)
- T012 параллельно после T009; T013 после T011 (нужен OpenAPI-документ); T014 после T013; T015 после T014
- T016, T017 параллельно после T011/T014; T018 после T016+T017; T019 после T018 (использует compose-сервисы хранилищ); T020 последней

### Parallel Opportunities

```text
Phase 1: T003 ∥ T004 (после T001–T002)
Phase 2: T005 ∥ T006 (после Phase 1), затем T007
US1:     T012 ∥ T013–T014 ∥ T016 ∥ T017 (после T011)
US3:     T024 ∥ T025
Polish:  T027 ∥ подготовка T028
```

---

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → US1 (T008–T020) → СТОП и валидация по quickstart 1–3. Уже на этом этапе система «поднимается и отвечает» — суть walking skeleton.

**Incremental delivery**: затем US2 (гейты) → US3 (онбординг) → Polish. Каждая история завершается своим checkpoint'ом и может быть предъявлена отдельно.

**Коммиты**: Conventional Commits, по задаче или связной группе (например, `feat(api): add health module with dependency probes`).
