import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

test('keeps secrets ephemeral and exports a real encrypted vault', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  await page.getByRole('link', { name: '同步', exact: true }).click()
  await page.getByTestId('profile-id').fill('desktop-main')
  await page.getByTestId('endpoint').fill('https://sync.example.test')
  await page.getByTestId('passphrase').fill('correct-horse-battery-staple')
  await page.getByTestId('access-token').fill('ephemeral-access-token')
  await page.getByTestId('save-sync-settings').click()

  const stored = await page.evaluate(() => JSON.stringify(localStorage))
  expect(stored).toContain('sync.example.test')
  expect(stored).not.toContain('correct-horse-battery-staple')
  expect(stored).not.toContain('ephemeral-access-token')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-vault').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('ielts-pilot-desktop-main.vault.json')
  await expect(page.getByText(/加密保险库已导出/)).toBeVisible()
})

test('keeps the sync console inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout check')
  await page.goto('/sync')
  await expect(page.getByRole('heading', { name: '加密同步中心' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
