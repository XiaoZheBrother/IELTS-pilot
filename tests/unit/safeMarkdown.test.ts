import { mount } from '@vue/test-utils'
import SafeMarkdown from '../../src/components/SafeMarkdown.vue'
import { parseSafeMarkdown } from '../../src/domain/safeMarkdown'

describe('safe Markdown', () => {
  it('parses headings, lists, emphasis, code and safe links into typed blocks', () => {
    const blocks = parseSafeMarkdown('# 学习建议\n\n- 先做 **标题配对**\n- 查看 [报告](/writing/report/1) 和 `证据`')
    expect(blocks.map(({ type }) => type)).toEqual(['heading', 'list'])
    expect(JSON.stringify(blocks)).toContain('strong')
    expect(JSON.stringify(blocks)).toContain('/writing/report/1')
    expect(JSON.stringify(blocks)).toContain('code')
  })

  it('renders HTML and unsafe links as inert text without v-html', () => {
    const wrapper = mount(SafeMarkdown, { props: { content: '<img src=x onerror=alert(1)> [危险](javascript:alert(1))' } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.text()).toContain('危险')
  })
})
