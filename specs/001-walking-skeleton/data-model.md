# Data Model: Walking Skeleton

**Feature**: 001-walking-skeleton | **Date**: 2026-07-28

Доменных сущностей нет — каркас не содержит бизнес-логики (FR-012).
База данных создаётся пустой: Prisma-схема содержит только `datasource` и
`generator`, ни одной модели; первая доменная фича добавит модели и первую
миграцию.

Единственная структура данных фичи — отчёт о здоровье системы (не хранится,
вычисляется на каждый запрос):

## HealthReport

| Поле | Тип | Описание |
|---|---|---|
| `status` | `"ok" \| "degraded"` | `ok` — все зависимости доступны; `degraded` — хотя бы одна недоступна |
| `version` | `string` | версия приложения (из env `APP_VERSION`, дефолт `dev`) |
| `dependencies` | `object` | статус каждой зависимости по отдельности (FR-003) |
| `dependencies.database` | `"up" \| "down"` | результат `SELECT 1` к PostgreSQL с таймаутом |
| `dependencies.cache` | `"up" \| "down"` | результат `PING` к Redis с таймаутом |

**Validation rules**:

- Проверка каждой зависимости ограничена таймаутом (2 s), чтобы health-ответ
  возвращался быстро даже при зависшем соединении (поддерживает SC-003: реакция
  ≤ 30 s).
- HTTP-статус ответа: `200` при `status: "ok"`, `503` при `"degraded"` — чтобы
  healthcheck-механизмы (Compose, будущий k8s) различали состояния без разбора
  тела.

**State transitions**: нет (значение вычисляется, не хранится).

Полный контракт: [contracts/health.openapi.yaml](contracts/health.openapi.yaml).
