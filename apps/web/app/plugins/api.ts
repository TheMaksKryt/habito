import { client } from '~~/generated/api/client.gen'

// Конфигурация SDK-клиента выполняется в плагине, а не в runtimeConfigPath
// hey-api: сгенерированный client.gen.ts вызывает свой конфиг при ИМПОРТЕ
// модуля, где useRuntimeConfig недоступен в собранном SSR (NUXT_E1001).
// Плагин же гарантированно работает в контексте Nuxt.
//
// Split-horizon baseURL (паттерн main-site): браузер ходит на публичный адрес,
// SSR внутри compose-сети — на внутренний (NUXT_INTERNAL_API_URL), т.к.
// публичный localhost изнутри контейнера web недостижим. Значение зависит
// только от env, не от запроса — общий module-scope клиент безопасен.
export default defineNuxtPlugin(() => {
  const runtime = useRuntimeConfig()
  const baseURL = import.meta.server
    ? process.env.NUXT_INTERNAL_API_URL || runtime.public.apiUrl
    : runtime.public.apiUrl

  client.setConfig({ baseURL })
})
