import type { PracticeSet } from '../domain/models'

export const supplementalPracticeSets: PracticeSet[] = [
  {
    id: 'quiet-hour-labs',
    sequence: '04',
    eyebrow: 'Learning Science',
    title: 'The Quiet Hour Experiment',
    summary: '通过一项图书馆安静时段试验，练习区分研究结果、参与者观点与限制条件。',
    level: 'B2',
    durationMinutes: 18,
    topics: ['学习空间', '行为研究'],
    difficulty: 'foundation',
    estimatedBand: 5.5,
    passage: {
      title: 'The Quiet Hour Experiment',
      deck: 'What happened when a university library changed one hour of the day instead of rebuilding the whole floor.',
      sections: [
        {
          heading: 'A small change',
          paragraphs: [
            'Northbridge University Library had received the same complaint for three years: students wanted quiet study space, but group projects filled every floor with conversation. A major renovation was unaffordable, so the library tested a smaller intervention. From nine to ten each morning, one open floor became a quiet hour zone. Signs explained the rule, and staff offered nearby rooms to groups that needed to talk.',
            'The trial lasted six weeks. Door counters measured visits, while short voluntary surveys asked students why they had chosen the floor. Researchers also recorded how often staff had to remind visitors about the rule. They did not collect names or course information, because the aim was to observe use of the space rather than compare academic departments.',
          ],
        },
        {
          heading: 'What the numbers missed',
          paragraphs: [
            'Visits during the quiet hour rose by 18 percent, and reminders became less frequent after the second week. At first, managers considered the trial an uncomplicated success. Interviews added a more complex picture. Commuter students valued the predictable hour because it fitted the gap after their first bus arrived. Some laboratory students, however, said that nine o’clock was too early to help them.',
            'The surveys also revealed that quiet did not mean silence to everyone. Most respondents accepted the sound of keyboards and turning pages. A smaller group expected even whispered questions to stop. Rather than write a longer list of prohibited noises, staff described the zone as a place for independent work and asked visitors to take conversations elsewhere.',
          ],
        },
        {
          heading: 'A schedule, not a verdict',
          paragraphs: [
            'The library extended the programme but did not declare one timetable permanent. During examination month, the quiet period runs for three hours. At the start of term, when group assignments are common, it returns to one hour. A display at the entrance shows the current schedule so that students can plan rather than discover the rule after sitting down.',
            'The experiment offered no proof that quiet study improves grades. It did show that a limited and clearly announced rule could change how a shared floor was used. For the library, the most useful outcome was not a universal definition of silence but a method for adjusting space without waiting for a costly building project.',
          ],
        },
      ],
    },
    provenance: { kind: 'original', author: 'IELTS Pilot', note: 'Original practice passage and questions written for this project; not an official IELTS item.', license: 'CC-BY-4.0' },
    questions: [
      { id: 'quiet_q1', type: 'multiple-choice', prompt: 'Why did the library begin with a quiet hour trial?', options: [{ key: 'A', label: 'It could not afford a major renovation' }, { key: 'B', label: 'Students refused to book group rooms' }, { key: 'C', label: 'Staff wanted to compare departments' }, { key: 'D', label: 'The building closed after ten o’clock' }], acceptedAnswers: ['A'], explanation: 'The opening section says a major renovation was unaffordable, so a smaller intervention was tested.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } },
      { id: 'quiet_q2', type: 'true-false-not-given', prompt: 'Researchers recorded the courses studied by survey participants.', acceptedAnswers: ['false'], explanation: 'They deliberately did not collect course information.', sourceRef: { sectionIndex: 0, paragraphIndex: 1 } },
      { id: 'quiet_q3', type: 'true-false-not-given', prompt: 'Staff reminders were needed less often after the first two weeks.', acceptedAnswers: ['true'], explanation: 'The passage reports that reminders became less frequent after the second week.', sourceRef: { sectionIndex: 1, paragraphIndex: 0 } },
      { id: 'quiet_q4', type: 'short-answer', prompt: 'Which students particularly valued the predictable hour?', acceptedAnswers: ['commuter students'], wordLimit: 2, explanation: 'Commuter students valued the hour because it matched their travel schedule.', sourceRef: { sectionIndex: 1, paragraphIndex: 0 } },
      { id: 'quiet_q5', type: 'multiple-select', prompt: 'Which TWO sounds did most survey respondents accept?', options: [{ key: 'A', label: 'Keyboards' }, { key: 'B', label: 'Turning pages' }, { key: 'C', label: 'Phone calls' }, { key: 'D', label: 'Group presentations' }], selectLimit: 2, acceptedAnswers: [['A', 'B']], explanation: 'Most respondents accepted keyboards and pages.', sourceRef: { sectionIndex: 1, paragraphIndex: 1 } },
      { id: 'quiet_q6', type: 'sentence-completion', prompt: 'Complete the sentence using no more than three words.', beforeBlank: 'During examination month, the quiet period lasts for', afterBlank: '.', wordLimit: 3, acceptedAnswers: ['three hours', '3 hours'], explanation: 'The schedule expands to three hours during examination month.', sourceRef: { sectionIndex: 2, paragraphIndex: 0 } },
      { id: 'quiet_q7', type: 'yes-no-not-given', prompt: 'The writer claims that the experiment proved quiet study raises grades.', acceptedAnswers: ['no'], explanation: 'The conclusion explicitly says the experiment offered no such proof.', sourceRef: { sectionIndex: 2, paragraphIndex: 1 } },
    ],
  },
  {
    id: 'seed-catalogues',
    sequence: '05',
    eyebrow: 'Living Archives',
    title: 'Seeds with a Memory',
    summary: '围绕社区种子目录的保存方式，练习匹配标题、信息定位与多项选择。',
    level: 'B2-C1',
    durationMinutes: 20,
    topics: ['农业', '数字档案'],
    difficulty: 'medium',
    estimatedBand: 6.5,
    passage: {
      title: 'Seeds with a Memory',
      deck: 'Community seed banks are discovering that the story attached to a seed can be as useful as its label.',
      sections: [
        {
          heading: 'More than a packet',
          paragraphs: [
            'A seed bank can describe a bean by colour, weight and date of collection. Those facts are necessary, but growers often ask different questions. Does the plant survive a wet spring? Can its pods be dried in a small kitchen? Which family recipe was it selected for? At the fictional Fenmarsh Seed Exchange, answers once depended on the memory of a few long-serving volunteers.',
            'When two of those volunteers retired, the exchange began recording short seed histories. Contributors completed a paper card with the basic facts and could add an audio account in their own words. The aim was not to replace scientific measurements. It was to preserve practical observations that rarely fit inside a conventional catalogue field.',
          ],
        },
        {
          heading: 'Useful disagreement',
          paragraphs: [
            'The new records did not always agree. One gardener described a tomato as early, while another called it slow. Instead of choosing one account, the exchange kept both and added the locations in which the plants had grown. The first garden was on a sunny wall; the second lay in a cool valley. What looked like an error became evidence about the conditions the variety preferred.',
            'This approach required careful language. Volunteers were trained to label personal experience as observation, not universal fact. Claims about disease resistance were kept separate from laboratory results. The catalogue therefore became richer without pretending that every memory had been tested under controlled conditions.',
          ],
        },
        {
          heading: 'Designing for return',
          paragraphs: [
            'A digital catalogue made the histories searchable, but the exchange kept the paper cards. Several older contributors preferred writing, and internet access in surrounding villages was uneven. Each paper card received the same identifier as its digital record, allowing future volunteers to compare the two. Audio files were also transcribed so that a broken recording would not erase the information.',
            'Most importantly, the archive was designed to receive updates. When members borrowed seed, the packet included a small return slip for harvest dates, weather and results. A catalogue entry could therefore change as a variety moved through new gardens. The seed bank came to see the archive not as a finished monument but as a continuing conversation between growers.',
          ],
        },
      ],
    },
    provenance: { kind: 'original', author: 'IELTS Pilot', note: 'Original practice passage and questions written for this project; not an official IELTS item.', license: 'CC-BY-4.0' },
    questions: [
      { id: 'seed_q1', type: 'matching-headings', prompt: 'Choose the best heading for the section “More than a packet”.', options: [{ key: 'i', label: 'Practical knowledge beyond basic measurements' }, { key: 'ii', label: 'A failed scientific experiment' }, { key: 'iii', label: 'The cost of storing vegetables' }, { key: 'iv', label: 'Rules for commercial farmers' }], acceptedAnswers: ['i'], explanation: 'The section contrasts catalogue facts with practical growing and cooking knowledge.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } },
      { id: 'seed_q2', type: 'short-answer', prompt: 'What optional format let contributors tell a seed history in their own words?', acceptedAnswers: ['audio account', 'an audio account'], wordLimit: 3, explanation: 'Contributors could add an audio account.', sourceRef: { sectionIndex: 0, paragraphIndex: 1 } },
      { id: 'seed_q3', type: 'true-false-not-given', prompt: 'The exchange deleted descriptions that contradicted each other.', acceptedAnswers: ['false'], explanation: 'It kept both accounts and added the growing locations.', sourceRef: { sectionIndex: 1, paragraphIndex: 0 } },
      { id: 'seed_q4', type: 'multiple-choice', prompt: 'What explained the different reports about the tomato?', options: [{ key: 'A', label: 'The seeds came from different companies' }, { key: 'B', label: 'The plants grew in different conditions' }, { key: 'C', label: 'One gardener had lost the harvest date' }, { key: 'D', label: 'The catalogue used the wrong identifier' }], acceptedAnswers: ['B'], explanation: 'One plant grew by a sunny wall and the other in a cool valley.', sourceRef: { sectionIndex: 1, paragraphIndex: 0 } },
      { id: 'seed_q5', type: 'yes-no-not-given', prompt: 'The writer approves of presenting every personal memory as a proven fact.', acceptedAnswers: ['no'], explanation: 'The passage stresses that observation and tested fact were labelled separately.', sourceRef: { sectionIndex: 1, paragraphIndex: 1 } },
      { id: 'seed_q6', type: 'multiple-select', prompt: 'Why were paper cards kept? Choose TWO answers.', options: [{ key: 'A', label: 'Some contributors preferred writing' }, { key: 'B', label: 'Village internet access was uneven' }, { key: 'C', label: 'Audio was prohibited by law' }, { key: 'D', label: 'Digital identifiers were too expensive' }], selectLimit: 2, acceptedAnswers: [['A', 'B']], explanation: 'Writing preferences and uneven internet access both justified retaining paper.', sourceRef: { sectionIndex: 2, paragraphIndex: 0 } },
      { id: 'seed_q7', type: 'sentence-completion', prompt: 'Complete the sentence using no more than two words.', beforeBlank: 'Members used a return slip to report harvest dates, weather and', afterBlank: '.', wordLimit: 2, acceptedAnswers: ['results'], explanation: 'The return slip collected harvest dates, weather and results.', sourceRef: { sectionIndex: 2, paragraphIndex: 1 } },
    ],
  },
]
