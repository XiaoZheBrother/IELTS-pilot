import { mount } from '@vue/test-utils'
import DashboardView from '../../src/views/DashboardView.vue'

const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

describe('DashboardView', () => {
  beforeEach(() => localStorage.clear())

  it('leads with a complete mock and indexes five original practice sets', () => {
    const wrapper = mount(DashboardView, { global: { stubs: { RouterLink } } })
    expect(wrapper.text()).toContain('完整模考')
    expect(wrapper.text()).toContain('40 道题')
    expect(wrapper.get('a[href="/mock/reading-mock-01"]').text()).toContain('开始模考')
    expect(wrapper.findAll('[data-testid="practice-card"]')).toHaveLength(5)
    expect(wrapper.text()).toContain('题目均为项目原创')
  })

  it('favorites a set without leaving the dashboard', async () => {
    const wrapper = mount(DashboardView, { global: { stubs: { RouterLink } } })
    await wrapper.findAll('[data-testid="card-favorite"]')[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="card-favorite"]')[0]!.attributes('aria-pressed')).toBe('true')
  })
})

