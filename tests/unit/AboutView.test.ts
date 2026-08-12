import { mount } from '@vue/test-utils'
import AboutView from '../../src/views/AboutView.vue'

describe('AboutView', () => {
  it('shows version, runtime and reference attribution', () => {
    const wrapper = mount(AboutView)
    expect(wrapper.text()).toContain('0.7.0')
    expect(wrapper.text()).toContain('浏览器')
    expect(wrapper.text()).toContain('IELTS-practice')
    expect(wrapper.get('a[href="https://github.com/sallowayma-git/IELTS-practice"]')).toBeTruthy()
    expect(wrapper.text()).toContain('未复制其题目内容')
  })
})
