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

test('clicking outside the command bar closes it', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('menu')).toBeVisible()
  // The menu's backdrop covers the page, so click at a point on it, as a person would.
  await page.mouse.click(120, 300)
  await expect(page.getByRole('menu')).toBeHidden()
})

test('clicking outside closes a feature sub-menu back to the top level', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await page.getByRole('menuitem', { name: /Todo List/ }).first().click()
  await expect(page.getByText(/Todo List · Esc to go back/)).toBeVisible()
  await page.locator('.hud-top').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menu')).toBeHidden()
  await page.keyboard.press('Control+k')
  await expect(page.getByText('Create or search')).toBeVisible()
})

test('clicking inside the command bar or its menu keeps it open', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await page.getByLabel('Open actions').fill('hab')
  await page.getByLabel('Open actions').click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menu').getByText('Matching actions').click()
  await expect(page.getByRole('menu')).toBeVisible()
})

test('clicking a field outside the command bar closes it and leaves focus in that field', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.locator('.hud-top').click({ position: { x: 5, y: 5 } })
  await expect(page.getByRole('menu')).toBeHidden()
  await page.getByLabel('New item').click()
  await expect(page.getByLabel('New item')).toBeFocused()
})

test('the command bar sits in the footer, centred on it, and the menu opens above it', async ({ page }) => {
  for (const width of [1440, 1100]) {
    await page.setViewportSize({ width, height: 900 })
    const bar = page.locator('.hud-bottom .command-wrap')
    await expect(bar).toBeVisible()
    const barBox = (await bar.boundingBox())!
    const footerBox = (await page.locator('.hud-bottom').boundingBox())!
    expect(Math.abs(barBox.x + barBox.width / 2 - (footerBox.x + footerBox.width / 2))).toBeLessThan(2)
    expect(barBox.y).toBeGreaterThan(footerBox.y)
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(footerBox.y + footerBox.height)
  }
  await page.keyboard.press('Control+k')
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const menuBox = (await menu.boundingBox())!
  const barBox = (await page.locator('.command-wrap').boundingBox())!
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(barBox.y + 1)
})

test('on a narrow screen the command bar floats instead, since the footer is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 })
  await expect(page.locator('.command-wrap')).toBeVisible()
  await expect(page.locator('.hud-bottom .command-wrap')).toHaveCount(0)
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

test('stacked cards look like their frame right now, not the template copy', async ({ page }) => {
  await newFrame(page, 'Todo List', 'Todo List')
  const pomodoro = page.getByLabel('Frame: Pomodoro')
  await expect(pomodoro).toContainText('25:00')
  await expect(pomodoro).toContainText('Standby')
  await page.getByLabel('New item').fill('Send the proposal')
  await page.keyboard.press('Enter')
  await dock(page, 'Habits').click()
  const todo = page.getByLabel('Frame: Todo List')
  await expect(todo).toContainText('Send the proposal')
  await expect(todo).not.toContainText('focused list')
  await expect(todo).toHaveAttribute('title', '1 open · Send the proposal')
})

test('a stacked Pomodoro card shows the timer as it runs', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Start focus' }).click()
  await newFrame(page, 'Todo List', 'Todo List')
  await page.clock.runFor(61_000)
  const card = page.getByLabel('Frame: Pomodoro')
  await expect(card).toContainText('Session live')
  await expect(card).toContainText(/2[34]:\d\d/)
})

const HOUR = 60 * 60 * 1000

test('a frame left in the stack for an hour leaves the stack bar but stays saved and reachable', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await newFrame(page, 'Todo List', 'Todo List')
  await page.getByLabel('New item').fill('Send the proposal')
  await page.keyboard.press('Enter')
  await dock(page, 'Habits').click()
  const card = page.getByLabel('Latest frames').getByLabel('Frame: Todo List')
  await expect(card).toBeVisible()
  // Moving to the stack has saved everything: the frame and its items are in storage already.
  const saved = await page.evaluate(() => [localStorage.getItem('focus-space-frames'), localStorage.getItem('focus-space-todo-lists')].join(' '))
  expect(saved).toContain('Todo List')
  expect(saved).toContain('Send the proposal')

  await page.clock.fastForward(HOUR - 60_000)
  await expect(card).toBeVisible()
  await page.clock.fastForward(2 * 60_000)
  await expect(card).toBeHidden()

  // Nothing was deleted: the list opens again from the dock with its item.
  await dock(page, 'Todo List').click()
  await page.locator('.feature-entry-list button:not(.feature-new)').first().click()
  await expect(page.getByLabel('Edit item: Send the proposal')).toBeVisible()
})

test('a frame that comes back from the stack starts a fresh hour', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await newFrame(page, 'Todo List', 'Todo List')
  await page.clock.fastForward(HOUR - 60_000)
  await page.getByLabel('Frame: Pomodoro').click()
  await dock(page, 'Todo List').click()
  await page.clock.fastForward(2 * 60_000)
  await expect(page.getByLabel('Latest frames').getByLabel('Frame: Todo List')).toBeVisible()
})

test('weather asks for a location once on the first visit, then leaves a link', async ({ page }) => {
  let asked = false
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = () => {
      ;(window as unknown as { asked: boolean }).asked = true
    }
  })
  // beforeEach already visited once, so start over as a new visitor.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByLabel('Weather location')).toBeVisible()
  asked = await page.evaluate(() => Boolean((window as unknown as { asked?: boolean }).asked))
  expect(asked).toBe(false)

  await page.getByLabel('Weather location').press('Escape')
  await expect(page.getByRole('button', { name: /Add location/ })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Weather location')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Add location/ })).toBeVisible()
})

test('the temperature unit is set in Settings, drives the weather request and survives reload', async ({ page }) => {
  const units: (string | null)[] = []
  await page.unroute(/open-meteo|geocod|ipapi|ipwho|nominatim/)
  await page.route(/open-meteo/, (route) => {
    units.push(new URL(route.request().url()).searchParams.get('temperature_unit'))
    return route.fulfill({
      json: {
        timezone: 'Europe/Berlin',
        current: { temperature_2m: 20, weather_code: 0, is_day: 1 },
        current_units: { temperature_2m: '°' },
      },
    })
  })
  await page.evaluate(() =>
    localStorage.setItem('focus-space-weather-place', JSON.stringify({ name: 'Berlin', latitude: 52.5, longitude: 13.4 })),
  )
  await page.reload()
  await page.getByTitle('Settings').click()
  const toggle = page.getByRole('button', { name: /Temperature unit/ })
  const before = await toggle.textContent()
  await toggle.click()
  await expect(toggle).not.toHaveText(before!)
  await expect.poll(() => new Set(units).size).toBe(2)

  const chosen = await toggle.textContent()
  await page.reload()
  await page.getByTitle('Settings').click()
  await expect(page.getByRole('button', { name: /Temperature unit/ })).toHaveText(chosen!)
})
