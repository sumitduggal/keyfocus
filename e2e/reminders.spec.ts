import { test, expect, dock, submit } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dock(page, 'Reminders').click()
})

const add = async (page: import('@playwright/test').Page, text: string) => {
  await page.getByLabel('New reminder').fill(text)
  await submit(page.getByLabel('New reminder'))
}

test('adds a reminder with a date', async ({ page }) => {
  await add(page, 'Call mom @tomorrow')
  await expect(page.locator('.habit-name', { hasText: 'Call mom' })).toBeVisible()
  await expect(page.locator('.reminder-when')).not.toBeEmpty()
})

test('marking a reminder done moves it to the done list', async ({ page }) => {
  await add(page, 'Pay rent @tomorrow')
  await page.getByLabel('Mark Pay rent done').click()
  await expect(page.getByLabel('Mark Pay rent done')).toBeHidden()
  await page.getByRole('button', { name: /done/i }).click()
  await expect(page.getByLabel('Delete Pay rent from done')).toBeVisible()
})

test('edit panel saves a new text and deletes with confirmation', async ({ page }) => {
  await add(page, 'Old name @tomorrow')
  await page.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Old name options' })
  await dialog.getByRole('textbox').first().fill('New name')
  await dialog.getByRole('button', { name: /save/i }).click()
  await expect(page.locator('.habit-name', { hasText: 'New name' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click()
  await page.getByRole('dialog').locator('.todo-danger').click()
  await expect(page.locator('.habit-name', { hasText: 'New name' })).toBeHidden()
})

test('overdue reminder can be snoozed', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await dock(page, 'Reminders').click()
  await add(page, 'Stale @tomorrow')
  await page.clock.fastForward('48:00:00')
  await page.getByRole('button', { name: 'Snooze' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Stale options' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Snooze' })).toBeHidden()
})

test('priority cycles and reminders persist', async ({ page }) => {
  await add(page, 'Keep @tomorrow')
  const pri = page.locator('.todo-priority').first()
  const before = await pri.innerText()
  await pri.click()
  await expect(pri).not.toHaveText(before)
  await page.reload()
  await dock(page, 'Reminders').click()
  await expect(page.locator('.habit-name', { hasText: 'Keep' })).toBeVisible()
})
