import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('completes a reading practice, scores it and preserves the report', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /读懂文章/ })).toBeVisible()
  await page.getByTestId('practice-card').first().getByRole('link', { name: /开始练习/ }).click()

  await expect(page).toHaveURL(/\/practice\/shade-networks$/)
  await expect(page.locator('.reading-paper h1')).toHaveText('The Shade Between Buildings')
  await page.locator('input[type="radio"][value="B"]').first().check()
  await page.getByRole('button', { name: /下一题/ }).click()
  await page.locator('input[type="radio"][value="false"]').check()

  await page.getByRole('button', { name: '提前提交本套练习' }).click()
  await expect(page.getByRole('dialog')).toContainText('2 / 8 题')
  await page.getByRole('button', { name: '确认提交' }).click()

  await expect(page).toHaveURL(/\/result\//)
  await expect(page.getByRole('heading', { name: '2 / 8' })).toBeVisible()
  await expect(page.getByText('Band 4.0')).toBeVisible()
  await expect(page.getByRole('heading', { name: '逐题复盘' })).toBeVisible()
  await expect(page.locator('.review-item')).toHaveCount(8)

  await page.reload()
  await expect(page.getByRole('heading', { name: '2 / 8' })).toBeVisible()
})

test('restores a saved answer after reloading an active practice', async ({ page }) => {
  await page.goto('/practice/repair-libraries')
  const answer = page.locator('input[type="radio"][value="B"]').first()
  await answer.check()
  await page.reload()

  await expect(page.locator('input[type="radio"][value="B"]').first()).toBeChecked()
  await expect(page.getByText('1 / 8 已作答')).toBeVisible()
})

test('keeps the mobile practice workspace within the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout check')
  await page.goto('/practice/shade-networks')

  await expect(page.getByRole('button', { name: '阅读文章' })).toBeVisible()
  await expect(page.getByRole('button', { name: '回答问题' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
