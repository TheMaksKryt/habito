import { expect, test } from '@playwright/test'

// В отличие от tests/smoke.test.ts SDK здесь не мокается: страница рендерится
// SSR на nitro-bun, а /health отдаёт реальный api. Зелёный прогон означает, что
// вся цепочка OpenAPI → SDK → runtime-конфиг → API работает.
test('главная страница показывает статус живой системы', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Habito')

  const status = page.locator('section.status')
  await expect(status).toHaveAttribute('data-status', 'ok')
  await expect(status).toContainText('все системы работают')
  await expect(status).toContainText('База данных: доступна')
  await expect(status).toContainText('Кэш: доступен')
})
