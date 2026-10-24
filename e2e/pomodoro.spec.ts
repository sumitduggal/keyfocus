import { test, expect, dock, newFrame } from './fixtures'

test('timer starts, pauses and resets', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const clock = page.locator('.pomodoro-clock')
  await expect(clock).toHaveText(/25:00/)
  await page.getByRole('button', { name: 'Start focus' }).click()
  await expect(page.getByText('Focus session running')).toBeVisible()
  await page.clock.runFor(61_000)
  await expect(clock).toHaveText(/(24:0|23:5)\d/)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Ready when you are')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(clock).toHaveText(/25:00/)
})

test('presets and custom duration change the clock and persist', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '15 min' }).click()
  await expect(page.locator('.pomodoro-clock')).toHaveText(/15:00/)
  await page.getByPlaceholder('min').fill('40')
  await expect(page.locator('.pomodoro-clock')).toHaveText(/40:00/)
  await page.reload()
  await expect(page.locator('.pomodoro-clock')).toHaveText(/40:00/)
})

test('timer completes', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByPlaceholder('min').fill('1')
  await page.getByRole('button', { name: 'Start focus' }).click()
  await page.clock.runFor(61_000)
  await expect(page.getByText('Interval complete')).toBeVisible()
})

test('a running timer shows in the header, dock and tab title, and keeps counting on another frame', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Start focus' }).click()
  await newFrame(page, 'Todo List', 'Todo List')
  await page.clock.runFor(61_000)
  const chip = page.getByRole('button', { name: /Pomodoro running, 2[34]:\d\d left/ })
  await expect(chip).toBeVisible()
  await expect(dock(page, 'Pomodoro')).toContainText(/2[34]:\d\d left/)
  await expect(page).toHaveTitle(/^2[34]:\d\d · /)
  await chip.click()
  await expect(page.locator('.pomodoro-clock')).toHaveText(/2[34]:\d\d/)
})

test('the header ticket is round and shows when the timer is done', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByPlaceholder('min').fill('1')
  await page.getByRole('button', { name: 'Start focus' }).click()
  const ring = page.locator('.hud-pomodoro-ring')
  const box = (await ring.boundingBox())!
  expect(Math.round(box.width)).toBe(Math.round(box.height))
  await page.clock.runFor(61_000)
  await expect(page.getByRole('button', { name: /Pomodoro complete/ })).toBeVisible()
  await expect(page).toHaveTitle(/^Done · /)
})
