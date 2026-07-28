# Build context = корень монорепо (bun workspaces).
# Сборка: docker build -f apps/api/Dockerfile .
# Слой зависимостей ставится по одним манифестам (до копирования исходников) —
# кэш переживает любые правки кода (конвенция ranch).

FROM oven/bun:1 AS builder
WORKDIR /build

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: postinstall web (nuxt prepare) здесь не нужен и упал бы
RUN bun install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY apps/api apps/api
RUN cd apps/api && bunx prisma generate

FROM oven/bun:1-slim
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
WORKDIR /app
# Копируется всё дерево сборки: bun исполняет TS без транспиляции, а отдельный
# production-install экономил бы мегабайты ценой усложнения — отложено до
# появления реального веса зависимостей
COPY --from=builder /build /app
WORKDIR /app/apps/api
EXPOSE 3333
CMD ["bun", "src/index.ts"]
