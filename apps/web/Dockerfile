# Build context = корень монорепо (bun workspaces).
# Сборка: docker build -f apps/web/Dockerfile .
# Стадия api-spec собирает OpenAPI-документ из исходников api, чтобы SDK
# генерировался из актуального контракта на момент сборки образа
# (паттерн ranch: стадия swagger-spec в образах фронтендов).

FROM oven/bun:1.4.3 AS deps
WORKDIR /build
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# --ignore-scripts: nuxt prepare выполнится внутри `nuxt build`
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS api-spec
COPY tsconfig.json ./
COPY apps/api apps/api
RUN cd apps/api && bunx prisma generate && bun run openapi:export

FROM deps AS builder
COPY apps/web apps/web
COPY --from=api-spec /build/apps/api/openapi.json apps/api/openapi.json
# NUXT_PUBLIC_API_URL здесь не передаётся: благодаря дефолту `?? ''` в
# runtimeConfig образ конфигурируется переменной окружения при старте
# («build once, configure at start», конституция)
RUN cd apps/web && bun run generate:api && bunx nuxt build

FROM oven/bun:1.4.3-slim
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} NITRO_PORT=3000 NITRO_HOST=0.0.0.0
WORKDIR /app
COPY --from=builder /build/apps/web/.output .output
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
