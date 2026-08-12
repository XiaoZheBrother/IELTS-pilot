import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

test('captures the v0.8 release surfaces', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'release screenshots use the desktop viewport')
  const output = resolve('artifacts')
  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.getByRole('heading', { name: '完整模考' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.8-dashboard.png') })

  await page.goto('/sync')
  await expect(page.getByRole('heading', { name: '加密同步中心' })).toBeVisible()
  await page.getByTestId('endpoint').fill('https://sync.example.com')
  await page.screenshot({ path: resolve(output, 'v0.8-encrypted-sync.png') })

  await page.goto('/library/sources')
  await page.getByTestId('catalog-url').fill('http://127.0.0.1:4173/examples/signed-catalog/catalog.json')
  await page.getByTestId('add-content-source').click()
  await page.getByTestId('trust-publisher').click()
  await expect(page.getByText('签名可信')).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.8-signed-content-source.png') })

  await page.goto('/updates')
  await expect(page.getByRole('heading', { name: '应用更新' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.8-secure-updates.png') })

  await page.goto('/practice/shade-networks')
  await expect(page.getByText('Question 1 / 13')).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.8-practice.png') })
})
