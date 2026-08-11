import { mount } from '@vue/test-utils'
import ScoreSummary from '../../src/components/ScoreSummary.vue'

describe('ScoreSummary', () => {
  it('labels the band as an estimate and presents the raw result', () => {
    const wrapper = mount(ScoreSummary, {
      props: {
        score: {
          correct: 6,
          total: 8,
          percentage: 75,
          normalizedRaw40: 30,
          approximateBand: 7,
          scoringVersion: 'reading-v1',
          items: [],
        },
      },
    })

    expect(wrapper.text()).toContain('6 / 8')
    expect(wrapper.text()).toContain('Band 7.0')
    expect(wrapper.text()).toContain('练习估算')
  })
})
