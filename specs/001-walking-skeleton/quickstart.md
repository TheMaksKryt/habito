# Quickstart: валидация Walking Skeleton

**Feature**: 001-walking-skeleton | **Date**: 2026-07-28

Сценарии, доказывающие, что каркас выполняет спецификацию. Прогоняются после
реализации (`/speckit-implement`) и при каждом изменении инфраструктуры каркаса.

## Prerequisites

- Docker (с Compose v2)
- Bun 1.x
- Git

## Сценарий 1 — полный стек одной командой (US1, SC-001, SC-002)

```bash
git clone <repo> habito && cd habito
cp .env.example .env
docker compose up --build -d
docker compose ps           # ожидание: все 4 сервиса healthy в течение ~2 минут
```

Проверки:

```bash
curl -s http://localhost:3000            # HTML страницы-заглушки, HTTP 200
curl -s http://localhost:3333/health     # {"status":"ok",...,"dependencies":{"database":"up","cache":"up"}}, HTTP 200
```

Контракт ответа: [contracts/health.openapi.yaml](contracts/health.openapi.yaml),
структура — [data-model.md](data-model.md).

### Вариант 1b — dev-режим одной командой

```bash
bun dev            # поднимает postgres+redis, ждёт готовности, стартует оба dev-сервера
bun dev api        # только api (хранилища поднимаются так же)
bun dev --no-test  # пропустить pre-flight тесты
```

Ожидание: те же проверки, что в сценарии 1 (страница на :3000, `/health` на :3333),
но с hot-reload; повторный запуск идемпотентен (занятые порты освобождаются).

## Сценарий 2 — health отражает отказ зависимости (US1-4, SC-003)

```bash
docker compose stop redis
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/health   # 503
curl -s http://localhost:3333/health | grep '"cache":"down"'          # указана конкретная зависимость
docker compose start redis
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/health   # 200 — восстановилось само
```

## Сценарий 3 — перезапуск без потери данных (SC-006)

```bash
docker compose exec postgres psql -U habito -c "CREATE TABLE smoke(id int); INSERT INTO smoke VALUES (1);"
docker compose down          # без -v: volumes сохраняются
docker compose up -d
docker compose exec postgres psql -U habito -c "SELECT * FROM smoke;"   # строка на месте
docker compose exec postgres psql -U habito -c "DROP TABLE smoke;"
```

## Сценарий 4 — quality gates локально (US2)

```bash
bun install --frozen-lockfile   # успех без изменения bun.lock
bun run lint
bun run typecheck
bun run test                    # минимум по одному проходящему тесту в web и api
```

Негативная проверка: внести ошибку типов в любой файл → `bun run typecheck`
падает; создать PR → CI блокирует слияние (SC-004).

## Сценарий 5 — онбординг по README (US3, SC-005)

Человек, не участвовавший в настройке, проходит README от prerequisites до
`curl /health` без вопросов к команде. Любой заданный вопрос — дефект README,
заводится правкой документации.

## Ожидаемые итоги

| Проверка | Критерий |
|---|---|
| `docker compose up --build` → рабочая система | ≤ 10 минут от чистого клона (SC-001) |
| Страница-заглушка в браузере | HTTP 200 (SC-002) |
| Реакция health на отказ/восстановление | ≤ 30 s (SC-003) |
| CI-прогон PR | ≤ 10 минут, красный PR не сливается (SC-004) |
| Онбординг только по README | 0 обращений (SC-005) |
| Данные после перезапуска | сохранены (SC-006) |
