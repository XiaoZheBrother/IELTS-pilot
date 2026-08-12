import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

test('persists night reading settings and a favorite passage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  await page.getByRole('link', { name: '设置', exact: true }).click()
  await page.getByTestId('theme-night').check()
  await page.getByTestId('font-scale').fill('1.2')
  await page.getByTestId('save-preferences').click()
  await expect(page.locator('html')).toHaveAttribute('data-reader-theme', 'night')
  await page.reload()
  await expect(page.getByTestId('theme-night')).toBeChecked()

  await page.getByRole('link', { name: '题库', exact: true }).click()
  await page.getByTestId('favorite-set').first().click()
  await page.getByRole('link', { name: '收藏', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The Shade Between Buildings' })).toBeVisible()
})

test('previews, installs and removes a schema v2 content package', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  await page.goto('/library/packages')
  await page.locator('input[type="file"]').setInputFiles(resolve('examples/sample-content-package-v2.json'))
  await expect(page.getByRole('heading', { name: '安装预览' })).toBeVisible()
  await page.getByTestId('confirm-package-batch-install').click()
  await expect(page.getByRole('heading', { name: 'Community Rooftop Sample' })).toBeVisible()
  await page.goto('/library')
  await expect(page.getByText('A Rooftop That Watches the Weather')).toBeVisible()
  await page.goto('/library/packages')
  await page.getByTestId('uninstall-package').click()
  await expect(page.getByText(/尚未安装外部题库/)).toBeVisible()
})

test('saves and reopens a local authoring draft', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop workflow is sufficient')
  await page.goto('/library/editor')
  await page.locator('input[name="package-name"]').fill('Field Notes Pack')
  await page.getByTestId('save-author-draft').click()
  await page.reload()
  await expect(page.getByText('Field Notes Pack')).toBeVisible()
  await page.getByTestId('load-author-draft').click()
  await expect(page.locator('input[name="package-name"]')).toHaveValue('Field Notes Pack')
})
