import { mount } from '@vue/test-utils'
import LibraryView from '../../src/views/LibraryView.vue'

describe('LibraryView', () => {
  beforeEach(() => localStorage.clear())

  it('filters the passage index by search text and difficulty', async () => {
    const wrapper = mount(LibraryView, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    expect(wrapper.findAll('[data-testid="library-row"]')).toHaveLength(3)
    await wrapper.get('input[type="search"]').setValue('rainwater')
    expect(wrapper.findAll('[data-testid="library-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('The Ledger Beneath the Roof')
    await wrapper.get('input[type="search"]').setValue('')
    await wrapper.get('select[name="difficulty"]').setValue('advanced')
    expect(wrapper.findAll('[data-testid="library-row"]')).toHaveLength(1)
  })

  it('explains that imports require rights metadata', () => {
    const wrapper = mount(LibraryView, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('授权')
    expect(wrapper.get('input[type="file"]').attributes('accept')).toBe('application/json,.json')
  })

  it('favorites a practice set from the index', async () => {
    const wrapper = mount(LibraryView, { global: { stubs: { RouterLink: true } } })
    await wrapper.findAll('[data-testid="favorite-set"]')[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="favorite-set"]')[0]!.attributes('aria-pressed')).toBe('true')
  })
})

