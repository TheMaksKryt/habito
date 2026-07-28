// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import IndexPage from '~/pages/index.vue'

vi.mock('~~/generated/api', () => ({
  getHealth: vi.fn(async () => ({
    status: 'ok',
    version: 'test',
    dependencies: { database: 'up', cache: 'up' },
  })),
}))

describe('index page', () => {
  it('renders the Habito landing page with system status', async () => {
    const page = await mountSuspended(IndexPage)
    expect(page.text()).toContain('Habito')
    expect(page.text()).toContain('все системы работают')
  })
})
