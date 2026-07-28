<script setup lang="ts">
import { getHealth } from '~~/generated/api'
import type { GetHealthResponse } from '~~/generated/api'

type HealthView = GetHealthResponse | { status: 'unreachable' }

// SSR-запрос: payload передаётся клиенту при гидрации, браузер не ходит на API
// повторно (и не упирается в CORS)
const { data: health } = await useAsyncData('health', async (): Promise<HealthView> => {
  try {
    return await getHealth({ composable: '$fetch' })
  } catch (error) {
    // 503 (degraded) для ofetch — исключение; тело ответа лежит в error.data
    const data = (error as { data?: GetHealthResponse }).data
    return data ?? { status: 'unreachable' }
  }
})

const statusLabel = computed(() => {
  switch (health.value?.status) {
    case 'ok':
      return 'все системы работают'
    case 'degraded':
      return 'часть зависимостей недоступна'
    default:
      return 'API недоступен'
  }
})
</script>

<template>
  <main class="hero">
    <h1>Habito</h1>
    <p class="tagline">Вода, питание и привычки — вместе с друзьями.</p>
    <p class="note">Walking skeleton: каркас проекта работает, функциональность впереди.</p>

    <section class="status" :data-status="health?.status ?? 'unreachable'">
      <h2>Состояние системы</h2>
      <p>{{ statusLabel }}</p>
      <ul v-if="health && 'dependencies' in health">
        <li>
          База данных: {{ health.dependencies.database === 'up' ? 'доступна' : 'недоступна' }}
        </li>
        <li>Кэш: {{ health.dependencies.cache === 'up' ? 'доступен' : 'недоступен' }}</li>
        <li>Версия API: {{ health.version }}</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.hero {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-family: system-ui, sans-serif;
  background: #f0f9ff;
  color: #0c4a6e;
  padding: 1.5rem;
  text-align: center;
}

h1 {
  font-size: 3rem;
  margin: 0;
}

.tagline {
  font-size: 1.25rem;
  margin: 0;
}

.note {
  color: #64748b;
  margin: 0;
}

.status {
  margin-top: 1.5rem;
  padding: 1rem 2rem;
  border-radius: 1rem;
  background: #ffffff;
  box-shadow: 0 4px 16px rgb(12 74 110 / 0.08);
}

.status[data-status='degraded'],
.status[data-status='unreachable'] {
  background: #fef2f2;
  color: #991b1b;
}

.status h2 {
  font-size: 1rem;
  margin: 0 0 0.25rem;
}

.status ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}
</style>
