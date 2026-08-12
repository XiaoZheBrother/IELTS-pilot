import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

test('captures the v0.5 release surfaces', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'release screenshots use the desktop viewport')
  const output = resolve('artifacts')
  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await expect(page.getByRole('heading', { name: '完整模考' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.5-dashboard.png') })

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '阅读设置' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.5-settings.png') })

  await page.goto('/practice/shade-networks')
  await expect(page.getByText('Question 1 / 13')).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.5-practice.png') })

  await page.goto('/library/packages')
  await page.locator('input[type="file"]').setInputFiles(resolve('examples/sample-content-package-v2.json'))
  await expect(page.getByRole('heading', { name: '安装预览' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.5-package-preview.png') })

  await page.goto('/library/editor')
  await expect(page.getByRole('heading', { name: '创建题库包' })).toBeVisible()
  await page.screenshot({ path: resolve(output, 'v0.5-package-editor.png') })
})
