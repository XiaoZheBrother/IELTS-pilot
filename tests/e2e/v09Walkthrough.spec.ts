import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve('artifacts', 'v0.9-walkthrough')
const realAi = process.env.V09_REAL_AI === '1'

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: resolve(output, `${name}.png`), animations: 'disabled' })
}

test('walks through the complete v0.9 product with demonstration data', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the documented walkthrough uses the desktop viewport')
  test.setTimeout(240_000)
  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 960 })

  await page.route('https://raw.githubusercontent.com/XiaoZheBrother/IELTS-pilot/main/examples/signed-catalog/package.json', async (route) => {
    await route.fulfill({ path: resolve('examples', 'signed-catalog', 'package.json'), contentType: 'application/json' })
  })
  if (!realAi) {
    await page.route('**/api/v1/writing/health', async (route) => route.fulfill({ json: { available: true, mode: 'gateway', model: 'walkthrough-fixture', promptVersion: 'writing-v1' } }))
    await page.route('**/api/v1/writing/evaluate', async (route) => route.fulfill({ json: {
      model: 'walkthrough-fixture', requestId: 'walkthrough-ai-request',
      content: JSON.stringify({
        summary: '文章清晰讨论数字服务与实体空间，并以消除不同学习障碍为主线形成一致立场。',
        criteria: [
          { criterion: 'task-response', band: 7, rationale: '双方观点均得到展开，立场明确且贯穿全文。' },
          { criterion: 'coherence-cohesion', band: 6.5, rationale: '段落推进清晰，少量连接方式仍可更自然。' },
          { criterion: 'lexical-resource', band: 7, rationale: '议题词汇准确，搭配自然且具有变化。' },
          { criterion: 'grammatical-range-accuracy', band: 7.5, rationale: '复合句控制稳定，错误极少。' },
        ],
        strengths: ['明确区分了两类服务所解决的障碍。', '结论与正文论证一致。'],
        priorities: ['减少段首显性连接词。', '补充一个更具体的预算案例。'],
        evidence: [
          { criterion: 'task-response', quote: 'The best policy is consequently a balanced one.', observation: '直接呈现作者的平衡立场。', revision: 'A balanced funding model is therefore the most defensible policy.' },
          { criterion: 'lexical-resource', quote: 'a form of educational infrastructure', observation: '概括实体空间的公共价值。', revision: 'an essential part of a city’s educational infrastructure' },
        ],
      }),
      usage: { promptTokens: 1200, completionTokens: 500, totalTokens: 1700 },
    } }))
  }

  await page.goto('/settings')
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()
  await page.getByTestId('install-demo-profile').scrollIntoViewIfNeeded()
  await page.getByTestId('install-demo-profile').click()
  await expect(page.getByTestId('confirm-demo-profile')).toBeVisible()
  await page.getByTestId('confirm-demo-profile').click()
  await expect(page.getByText('演示数据已准备完成')).toBeVisible()
  await capture(page, '01-settings-demo-profile')

  await page.goto('/')
  await expect(page.getByText('3次练习', { exact: true })).toBeVisible()
  await capture(page, '02-dashboard-with-history')

  await page.goto('/library')
  await expect(page.locator('[data-testid="library-row"]')).toHaveCount(5)
  await capture(page, '03-reading-library')

  await page.goto('/practice/shade-networks')
  await expect(page.getByText(/Question 5 \/ 13/)).toBeVisible()
  await capture(page, '04-reading-practice-autosave')

  await page.goto('/result/demo-reading-1')
  await expect(page.locator('main h1')).toBeVisible()
  await capture(page, '05-reading-result-review')

  await page.goto('/errors')
  await expect(page.locator('[data-testid="error-row"]').first()).toBeVisible()
  await capture(page, '06-error-book')

  await page.goto('/favorites')
  await expect(page.locator('main h1')).toBeVisible()
  await capture(page, '07-favorites')

  await page.goto('/analytics')
  await expect(page.getByText('3 次')).toBeVisible()
  await capture(page, '08-learning-analytics')

  await page.goto('/library/editor')
  await expect(page.getByRole('heading', { name: '创建题库包' })).toBeVisible()
  await page.getByTestId('save-author-draft').click()
  await capture(page, '09-package-editor')

  await page.goto('/library/sources')
  const origin = new URL(page.url()).origin
  await page.getByTestId('catalog-url').fill(`${origin}/examples/signed-catalog/catalog.json`)
  await page.getByTestId('add-content-source').click()
  await page.getByTestId('trust-publisher').click()
  await expect(page.getByText('签名可信')).toBeVisible()
  await capture(page, '10-signed-content-trust')
  await page.getByTestId('download-verified-package').click()
  await expect(page.getByTestId('confirm-source-package-install')).toBeEnabled()
  await page.getByTestId('confirm-source-package-install').click()

  await page.goto('/library/packages')
  await expect(page.getByText('Signed Reading Sample')).toBeVisible()
  await capture(page, '11-installed-content-package')

  await page.goto('/sync')
  await page.getByTestId('profile-id').fill('walkthrough-profile')
  await page.getByTestId('endpoint').fill('https://sync.example.com')
  await page.getByTestId('passphrase').fill('local-demo-passphrase')
  await capture(page, '12-encrypted-sync')

  await page.goto('/updates')
  await expect(page.getByRole('heading', { name: '应用更新' })).toBeVisible()
  await capture(page, '13-secure-updates')

  await page.goto('/about')
  await expect(page.getByText('0.9.8')).toBeVisible()
  await capture(page, '14-about-and-attribution')

  await page.goto('/writing')
  await expect(page.getByRole('heading', { name: 'AI 写作工作室' })).toBeVisible()
  await page.getByTestId('load-demo-essay').click()
  await expect(page.getByTestId('writing-word-count')).not.toHaveText('0')
  await capture(page, '15-writing-task-1')

  await page.getByTestId('writing-task-2').click()
  await page.getByTestId('load-demo-essay').click()
  await expect(page.getByTestId('writing-word-count')).not.toHaveText('0')
  await capture(page, '16-writing-task-2')

  await page.getByTestId('request-writing-assessment').click()
  await expect(page.getByTestId('writing-consent-dialog')).toBeVisible()
  await capture(page, '17-writing-send-consent')
  await page.getByTestId('confirm-writing-assessment').click()
  await expect(page).toHaveURL(/\/writing\/report\//, { timeout: 120_000 })
  await expect(page.locator('[data-testid="writing-criterion"]')).toHaveCount(4)
  await capture(page, '18-ai-writing-report')
  await page.getByRole('heading', { name: '可回溯证据与改写建议' }).scrollIntoViewIfNeeded()
  await capture(page, '19-ai-writing-evidence')
})
