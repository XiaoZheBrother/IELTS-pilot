import { mount } from '@vue/test-utils'
import App from '../../src/App.vue'

describe('App shell', () => {
  it('shows the product identity and renders the active route', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RouterView: { template: '<main data-testid="route-view">当前页面</main>' },
        },
      },
    })

    expect(wrapper.get('[data-testid="brand"]').text()).toContain('IELTS Pilot')
    expect(wrapper.get('[data-testid="route-view"]').text()).toBe('当前页面')
  })
})
