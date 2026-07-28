import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/coverage/**',
      // сгенерированный код не линтуется (конституция, Принцип III)
      'apps/web/generated/**',
      'apps/api/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      // app.vue, error.vue и страницы (index.vue) — однословные по конвенции Nuxt
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // no-undef в типизированных файлах ложно срабатывает на Nuxt auto-imports;
    // неопределённые идентификаторы в TS ловит сам tsc (рекомендация typescript-eslint)
    files: ['**/*.ts', '**/*.vue'],
    rules: { 'no-undef': 'off' },
  },
  prettierConfig,
)
