import { mount } from '@vue/test-utils'
import FavoritesView from '../../src/views/FavoritesView.vue'
import { practiceSets } from '../../src/data/practiceSets'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'

describe('FavoritesView', () => {
  beforeEach(() => localStorage.clear())

  it('shows favorite sets and source-linked favorite questions', () => {
    const repository = createBrowserPracticeRepository()
    repository.toggleFavoriteSet(practiceSets[0]!.id)
    repository.toggleFavoriteQuestion(practiceSets[0]!.questions[0]!.id)
    const wrapper = mount(FavoritesView, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    expect(wrapper.text()).toContain(practiceSets[0]!.title)
    expect(wrapper.text()).toContain(practiceSets[0]!.questions[0]!.prompt)
  })
})
