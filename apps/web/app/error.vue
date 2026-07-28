<script setup lang="ts">
import type { NuxtError } from '#app'

const { error } = defineProps<{ error: NuxtError }>()
</script>

<template>
  <main class="error">
    <h1>{{ error.statusCode }}</h1>
    <p>Что-то пошло не так.</p>
    <button type="button" @click="clearError({ redirect: '/' })">На главную</button>
  </main>
</template>

<style scoped>
.error {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: system-ui, sans-serif;
}
</style>
