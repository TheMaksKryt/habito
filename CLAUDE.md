# CLAUDE.md — Habito

Живой архитектурный документ: правила кода этого репозитория и «почему» за
каждым из них. Полные принципы — в [конституции](.specify/memory/constitution.md)
(она главнее); продуктовое видение — в [plan.md](plan.md). Здесь — только то,
что реально существует в коде сейчас.

## Команды

```bash
bun dev [api|web] [--no-test]  # dev-оркестратор: хранилища + серверы + hot-reload
docker compose up --build -d   # полный production-like стек
bun run lint | typecheck | test | format
bun run gen:api                # OpenAPI из api → SDK в web
bun run db:generate            # Prisma client
```

Установка зависимостей — только `bun install --frozen-lockfile` (CI падает при
рассинхроне lock-файла).

## Структура

```text
apps/api   Elysia на Bun: src/modules/<module>/, src/config.ts, src/app.ts, src/index.ts
apps/web   Nuxt 4.5 (SSR, nitro-bun): app/, generated/api (SDK, не редактировать)
packages/  будущие общие пакеты
scripts/   dev.ts — оркестратор bun dev
specs/     spec-kit артефакты (constitution check в каждом plan.md)
```

- api: `createApp()` (src/app.ts) отделён от `listen` (src/index.ts) — один граф
  используется сервером, тестами через `app.handle()` и экспортом OpenAPI без
  открытия порта.
- Новый модуль api = каталог `src/modules/<name>/` с `<name>.controller.ts`
  (Elysia-инстанс со схемами) и `<name>.service.ts` (логика, конструкторная
  инъекция зависимостей). Слои domain/data добавляются, когда появляется
  бизнес-логика — не раньше (конституция, Принцип II).

## Contract-first цепочка (Принцип III)

```text
Elysia t.Object-схемы → @elysiajs/openapi → apps/api/openapi.json
  → @hey-api/openapi-ts → apps/web/generated/api (SDK)
```

- Ручные `$fetch`/`fetch` к API в web запрещены — только функции SDK.
- `bun run gen:api` регенерирует всё; Docker-образ web собирает спеку из
  исходников api отдельной стадией (паттерн ranch).
- Сгенерированный код не редактируется, исключён из lint и патчится
  `@ts-nocheck` ([apps/web/scripts/patch-generated.ts](apps/web/scripts/patch-generated.ts)):
  hey-api 0.99.0 не проходит строгий TS 6 — убрать патч, когда станет совместим.

## Правила с «почему»

- **Public runtimeConfig-ключи обязаны иметь дефолт `?? ''`**
  ([nuxt.config.ts](apps/web/nuxt.config.ts)): Nuxt отбрасывает undefined-ключи
  при сериализации, и runtime-переопределение `NUXT_PUBLIC_*` молча перестаёт
  работать. Образ конфигурируется при старте, не при сборке.
- **SDK-клиент конфигурируется в плагине** ([app/plugins/api.ts](apps/web/app/plugins/api.ts)),
  не через `runtimeConfigPath` hey-api: сгенерированный клиент вызывает конфиг
  при импорте модуля, где `useRuntimeConfig` в собранном SSR недоступен
  (NUXT_E1001).
- **Split-horizon URL API**: браузер → `NUXT_PUBLIC_API_URL`, SSR в compose →
  `NUXT_INTERNAL_API_URL` (http://api:3333) — публичный localhost изнутри
  контейнера недостижим.
- **`/health` отвечает 503 при degraded** и называет каждую зависимость
  отдельно: healthcheck'и Compose/k8s различают состояния по HTTP-статусу.
  Probes ограничены таймаутом 2 s — ответ быстрый даже при зависшем соединении.
- **ioredis без lazyConnect, с `enableOfflineQueue: false` и
  `maxRetriesPerRequest: 0`** ([src/index.ts](apps/api/src/index.ts)): probe при
  недоступном Redis падает сразу, а не зависает в очереди; без lazyConnect
  первый health-запрос не отчитывается ложным «down». Обязателен подписчик на
  `error` — иначе unhandled error при обрыве соединения.
- **Prisma 7**: URL не в schema.prisma, а в [prisma.config.ts](apps/api/prisma.config.ts);
  placeholder-fallback позволяет `prisma generate` в чистом окружении (CI,
  Docker build). Runtime — через адаптер `@prisma/adapter-pg`.
- **Хостовые порты хранилищ параметризованы** (`POSTGRES_PORT`/`REDIS_PORT`
  в .env): 5432/6379 на машине разработчика могут быть заняты другим проектом;
  внутри compose-сети всегда `postgres:5432`/`redis:6379`.
- **dev.ts освобождает порты остановкой контейнера, а не `kill` по pid**:
  lsof на проброшенном порту находит port-proxy Docker Desktop — kill сломал бы
  сам Docker (урок ranch `make free-ports`).
- **TypeScript закреплён на ^6** (в корне): TS 7 заблокирован для web
  (vue-tsc — до TS 7.1) и для линта (typescript-eslint). Критерии перехода —
  в конституции, раздел «Политика версий TypeScript».
- **`no-undef` выключен для .ts/.vue** в ESLint: Nuxt auto-imports дают ложные
  срабатывания, неопределённые идентификаторы ловит tsc (рекомендация
  typescript-eslint).

## Тесты

- api — `bun:test` ([apps/api/tests](apps/api/tests)): unit сервисов + HTTP через
  `app.handle()` без сети.
- web — Vitest + `@nuxt/test-utils` (environment: nuxt), SDK мокается через
  `vi.mock('~~/generated/api')`.
- web e2e — Playwright ([apps/web/e2e](apps/web/e2e), `bun run --filter web test:e2e`)
  поверх поднятого `bun dev` или `docker compose up`: SDK не мокается, проверяется реальная цепочка
  SSR → SDK → API. Запускается вручную, в CI не входит — e2e добавляются в CI
  вместе с первым критическим пользовательским потоком (Принцип VII).
  `E2E_BASE_URL` переопределяет адрес web (по умолчанию http://localhost:3000).
- Юнит-тесты домен-логики обязательны (Принцип VII); тесты пишутся до или
  вместе с кодом, CI не пропустит их отсутствие для нового модуля с логикой.

## Не пересоздавать — импортировать

| Что                        | Где                                                 |
| -------------------------- | --------------------------------------------------- |
| Загрузка/валидация env api | `apps/api/src/config.ts` (`loadConfig`)             |
| Сборка приложения api      | `apps/api/src/app.ts` (`createApp`)                 |
| Health-probes и отчёт      | `apps/api/src/modules/health/health.service.ts`     |
| SDK к API в web            | `~~/generated/api` (регенерация: `bun run gen:api`) |

## Миграционная политика

Новый код — сразу по паттернам этого документа; затронутый код — мигрирует в том
же изменении; фоновая миграция — один модуль на PR, не смешивать с фичами
(конституция, «Рабочий процесс»).
