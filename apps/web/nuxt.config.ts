export default defineNuxtConfig({
  compatibilityDate: '2026-07-15',
  devtools: { enabled: true },

  nitro: {
    preset: 'bun',
  },

  runtimeConfig: {
    public: {
      // ВАЖНО: каждый public-ключ обязан иметь непустой дефолт (`?? ''`) —
      // Nuxt отбрасывает undefined-ключи при сериализации, и runtime-переопределение
      // NUXT_PUBLIC_* молча перестаёт работать (конституция, «Конфигурация и секреты»).
      apiUrl: process.env.NUXT_PUBLIC_API_URL ?? '',
    },
  },
})
