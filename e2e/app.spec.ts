import { test, expect, dock, newFrame } from './fixtures'

test.beforeEach(async ({ page }) => page.goto('/'))

test('starts on the pomodoro frame with the dock listed', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Main frame' })).toContainText(/pomodoro/i)
  for (const name of ['Pomodoro', 'Todo List', 'Habits', 'Reminders', 'Settings', 'Log out'])
    await expect(dock(page, name)).toBeVisible()
})

test('creating a todo list stacks the previous frame and survives reload', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  await expect(page.getByLabel('New item')).toBeVisible()
  await expect(page.getByLabel('Latest frames').getByLabel('Frame: Pomodoro')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Latest frames').getByLabel('Frame: Todo List')).toBeVisible()
})

test('clicking a stacked frame promotes it', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  await page.getByLabel('Frame: Pomodoro').click()
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeVisible()
})

test('command palette opens with ⌘K, searches and closes with Escape', async ({ page }) => {
  await page.keyboard.press('Control+k')
  const input = page.getByLabel('Open actions')
  await expect(input).toBeFocused()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
})

test('command palette opens a feature', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await page.getByRole('menuitem', { name: /Habits/ }).first().click()
  await expect(page.getByLabel('New habit')).toBeVisible()
})

test('settings panel toggles theme and persists it', async ({ page }) => {
  const toggle = () => page.getByLabel('Settings', { exact: true }).getByRole('button', { name: /Dark|Light/ })
  await dock(page, 'Settings').click()
  const before = await toggle().innerText()
  await toggle().click()
  const after = await toggle().innerText()
  expect(after).not.toBe(before)
  await page.reload()
  await dock(page, 'Settings').click()
  await expect(toggle()).toHaveText(after)
})

test('settings: Escape and × close the panel; volume and sound can change', async ({ page }) => {
  await dock(page, 'Settings').click()
  const panel = page.getByLabel('Settings', { exact: true })
  await panel.getByLabel('Alert volume').fill('0.5')
  await panel.getByLabel('Timer alert sound').selectOption({ index: 1 })
  await page.getByLabel('Close settings').click()
  await expect(panel).toBeHidden()
  await dock(page, 'Settings').click()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
})

test('starts cleanly from empty and damaged storage', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()
  await expect(dock(page, 'Todo List')).toBeVisible()
  await page.evaluate(() => {
    for (const k of [
      'focus-space-frames',
      'focus-space-theme',
      'focus-space-todo-lists',
      'focus-space-habits',
      'focus-space-reminders',
      'focus-space-music',
    ]) localStorage.setItem(k, '{not json')
  })
  await page.reload()
  await expect(dock(page, 'Todo List')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeVisible()
})

test('mobile tab bar switches sections', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  const tabs = page.getByRole('navigation', { name: 'Sections' })
  await expect(tabs).toBeVisible()
  await tabs.getByRole('button', { name: 'Features' }).click()
  await expect(dock(page, 'Todo List')).toBeVisible()
  await tabs.getByRole('button', { name: 'Active' }).click()
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeVisible()
})

test('the control panel collapses to a rail, widens the main frame, and stays collapsed after reload', async ({ page }) => {
  const frame = page.getByRole('region', { name: 'Main frame' })
  const before = (await frame.boundingBox())!.width
  await page.getByRole('button', { name: 'Hide control panel' }).click()
  // The rail keeps an icon for every item, with the name as a tooltip, but no words.
  for (const name of ['Pomodoro', 'Todo List', 'Habits', 'Reminders', 'Bookmarks', 'Settings', 'Log out'])
    await expect(page.locator(`.dock-item[title="${name}"] .dock-glyph`)).toBeVisible()
  await expect(page.locator('.dock-item[title="Pomodoro"] .dock-copy')).not.toBeInViewport({ ratio: 0.5 })
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeGreaterThan(before + 150)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show control panel' })).toBeVisible()
  await page.getByRole('button', { name: 'Show control panel' }).click()
  await expect(dock(page, 'Pomodoro').locator('.dock-copy')).toBeVisible()
})

test('Alt+Right opens a collapsed control panel', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide control panel' }).click()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(page.getByRole('button', { name: 'Hide control panel' })).toBeVisible()
})

test('the stack collapses to a rail, widens the main frame, and stays collapsed after reload', async ({ page }) => {
  const frame = page.getByRole('region', { name: 'Main frame' })
  const before = (await frame.boundingBox())!.width
  await page.getByRole('button', { name: 'Hide stack' }).click()
  await expect(page.getByRole('button', { name: 'Show stack' })).toBeVisible()
  await expect(page.getByLabel('0 stacked frames')).toBeVisible()
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeGreaterThan(before + 100)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Show stack' })).toBeVisible()
  await page.getByRole('button', { name: 'Show stack' }).click()
  await expect(page.getByRole('button', { name: 'Hide stack' })).toBeVisible()
})

test('a collapsed stack keeps one icon per frame, and clicking one promotes it', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  await page.getByRole('button', { name: 'Hide stack' }).click()
  await expect(page.getByLabel('1 stacked frames')).toBeVisible()
  await page.getByRole('button', { name: 'Frame: Pomodoro' }).click()
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeVisible()
})

test('Alt+Left opens a collapsed stack and focuses its first frame', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  await page.getByRole('button', { name: 'Hide stack' }).click()
  await page.getByRole('region', { name: 'Main frame' }).focus()
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(page.getByRole('button', { name: 'Hide stack' })).toBeVisible()
  await expect(page.getByLabel('Frame: Pomodoro')).toBeFocused()
})
