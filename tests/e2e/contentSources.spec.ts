import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
})

test('trusts a signed publisher, verifies raw package bytes and installs explicitly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop trust workflow is sufficient')
  const packageBytes = readFileSync(resolve('examples/signed-catalog/package.json'))
  await page.route('https://raw.githubusercontent.com/XiaoZheBrother/IELTS-pilot/main/examples/signed-catalog/package.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: packageBytes })
  })
  await page.goto('/library/sources')
  await page.getByTestId('catalog-url').fill('http://127.0.0.1:4173/examples/signed-catalog/catalog.json')
  await page.getByTestId('add-content-source').click()
  await expect(page.getByText('IELTS Pilot Signed Example')).toBeVisible()
  await expect(page.locator('.publisher-fingerprint')).toBeVisible()
  await page.getByTestId('trust-publisher').click()
  await expect(page.getByText('签名可信')).toBeVisible()
  await page.getByTestId('download-verified-package').click()
  await expect(page.getByRole('heading', { name: '安装预览' })).toBeVisible()
  await page.getByTestId('confirm-source-package-install').click()
  await expect(page.getByText(/已安装 Signed Reading Sample/)).toBeVisible()
  await page.goto('/library')
  await expect(page.getByText('Signals on the Library Wall')).toBeVisible()
})

test('keeps the signed source ledger inside the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout check')
  await page.goto('/library/sources')
  await expect(page.getByRole('heading', { name: '可信内容源' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
