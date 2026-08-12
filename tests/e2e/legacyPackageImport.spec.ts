import { expect, test } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const packagePath = process.env.LEGACY_PACKAGE_PATH
const screenshotPath = process.env.LEGACY_IMPORT_SCREENSHOT
const packageDirectory = process.env.LEGACY_PACKAGE_DIRECTORY
const allPackagesScreenshotPath = process.env.LEGACY_ALL_PACKAGES_SCREENSHOT

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
})

test('imports a converted IELTS-practice package through the real UI', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  test.skip(!packagePath, 'Set LEGACY_PACKAGE_PATH to run against a locally converted private package.')

  await page.goto('/library/packages')
  await page.locator('input[type="file"]').setInputFiles(resolve(packagePath!))
  await expect(page.getByText('Private Atlas P1 001', { exact: true })).toBeVisible()
  await page.getByTestId('confirm-package-install').click()
  await expect(page.getByRole('heading', { name: 'Private Atlas P1 001' })).toBeVisible()

  await page.goto('/library')
  await expect(page.getByText('A Brief History of Tea 茶叶简史', { exact: true })).toBeVisible()
  if (screenshotPath) await page.screenshot({ path: resolve(screenshotPath), fullPage: true })
})

test('installs the complete converted bank without exceeding browser storage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  test.skip(!packageDirectory, 'Set LEGACY_PACKAGE_DIRECTORY to run against the complete local conversion.')
  const files = readdirSync(resolve(packageDirectory!))
    .filter((name) => /^private-atlas-p[123]-\d{3}\.json$/i.test(name))
    .sort()
  expect(files).toHaveLength(11)

  await page.goto('/library/packages')
  for (const file of files) {
    await page.locator('input[type="file"]').setInputFiles(resolve(packageDirectory!, file))
    await page.getByTestId('confirm-package-install').click()
  }
  await expect(page.locator('.installed-package')).toHaveCount(11)

  await page.goto('/library')
  await expect(page.getByText('A Brief History of Tea 茶叶简史', { exact: true })).toBeVisible()
  await expect(page.getByText('Look who was talking', { exact: true })).toBeVisible()
  await page.goto('/library/packages')
  if (allPackagesScreenshotPath) await page.screenshot({ path: resolve(allPackagesScreenshotPath), fullPage: true })
})
