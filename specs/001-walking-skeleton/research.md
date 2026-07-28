# Research: Walking Skeleton

**Feature**: 001-walking-skeleton | **Date**: 2026-07-28

Технических NEEDS CLARIFICATION в Technical Context нет. Ниже — решения по
точкам выбора, возникшим при проектировании, с обоснованиями. Источники:
конституция v1.0.0, архитектурный референс `my-knowledge/migration/main-site`,
деплой-референс `my-knowledge/ranch`, проверки актуальности от 2026-07-28
(Nuxt 4.5.1, TS 7.0 GA, состояние vue-tsc/typescript-eslint).

## R1. Тестовые раннеры

- **Decision**: `apps/api` — встроенный `bun:test`; `apps/web` — Vitest +
  `@nuxt/test-utils`.
- **Rationale**: Elysia работает нативно на Bun, `bun:test` не требует
  конфигурации и самый быстрый; для Nuxt экосистемный стандарт —
  Vitest с `@nuxt/test-utils` (среда Nuxt, авто-импорты в тестах).
  Единый раннер на всё дал бы либо конфигурацию Vitest под Bun-API,
  либо отказ от Nuxt-окружения в тестах web.
- **Alternatives considered**: Vitest везде (лишняя обвязка для api);
  bun:test везде (нет поддержки Nuxt-окружения).

## R2. Клиенты хранилищ для health-проверки

- **Decision**: PostgreSQL — Prisma с минимальной схемой (datasource +
  generator, без моделей), проверка `$queryRaw\`SELECT 1\``; Redis — `ioredis`,
  проверка `PING`.
- **Rationale**: Prisma зафиксирована конституцией как ORM — каркас закладывает
  её пайплайн (generate, будущие миграции) сразу, чтобы первая доменная фича
  добавляла только модели. `ioredis` — клиент, который использует BullMQ
  (следующие фичи), одна зависимость вместо двух.
- **Alternatives considered**: `postgres`-драйвер напрямую (пришлось бы менять
  на Prisma при первой фиче); `node-redis` (BullMQ всё равно принесёт ioredis).

## R3. Базовые образы и runtime

- **Decision**: builder — `oven/bun:1` для обоих приложений; runtime —
  `oven/bun:1-slim`; Nuxt собирается с nitro `preset: 'bun'`.
- **Rationale**: единый runtime упрощает матрицу (main-site работает на
  nitro-bun в проде); паттерн multi-stage из корня монорепо со слоем
  зависимостей до исходников — из ranch.
- **Alternatives considered**: `node:22-alpine` для web (так в ranch;
  остаётся задокументированным fallback, если nitro-bun проявит проблемы —
  смена: preset + базовый образ, два файла).

## R4. Turborepo

- **Decision**: не вводить. Bun workspaces + скрипты `bun run --filter '*' <script>`.
- **Rationale**: два приложения, четыре скрипта — оркестратор пока не даёт
  выгоды (конституция: «архитектура не сложнее потребностей», Turborepo —
  «по необходимости»). Критерий ввода: появление 2+ общих пакетов с цепочками
  сборки или заметное время CI из-за отсутствия кэша задач.
- **Alternatives considered**: Turborepo сразу (преждевременно).

## R5. Топология запуска

- **Decision**: одна документированная команда полного стека —
  `docker compose up --build` (web + api + postgres + redis). Для повседневной
  разработки — вспомогательный режим: `docker compose up -d postgres redis` +
  `bun dev` в приложениях (описан в README как альтернатива).
- **Rationale**: спека требует «вся система одной командой» (FR-004) —
  полный compose это гарантирует production-like; hot-reload режим нужен
  для реальной работы, но не является предметом приёмки.
- **Alternatives considered**: compose-профили (лишняя косвенность для двух
  сценариев); только host-режим (не проверяет образы и healthcheck'и).

## R6. Contract-first пайплайн в каркасе

- **Decision**: `@elysiajs/openapi` публикует OpenAPI-документ из схем Elysia;
  `apps/web` генерирует типизированный SDK через `@hey-api/openapi-ts`
  (как в main-site); первый потребитель — статус API на странице-заглушке.
- **Rationale**: Принцип III конституции требует сквозного контракт-пайплайна;
  проверить его на единственном endpoint'е дёшево, а первая фича получит
  готовый механизм.
- **Alternatives considered**: Eden Treaty (связывает web с типами api напрямую,
  минуя OpenAPI — нарушает конституционный принцип «OpenAPI — единственный
  источник контракта» и паттерн референса); отложить SDK до первой фичи
  (walking skeleton перестаёт быть сквозным).

## R7. Линтинг и форматирование

- **Decision**: корневой ESLint flat config: `@eslint/js` + `typescript-eslint`
  + `eslint-plugin-vue` (override для `apps/web/**`); Prettier как форматтер;
  сгенерированные директории (SDK, `.nuxt`, prisma client) — в ignore.
- **Rationale**: Принцип VII — единые правила на монорепо; референс показал
  цену отсутствия форматтера (смешанные стили).
- **Alternatives considered**: `@nuxt/eslint`-модуль (генерирует конфиг только
  для web — оставлен как возможное дополнение позже); Biome (не совместим с
  typescript-eslint-правилами, экосистема плагинов беднее).

## R8. Версия TypeScript

- **Decision**: единая версия в корне монорепо — последняя стабильная 6.x,
  совместимая с Nuxt 4.5. TS 7 не используется.
- **Rationale**: политика конституции: frontend заблокирован до TS 7.1 +
  vue-tsc; ранний переход backend возможен после поддержки typescript-eslint,
  но в каркасе единая версия проще; пересмотр — по критериям конституции.
- **Alternatives considered**: TS 7 на api уже сейчас (сломает общий
  eslint-пайплайн — typescript-eslint ещё не поддерживает TS 7).

## R9. Порты и имена сервисов

- **Decision**: web — 3000, api — 3333, postgres — 5432, redis — 6379;
  compose-сервисы: `web`, `api`, `postgres`, `redis`; внутри сети — обращение
  по имени сервиса.
- **Rationale**: конвенция ranch (api на 3333); стандартные порты хранилищ.
- **Alternatives considered**: нет значимых.
