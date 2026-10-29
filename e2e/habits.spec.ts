import { test, expect, dock } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dock(page, 'Habits').click()
})

const add = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByLabel('New habit').fill(name)
  await page.getByLabel('New habit').press('Enter')
}

test('adds a habit with a weekly target', async ({ page }) => {
  await page.getByLabel('Times per week').selectOption('3')
  await add(page, 'Read')
  await expect(page.getByLabel('Habit name')).toHaveValue('Read')
  await expect(page.getByLabel('0 of 3 this week')).toBeVisible()
})

test('ticking a day updates weekly progress and persists', async ({ page }) => {
  await add(page, 'Stretch')
  await page.getByRole('group', { name: 'Stretch this week' }).getByRole('button', { disabled: false }).first().click()
  await expect(page.getByLabel(/^1 of \d this week$/)).toBeVisible()
  await page.reload()
  await dock(page, 'Habits').click()
  await expect(page.getByLabel(/^1 of \d this week$/)).toBeVisible()
})

test('options popup opens and closes with Escape', async ({ page }) => {
  await add(page, 'Walk')
  await page.getByRole('button', { name: 'More' }).click()
  const popup = page.getByRole('dialog', { name: 'Walk options' })
  await expect(popup).toBeVisible()
  await expect(popup.getByText('Best week')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popup).toBeHidden()
})

test('history range toggles between week and year', async ({ page }) => {
  await add(page, 'Walk')
  await page.getByRole('button', { name: 'More' }).click()
  const range = page.getByRole('group', { name: 'History range' })
  const [first, second] = await range.getByRole('button').all()
  await second.click()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
})

test('archive then restore, and delete asks for confirmation', async ({ page }) => {
  await add(page, 'Journal')
  await page.getByRole('button', { name: 'More' }).click()
  await page.getByRole('button', { name: /archive/i }).click()
  await expect(page.getByLabel('Habit name')).toBeHidden()
  await page.getByRole('button', { name: /archived/i }).click()
  await page.getByRole('button', { name: /restore|unarchive/i }).click()
  await expect(page.getByLabel('Habit name')).toHaveValue('Journal')
  await page.getByRole('button', { name: 'More' }).click()
  await page.locator('.habit-options .is-danger').click()
  await page.locator('.habit-options .is-danger').click()
  await expect(page.getByLabel('Habit name')).toBeHidden()
})
