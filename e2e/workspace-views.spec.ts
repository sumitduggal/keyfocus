import type { Locator, Page } from '@playwright/test'
import { test, expect, submit } from './fixtures'

const WORKSPACE_VIEW_KEY = 'focus-space-workspace-view'

const views = [
  { id: 'operator', label: 'Operator Console' },
  { id: 'calm', label: 'Calm Workspace' },
  { id: 'immersive', label: 'Immersive Focus' },
  { id: 'overview', label: 'Daily Overview' },
] as const

type ViewId = (typeof views)[number]['id']

const workspaceRoot = (page: Page, view: ViewId) =>
  page.locator(`[data-workspace-view="${view}"]`)

async function openWorkspace(page: Page, view: ViewId) {
  await page.addInitScript(
    ({ key, id }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, id)
    },
    { key: WORKSPACE_VIEW_KEY, id: view },
  )
  await page.goto('/')
  await expect(workspaceRoot(page, view)).toBeVisible()
}

async function switchWorkspace(page: Page, view: ViewId) {
  await page.evaluate(
    ({ key, id }) => localStorage.setItem(key, id),
    { key: WORKSPACE_VIEW_KEY, id: view },
  )
  await page.reload()
  await expect(workspaceRoot(page, view)).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true)
}

for (const view of views) {
  test(`${view.label} renders its adapter and persists after reload`, async ({ page }) => {
    await openWorkspace(page, view.id)
    await expect.poll(() =>
      page.evaluate((key) => localStorage.getItem(key), WORKSPACE_VIEW_KEY),
    ).toBe(view.id)

    await page.reload()

    await expect(workspaceRoot(page, view.id)).toBeVisible()
    await expect.poll(() =>
      page.evaluate((key) => localStorage.getItem(key), WORKSPACE_VIEW_KEY),
    ).toBe(view.id)
  })

  test(`${view.label} has no horizontal page overflow at phone width`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openWorkspace(page, view.id)
    await expectNoHorizontalOverflow(page)
  })
}

for (const view of views.filter(({ id }) => id !== 'operator')) {
  test(`${view.label} opens the shared command palette with ⌘K`, async ({ page }) => {
    await openWorkspace(page, view.id)
    await page.keyboard.press('Control+k')

    await expect(page.getByLabel('Open actions')).toBeFocused()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Todo List/ })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
  })
}

test('a real Todo list can be created in Calm, promoted and edited in Immersive, then opened in Operator', async ({ page }) => {
  await openWorkspace(page, 'calm')
  await page.keyboard.press('Control+k')
  await page.getByRole('menuitem', { name: /Todo List/ }).click()
  await page.getByRole('menuitem', { name: /New Todo List/ }).click()

  await page.getByLabel('List name').fill('Cross-view plan')
  await page.getByLabel('List name').press('Enter')
  await page.getByLabel('New item').fill('Draft cross-view task')
  await submit(page.getByLabel('New item'))
  await expect(page.getByLabel('Edit item: Draft cross-view task')).toBeVisible()

  await switchWorkspace(page, 'immersive')
  await page.getByRole('button', { name: /Latest opened/i }).click()
  const latestOpened = page.getByRole('group', { name: /Latest opened/i })
  await latestOpened.getByRole('button', { name: /Cross-view plan/ }).click()

  await expect(page.getByRole('region', { name: 'Cross-view plan', exact: true })).toBeVisible()
  await page.getByLabel('Edit item: Draft cross-view task').fill('Review cross-view task')
  await expect(page.getByLabel('Edit item: Review cross-view task')).toBeVisible()

  await switchWorkspace(page, 'operator')
  await page.keyboard.press('Control+k')
  await page.getByRole('menuitem', { name: /Search/ }).click()
  await page.getByLabel('Open actions').fill('Cross-view plan')
  await page.getByRole('menuitem', { name: /Cross-view plan/ }).click()

  await expect(page.getByRole('region', { name: 'Cross-view plan', exact: true })).toBeVisible()
  await expect(page.getByLabel('Edit item: Review cross-view task')).toBeVisible()
})

async function expectNoOverlap(first: Locator, second: Locator) {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()])
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  if (!firstBox || !secondBox) return

  const separated = firstBox.x + firstBox.width <= secondBox.x
    || secondBox.x + secondBox.width <= firstBox.x
    || firstBox.y + firstBox.height <= secondBox.y
    || secondBox.y + secondBox.height <= firstBox.y
  expect(separated).toBe(true)
}

test('Calm keeps phone feature controls clear of the command bar and Recent frames reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openWorkspace(page, 'calm')

  const features = page.getByRole('navigation', { name: 'Features', exact: true })
  const commandBar = page.getByLabel('Open actions')
  await expect(features).toBeVisible()
  await expect(commandBar).toBeVisible()

  for (const name of ['Pomodoro', 'Todo List', 'Habits', 'Reminders', 'Bookmarks']) {
    const control = features.getByRole('button', { name: new RegExp(`^${name}`) })
    await expect(control).toBeVisible()
    await expectNoOverlap(control, commandBar)
  }

  await features.getByRole('button', { name: /^Habits/ }).click()
  await expect(page.getByRole('region', { name: 'Habits', exact: true })).toBeVisible()
  await features.getByRole('button', { name: /^Reminders/ }).click()
  await expect(page.getByRole('region', { name: 'Reminders', exact: true })).toBeVisible()

  const recentFrames = page.getByRole('region', { name: 'Recent frames', exact: true })
  await expect(recentFrames).toBeVisible()
  await expect(recentFrames.getByRole('button')).toHaveCount(2)
  const pomodoro = recentFrames.getByRole('button', { name: 'Promote frame: Pomodoro', exact: true })
  await pomodoro.scrollIntoViewIfNeeded()
  await expect(pomodoro).toBeInViewport()
  await pomodoro.click()
  await expect(page.getByRole('region', { name: 'Pomodoro', exact: true })).toBeVisible()
})

test('Immersive keeps phone navigation visible and Latest opened initially collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openWorkspace(page, 'immersive')

  const latestOpened = page.getByRole('button', { name: /Latest opened/i })
  await expect(latestOpened).toBeVisible()
  await expect(latestOpened).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('group', { name: 'Latest opened frames', exact: true })).toBeHidden()

  const features = page.getByRole('navigation', { name: 'Features', exact: true })
  await expect(features).toBeVisible()
  for (const name of ['Focus', 'Todo List', 'Habits', 'Reminders', 'Bookmarks']) {
    await expect(features.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Now playing', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
})
