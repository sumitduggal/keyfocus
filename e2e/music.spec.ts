import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Music options', { exact: true }).click()
})

test('music popup opens with tabs and closes', async ({ page }) => {
  const popup = page.getByRole('dialog', { name: 'Music options' })
  await expect(popup).toBeVisible()
  const tabs = popup.getByRole('tab')
  expect(await tabs.count()).toBeGreaterThan(1)
  await tabs.nth(1).click()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  await tabs.nth(0).click()
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.getByLabel('Close music options').click()
  await expect(popup).toBeHidden()
})

test('radio tab has a station search', async ({ page }) => {
  const popup = page.getByRole('dialog', { name: 'Music options' })
  await popup.getByRole('tab', { name: /radio/i }).click()
  await expect(popup.getByLabel('Search radio stations')).toBeVisible()
})
