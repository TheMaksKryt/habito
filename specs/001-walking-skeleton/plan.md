# Implementation Plan: Walking Skeleton — рабочий каркас проекта

**Branch**: `001-walking-skeleton` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-walking-skeleton/spec.md`

## Summary

Создать минимальный сквозной каркас Habito: Bun-монорепо с `apps/web` (Nuxt 4.5,
страница-заглушка) и `apps/api` (Elysia, `GET /health` с проверкой PostgreSQL и
Redis), полный локальный стек через Docker Compose одной командой, CI-гейты
(lint / typecheck / test / build) на каждый PR. Бизнес-логики нет — каркас
доказывает, что путь «код → работающая система» существует, включая
contract-first цепочку (OpenAPI из Elysia → генерируемый SDK в Nuxt).

## Technical Context

**Language/Version**: TypeScript (последняя стабильная ветка, поставляемая с
Nuxt 4.5 — 6.x); runtime и пакетный менеджер — Bun 1.x

**Primary Dependencies**: Nuxt `^4.5.1`, Elysia 1.x + `@elysiajs/openapi`,
Prisma (минимальная схема), ioredis, `@hey-api/openapi-ts` (SDK для web)

**Storage**: PostgreSQL 17 (postgres:17-alpine) + Redis 8 (redis:8-alpine),
данные — в именованных volume

**Testing**: `bun:test` для api; Vitest + `@nuxt/test-utils` для web
(обоснование — research.md R1)

**Target Platform**: локальный Docker Compose (linux-контейнеры) + браузер;
CI — GitHub Actions

**Project Type**: web application (монорепо frontend + backend)

**Performance Goals**: старт полного стека ≤ 2 минут; реакция health-статуса на
отказ зависимости ≤ 30 секунд; CI-прогон ≤ 10 минут (SC-001, SC-003, SC-004)

**Constraints**: один образ — конфигурация только через env (runtimeConfig,
public-ключи с дефолтом `?? ''`); `--frozen-lockfile` везде; никакой доменной
функциональности (FR-012)

**Scale/Scope**: 2 приложения, 1 compose-стек (4 сервиса), 1 CI-workflow,
~10 исходных файлов на приложение

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Оценка | Примечание |
|---|---|---|
| I. Feature-sliced модульность | ✅ PASS | Каркас закладывает структуру (`apps/*`, `packages/*`, `modules/health` в api); механизм Nuxt-слайсов вводится с первой продуктовой фичей — раньше нечего слайсить |
| II. Clean Architecture соразмерно | ✅ PASS | Health — компактный модуль (controller + service); слои domain/data не создаются, пока нет бизнес-логики (принцип разрешает явно) |
| III. Contract-first API | ✅ PASS | `/health` описан схемой Elysia → OpenAPI публикуется; web получает SDK через `@hey-api/openapi-ts` — сквозной контракт-пайплайн работает с первого дня |
| IV. Строгая типобезопасность | ✅ PASS | `strict` + `noUncheckedIndexedAccess` в обоих приложениях; `typecheck` — CI-гейт |
| V. Единая обработка ошибок | ✅ PASS | Минимум скелета: глобальный `onError` в Elysia (единый формат ответа), `error.vue` в Nuxt; полная схема (ErrorEntity/mappers) — при первом реальном API-потоке |
| VI. SSR-безопасность | ✅ PASS | Состояния ещё нет; правила фиксируются в CLAUDE.md каркаса |
| VII. Quality gates (NON-NEGOTIABLE) | ✅ PASS | Ядро фичи: `lint`/`typecheck`/`test` с первого коммита, CI на каждый PR, frozen lockfile |
| Конфигурация и секреты | ✅ PASS | `.env.example` с фиктивными значениями; `.env*` в gitignore; public-ключи `?? ''` |
| Деплой-принципы | ✅ PASS | Multi-stage Dockerfile из корня монорепо, healthcheck + `depends_on: service_healthy`, volumes; публичный деплой — вне скоупа (следующая фича) |

**Вердикт (pre-research)**: PASS, нарушений нет.
**Вердикт (post-design, повторная проверка)**: PASS — дизайн-артефакты не ввели
отступлений; Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/001-walking-skeleton/
├── plan.md              # Этот файл
├── research.md          # Phase 0: решения и обоснования
├── data-model.md        # Phase 1: структуры данных (доменных сущностей нет)
├── quickstart.md        # Phase 1: сценарии валидации каркаса
├── contracts/
│   └── health.openapi.yaml   # Phase 1: контракт GET /health
└── tasks.md             # Создаётся командой /speckit-tasks (не здесь)
```

### Source Code (repository root)

```text
habito/
├── apps/
│   ├── web/                        # Nuxt 4.5 (SSR, nitro preset bun)
│   │   ├── app/
│   │   │   ├── app.vue
│   │   │   ├── pages/index.vue     # страница-заглушка
│   │   │   └── slices/             # пусто; структура для будущих слайсов
│   │   ├── tests/smoke.test.ts
│   │   ├── nuxt.config.ts
│   │   ├── openapi-ts.config.ts    # SDK из OpenAPI api
│   │   ├── Dockerfile              # multi-stage, context = корень репо
│   │   └── package.json
│   └── api/                        # Elysia на Bun
│       ├── src/
│       │   ├── index.ts            # bootstrap: openapi, onError, listen
│       │   ├── config.ts           # env-конфигурация с валидацией
│       │   └── modules/health/
│       │       ├── health.controller.ts
│       │       └── health.service.ts   # ping PostgreSQL + Redis
│       ├── prisma/schema.prisma    # datasource + generator, без моделей
│       ├── tests/health.test.ts
│       ├── Dockerfile              # multi-stage, context = корень репо
│       └── package.json
├── packages/                       # будущие общие пакеты (.gitkeep)
├── scripts/dev.ts                 # dev-оркестратор `bun dev` (по образцу ranch dev)
├── .github/workflows/ci.yaml      # lint → typecheck → test → build images
├── docker-compose.yml             # web + api + postgres + redis
├── .env.example
├── eslint.config.mjs              # общий flat config (vue + ts overrides)
├── package.json                   # bun workspaces: apps/*, packages/*
├── bun.lock
├── tsconfig.json                  # база: strict, noUncheckedIndexedAccess
├── CLAUDE.md                      # живой архитектурный документ (первичная версия)
└── README.md                      # онбординг: prerequisites → запуск → проверка
```

**Structure Decision**: вариант «Web application» в форме Bun-монорепо
`apps/web` + `apps/api` + `packages/*` — зафиксирован конституцией (раздел
«Стек»). Dockerfile лежат в приложениях, но собираются из корня репозитория
(конвенция ranch: слой зависимостей по манифестам workspaces до копирования
исходников). Turborepo не вводится (research.md R4).

## Complexity Tracking

Отступлений от конституции нет — таблица пуста.
