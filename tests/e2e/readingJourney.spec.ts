import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('shows the complete mock and searchable original practice library', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '完整模考' })).toBeVisible()
  await expect(page.getByTestId('practice-card')).toHaveCount(3)
  await page.getByRole('link', { name: '题库', exact: true }).click()
  await expect(page).toHaveURL(/\/library$/)
  await page.getByRole('searchbox').fill('rainwater')
  await expect(page.getByTestId('library-row')).toHaveCount(1)
  await expect(page.getByText('The Ledger Beneath the Roof')).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({ name: 'unsafe.json', mimeType: 'application/json', buffer: Buffer.from('{broken') })
  await expect(page.getByText(/导入失败/)).toBeVisible()
})

test('completes a forty-question mock and opens source-linked review', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop journey is sufficient')
  await page.getByRole('link', { name: /开始模考/ }).click()
  await expect(page).toHaveURL(/\/mock\/reading-mock-01$/)
  await expect(page.getByTestId('mock-question')).toHaveCount(40)
  await page.locator('input[type="radio"][value="B"]').first().check()
  await page.getByRole('button', { name: '提交试卷' }).click()
  await expect(page.getByRole('dialog')).toContainText('1 / 40')
  await page.getByRole('button', { name: '确认提交' }).click()

  await expect(page).toHaveURL(/\/result\//)
  await expect(page.getByRole('heading', { name: '1 / 40' })).toBeVisible()
  await expect(page.locator('.review-row')).toHaveCount(40)
  await page.locator('.review-row').first().getByRole('button', { name: '查看原文' }).click()
  await expect(page.getByTestId('source-excerpt')).toContainText('Bellwether')
  await page.reload()
  await expect(page.getByRole('heading', { name: '1 / 40' })).toBeVisible()
  await page.getByRole('link', { name: '查看统计' }).click()
  await expect(page.getByText('1 次')).toBeVisible()
})

test('restores an answer and flag after reloading an active practice', async ({ page }) => {
  await page.goto('/practice/repair-libraries')
  await page.locator('input[type="radio"][value="B"]').first().check()
  await page.getByRole('button', { name: '标记此题' }).click()
  await page.reload()
  await expect(page.locator('input[type="radio"][value="B"]').first()).toBeChecked()
  await expect(page.getByRole('button', { name: '已标记' })).toBeVisible()
  await expect(page.locator('.compact-question-nav button.answered')).toHaveCount(1)
})

test('keeps the mobile mock workspace within the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout check')
  await page.goto('/mock/reading-mock-01')
  await expect(page.getByRole('button', { name: '阅读文章' })).toBeVisible()
  await expect(page.getByRole('button', { name: '回答问题' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
