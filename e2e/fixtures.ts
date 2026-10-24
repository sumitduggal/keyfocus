import { mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test as base, expect, type Locator, type Page } from '@playwright/test'

// Each test gets a clean app: no audio files, no weather network call, reduced motion.
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route(/open-meteo|geocod|ipapi|ipwho|nominatim/, (route) => route.abort())
    await page.route('**/*.mp3', (route) => route.abort())
    await runTest(page)
    if (process.env.E2E_COVERAGE) {
      const coverage = await page.evaluate(() => (window as unknown as { __coverage__?: unknown }).__coverage__)
      if (coverage) {
        mkdirSync('.nyc_output', { recursive: true })
        writeFileSync(`.nyc_output/${randomUUID()}.json`, JSON.stringify(coverage))
      }
    }
  },
})
export { expect }

export const dock = (page: Page, name: string) => page.locator('.dock-item', { hasText: name })

// Opens a feature with its own "New ..." entry (todo list) and creates a fresh frame.
export async function newFrame(page: Page, feature: string, title: string) {
  await dock(page, feature).click()
  await page.getByRole('button', { name: new RegExp(`New ${title}`, 'i') }).click()
}

// Enter first accepts an open suggestion (for ! and @ tokens), then a second Enter adds the item.
export async function submit(input: Locator) {
  await input.press('Enter')
  if ((await input.inputValue()) !== '') await input.press('Enter')
  await expect(input).toHaveValue('')
}
