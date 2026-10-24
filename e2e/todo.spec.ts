import { test, expect, newFrame, submit } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await newFrame(page, 'Todo List', 'Todo List')
})

const add = async (page: import('@playwright/test').Page, text: string) => {
  await page.getByLabel('New item').fill(text)
  await submit(page.getByLabel('New item'))
}

test('adds items, shows empty hint and open count', async ({ page }) => {
  await expect(page.getByText('No items yet')).toBeVisible()
  await add(page, 'Write report')
  await add(page, 'Buy milk')
  await expect(page.getByRole('list', { name: 'Todo items' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.locator('.frame-foot', { hasText: '2 open' })).toBeVisible()
})

test('completing an item updates progress and filters', async ({ page }) => {
  await add(page, 'One')
  await add(page, 'Two')
  await page.getByLabel('Mark done: One').click()
  await expect(page.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute('aria-valuenow', '1')
  await expect(page.locator('.frame-foot', { hasText: '1 open' })).toBeVisible()
  const filter = page.getByRole('group', { name: 'Filter' })
  await filter.getByRole('button', { name: /^open$/i }).click()
  await expect(page.getByLabel('Mark done: Two')).toBeVisible()
  await expect(page.getByLabel('Mark not done: One')).toBeHidden()
  await filter.getByRole('button', { name: /^all$/i }).click()
  await expect(page.getByLabel('Mark not done: One')).toBeVisible()
})

test('priority and date tokens are parsed from the text', async ({ page }) => {
  await add(page, 'Ship it !high @tomorrow')
  await expect(page.getByLabel('Priority high, change')).toBeVisible()
  await expect(page.getByLabel('Due date: Ship it')).not.toHaveValue('')
})

test('priority button cycles', async ({ page }) => {
  await add(page, 'Cycle me')
  const first = await page.locator('.todo-priority').first().innerText()
  await page.locator('.todo-priority').first().click()
  await expect(page.locator('.todo-priority').first()).not.toHaveText(first)
})

test('items can be nested and un-nested', async ({ page }) => {
  await add(page, 'Parent')
  await add(page, 'Child')
  await page.getByLabel('Nest under the item above: Child').click()
  await expect(page.getByLabel('Move up a level: Child')).toBeVisible()
  await page.getByLabel('Move up a level: Child').click()
  await expect(page.getByLabel('Nest under the item above: Child')).toBeVisible()
})

test('deleting an item can be undone with ⌘Z', async ({ page }) => {
  await add(page, 'Temporary')
  await page.getByLabel('Delete Temporary').click()
  await expect(page.getByLabel('Mark done: Temporary')).toBeHidden()
  await expect(page.getByRole('status')).toBeVisible()
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await expect(page.getByLabel('Mark done: Temporary')).toBeVisible()
})

test('clear completed removes only done items', async ({ page }) => {
  await add(page, 'Keep')
  await add(page, 'Drop')
  await page.getByLabel('Mark done: Drop').click()
  await page.getByRole('button', { name: /clear/i }).click()
  await expect(page.getByLabel('Mark done: Keep')).toBeVisible()
  await expect(page.getByLabel('Mark not done: Drop')).toBeHidden()
})

test('items persist across reload', async ({ page }) => {
  await add(page, 'Remember me')
  await page.reload()
  await page.getByLabel('Frame: Todo List').click()
  await expect(page.getByLabel('Mark done: Remember me')).toBeVisible()
})

test('deleting the list asks for confirmation', async ({ page }) => {
  await page.locator('.todo-delete-list').click()
  const dialog = page.getByRole('alertdialog', { name: 'Confirm delete list' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /cancel|keep|no/i }).click()
  await expect(dialog).toBeHidden()
  await page.locator('.todo-delete-list').click()
  await page.locator('.todo-danger').click()
  await expect(page.getByLabel('New item')).toBeHidden()
})
