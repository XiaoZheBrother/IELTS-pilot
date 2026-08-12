import type { WritingTask } from '../domain/writingAssessment'

const provenance: WritingTask['provenance'] = {
  kind: 'original',
  author: 'IELTS Pilot',
  license: 'CC-BY-4.0',
  note: 'Original practice prompt, dataset and demonstration response created for IELTS Pilot; not an official IELTS item.',
}

export const writingTasks: WritingTask[] = [
  {
    id: 'academic-task-1-library-visits',
    type: 'task-1',
    sequence: '01',
    eyebrow: 'Academic report',
    title: 'A library across three seasons',
    prompt: 'The chart shows the average weekly visits, in thousands, to three areas of the fictional North Quay Library in 2019, 2022 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    instructions: 'Write at least 150 words. Spend about 20 minutes on this task. Do not give personal opinions.',
    recommendedMinutes: 20,
    minimumWords: 150,
    focus: ['清晰概述', '关键比较', '数据准确性'],
    visualData: {
      title: 'Average weekly visits to North Quay Library',
      unit: 'thousand visits',
      categories: ['2019', '2022', '2025'],
      series: [
        { name: 'Quiet study', values: [18, 13, 21] },
        { name: 'Digital lab', values: [7, 16, 24] },
        { name: 'Community hall', values: [12, 9, 15] },
      ],
    },
    demoEssay: `The chart compares average weekly visits to three facilities at North Quay Library in 2019, 2022 and 2025, with figures given in thousands.

Overall, the digital lab experienced by far the strongest growth and became the most frequently used area by 2025. Quiet study remained important despite a temporary decline, while the community hall attracted the fewest or second fewest visitors throughout the period.

In 2019, quiet study was the leading facility, receiving 18 thousand visits per week. The community hall followed at 12 thousand, whereas only 7 thousand people used the digital lab. By 2022, this order had changed. Digital-lab visits more than doubled to 16 thousand, overtaking quiet study, which fell by five thousand to 13 thousand. Use of the community hall also decreased, from 12 to 9 thousand.

All three areas recorded higher attendance in 2025. The digital lab reached 24 thousand weekly visits, a total increase of 17 thousand from 2019. Quiet study recovered to 21 thousand, three thousand above its initial level. Community-hall attendance rose more modestly to 15 thousand, remaining nine thousand below the digital lab.`,
    provenance,
  },
  {
    id: 'academic-task-2-library-balance',
    type: 'task-2',
    sequence: '02',
    eyebrow: 'Academic argument',
    title: 'Digital access, physical focus',
    prompt: 'Some people believe public libraries should spend most of their budgets on digital services, while others think quiet physical study spaces remain their most important function. Discuss both views and give your own opinion.',
    instructions: 'Write at least 250 words. Spend about 40 minutes on this task. Give reasons and include relevant examples from your knowledge or experience.',
    recommendedMinutes: 40,
    minimumWords: 250,
    focus: ['回应双方观点', '明确立场', '论证展开'],
    demoEssay: `Public libraries face pressure to modernise, and it is understandable that many people want a larger share of their budgets devoted to digital services. However, others argue that a quiet place to read and study is still the institution's central purpose. In my view, libraries should expand digital access while protecting sufficient physical space, because the two functions serve different barriers to learning.

Supporters of digital investment point out that electronic collections can reach far more people than a single building. An online catalogue, remote database access and the loan of electronic books allow shift workers, people with disabilities and residents of distant neighbourhoods to use public resources at convenient times. Digital tools can also make a collection searchable and provide access to specialist material that a small branch could never store. When budgets are limited, these benefits make technology appear to be the most efficient priority.

Nevertheless, quiet study rooms provide something that a website cannot reproduce. Many students live in crowded homes or share equipment with family members, and commercial cafés may be noisy or expensive. A library desk, reliable electricity and a culture of concentration can therefore be a form of educational infrastructure. Physical branches also offer staff guidance and a safe public setting for people who lack confidence online. Removing these spaces in order to finance technology would deepen, rather than solve, some forms of inequality.

The best policy is consequently a balanced one. Libraries should fund digital collections and remote services, but evaluate them alongside occupancy, waiting lists and local study needs. Flexible rooms can host workshops at certain times and remain silent at others, while device-loan schemes can connect the physical and digital missions. This approach recognises that access is not merely the availability of information; it also requires time, equipment and an environment in which people can use that information effectively.

In conclusion, digital services greatly extend the reach of public libraries, but quiet study space remains indispensable. Funding decisions should preserve both, with the exact balance based on evidence from the community each library serves.`,
    provenance,
  },
]

export function getWritingTask(taskId: string): WritingTask | undefined {
  return writingTasks.find(({ id }) => id === taskId)
}
