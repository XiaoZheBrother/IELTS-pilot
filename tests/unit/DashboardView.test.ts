import { mount } from '@vue/test-utils'
import DashboardView from '../../src/views/DashboardView.vue'

describe('DashboardView', () => {
  beforeEach(() => localStorage.clear())

  it('shows the two original practice sets and an honest product promise', () => {
    const wrapper = mount(DashboardView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })

    expect(wrapper.get('h1').text()).toContain('读懂每一个失分点')
    expect(wrapper.findAll('[data-testid="practice-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('The Shade Between Buildings')
    expect(wrapper.text()).toContain('When a Library Lends a Workbench')
    expect(wrapper.text()).toContain('题目均为项目原创')
  })
})
