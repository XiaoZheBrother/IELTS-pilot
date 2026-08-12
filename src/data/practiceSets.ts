import type { PracticeSet, ReadingQuestion, SourceReference } from '../domain/models'

type WithoutSource<T> = T extends { sourceRef: SourceReference } ? Omit<T, 'sourceRef'> : never
type RawReadingQuestion = WithoutSource<ReadingQuestion>
interface RawPracticeSet extends Omit<PracticeSet, 'questions'> { questions: RawReadingQuestion[] }

const rawPracticeSets: RawPracticeSet[] = [
  {
    id: 'shade-networks',
    sequence: '01',
    eyebrow: 'Urban Systems',
    title: 'The Shade Between Buildings',
    summary: '从城市热浪中的步行路线出发，练习识别论点、事实与未给信息。',
    level: 'B2–C1',
    durationMinutes: 25,
    topics: ['城市', '气候适应'],
    difficulty: 'medium',
    estimatedBand: 6.5,
    passage: {
      title: 'The Shade Between Buildings',
      deck: 'Why some planners are treating cool routes as public infrastructure rather than accidental shelter.',
      sections: [
        {
          heading: 'Measuring an invisible journey',
          paragraphs: [
            'On a conventional city map, the distance between a bus stop and a clinic is fixed. During a heatwave, however, the same journey can feel radically longer. A pavement beside a glass tower may reflect afternoon heat, while a parallel street with awnings and mature trees remains tolerable. For older residents, schoolchildren and people with certain health conditions, the difference is not merely pleasant or unpleasant: it can determine whether a journey is attempted at all.',
            'A planning team in the fictional city of Bellwether set out to record this difference. Volunteers carried thermal sensors along common walking routes in both the morning and afternoon. They also stopped every two minutes to note whether shade came from a tree, a building, a bus shelter or a temporary structure. The result was not a single heat map but a time-sensitive account of how protection moved as the sun crossed the sky.',
          ],
        },
        {
          heading: 'A network, not an object',
          paragraphs: [
            'The survey changed the planners’ question. Instead of asking where the city should build one impressive cooling pavilion, they asked how small patches of shade could form a continuous network. A tree outside a bakery became useful in combination with a fabric canopy at a crossing and a covered entrance beside a pharmacy. None of these fragments was remarkable alone. Together, they created a route on which a pedestrian was rarely exposed for more than ninety seconds.',
            'This network approach also challenged the assumption that the shortest route was always the best. Digital navigation systems generally optimise distance or travel time. Bellwether’s prototype added a “shade continuity” score. On mild days, it suggested the direct path. On very hot days, it might offer a route that was three minutes longer but substantially cooler. Early users said that the extra distance felt smaller because they did not have to pause in doorways to recover.',
          ],
        },
        {
          heading: 'Where models meet the street',
          paragraphs: [
            'Yet the model could not solve every practical problem. Trees grow slowly and their roots compete with underground pipes. Fabric canopies are quick to install, but they must withstand wind and leave space for delivery vehicles. Building shadows are free, though they shift by season and can disappear when a site is redeveloped. The pilot therefore avoided declaring one source of shade superior. It mixed permanent planting with movable structures and revised the route each season.',
            'Maintenance proved less glamorous than design but more important. A torn canopy could break the network at its busiest point. To prevent this, the transport department shared a simple reporting system with shopkeepers and bus drivers, people who already observed the street each day. Reports were checked against sensor readings rather than treated as a substitute for them.',
          ],
        },
        {
          heading: 'The politics of small decisions',
          paragraphs: [
            'The most difficult work concerned ownership. A useful route crossed land managed by transport, parks, schools, private landlords and a hospital. Each organisation controlled only a fragment, so no one had previously regarded the entire walk as its responsibility. The pilot created a monthly meeting at which these ordinary decisions—pruning dates, canopy repairs, construction permits—could be considered together.',
            'Bellwether’s experiment does not prove that every city needs the same materials or software. Its more transferable lesson is about coordination. Heat protection often already exists, scattered between buildings and budgets. Treating those pieces as a public network makes their gaps visible. It also turns an abstract promise of climate resilience into something a resident can feel on the walk to an appointment.',
          ],
        },
      ],
    },
    provenance: {
      kind: 'original',
      author: 'IELTS Pilot',
      note: 'Original practice passage and questions written for this project; not an official IELTS item.',
      license: 'CC-BY-4.0',
    },
    questions: [
      {
        id: 'shade_q1',
        type: 'multiple-choice',
        prompt: 'What is the main purpose of the passage?',
        options: [
          { key: 'A', label: 'To argue that digital maps should replace city planners' },
          { key: 'B', label: 'To explain how separate areas of shade can be coordinated as a route' },
          { key: 'C', label: 'To prove that fabric canopies are cheaper than planting trees' },
          { key: 'D', label: 'To compare public transport systems in several cities' },
        ],
        acceptedAnswers: ['B'],
        explanation: 'The passage follows Bellwether’s move from isolated shade objects to a coordinated public network.',
      },
      {
        id: 'shade_q2',
        type: 'true-false-not-given',
        prompt: 'The Bellwether volunteers collected temperature information only in the afternoon.',
        acceptedAnswers: ['false'],
        explanation: 'The first section says volunteers carried sensors in both the morning and afternoon.',
      },
      {
        id: 'shade_q3',
        type: 'true-false-not-given',
        prompt: 'A route that appears shortest on a map may feel harder during very hot weather.',
        acceptedAnswers: ['true'],
        explanation: 'The passage contrasts direct routes with slightly longer, cooler routes that users found easier.',
      },
      {
        id: 'shade_q4',
        type: 'true-false-not-given',
        prompt: 'Insurance companies refused to cover every fabric canopy used in the pilot.',
        acceptedAnswers: ['not given'],
        explanation: 'The passage discusses wind and delivery access, but it gives no information about insurance.',
      },
      {
        id: 'shade_q5',
        type: 'short-answer',
        prompt: 'What equipment did volunteers carry along the walking routes?',
        acceptedAnswers: ['thermal sensors'],
        wordLimit: 2,
        explanation: 'The passage states that volunteers carried “thermal sensors”.',
      },
      {
        id: 'shade_q6',
        type: 'short-answer',
        prompt: 'Name one group, besides older residents, for whom heat could affect whether a journey was attempted.',
        acceptedAnswers: ['schoolchildren', 'people with health conditions', 'people with certain health conditions'],
        wordLimit: 5,
        explanation: 'The opening paragraph names schoolchildren and people with certain health conditions.',
      },
      {
        id: 'shade_q7',
        type: 'multiple-choice',
        prompt: 'Why did the pilot use several different kinds of shade?',
        options: [
          { key: 'A', label: 'Residents requested a different material on every street' },
          { key: 'B', label: 'The city had already banned permanent structures' },
          { key: 'C', label: 'Each source of shade had different practical limitations' },
          { key: 'D', label: 'The navigation software could not recognise trees' },
        ],
        acceptedAnswers: ['C'],
        explanation: 'Trees, fabric and buildings each had limitations, so the pilot combined them rather than naming one winner.',
      },
      {
        id: 'shade_q8',
        type: 'multiple-choice',
        prompt: 'According to the author, what is the most transferable lesson from Bellwether?',
        options: [
          { key: 'A', label: 'Routine decisions must be coordinated across different owners' },
          { key: 'B', label: 'Every city should copy the same mapping software' },
          { key: 'C', label: 'Private landlords should control pedestrian routes' },
          { key: 'D', label: 'Climate projects work best without maintenance budgets' },
        ],
        acceptedAnswers: ['A'],
        explanation: 'The conclusion explicitly identifies coordination, rather than identical materials or software, as the transferable lesson.',
      },
      {
        id: 'shade_q9',
        type: 'matching-headings',
        prompt: 'Choose the best heading for the section “A network, not an object”.',
        options: [
          { key: 'i', label: 'The hidden cost of sensor equipment' },
          { key: 'ii', label: 'Small pieces that work as one route' },
          { key: 'iii', label: 'Why residents reject longer journeys' },
          { key: 'iv', label: 'A single landmark solution' },
        ],
        acceptedAnswers: ['ii'],
        explanation: 'The section explains how separate patches become useful when joined into a continuous route.',
      },
      {
        id: 'shade_q10',
        type: 'multiple-select',
        prompt: 'Which TWO sources of shade were recorded by volunteers?',
        options: [
          { key: 'A', label: 'Trees' },
          { key: 'B', label: 'Buildings' },
          { key: 'C', label: 'Underground pipes' },
          { key: 'D', label: 'Parking meters' },
        ],
        selectLimit: 2,
        acceptedAnswers: [['A', 'B']],
        explanation: 'The survey recorded shade from trees, buildings, bus shelters and temporary structures.',
      },
      {
        id: 'shade_q11',
        type: 'yes-no-not-given',
        prompt: 'The writer believes the pilot should identify one universally superior source of shade.',
        acceptedAnswers: ['no'],
        explanation: 'The passage says the pilot avoided declaring one source superior and instead mixed approaches.',
      },
      {
        id: 'shade_q12',
        type: 'sentence-completion',
        prompt: 'Complete the sentence using no more than four words.',
        beforeBlank: 'The reporting system was shared with',
        afterBlank: '.',
        wordLimit: 4,
        acceptedAnswers: ['shopkeepers and bus drivers'],
        explanation: 'Those street observers already watched conditions each day.',
      },
      {
        id: 'shade_q13',
        type: 'matching-information',
        prompt: 'Which section describes a problem caused by fragmented ownership?',
        options: [
          { key: 'A', label: 'Measuring an invisible journey' },
          { key: 'B', label: 'A network, not an object' },
          { key: 'C', label: 'Where models meet the street' },
          { key: 'D', label: 'The politics of small decisions' },
        ],
        acceptedAnswers: ['D'],
        explanation: 'The final section explains that different organisations controlled separate fragments of the route.',
      },
    ],
  },
  {
    id: 'repair-libraries',
    sequence: '02',
    eyebrow: 'Civic Experiments',
    title: 'When a Library Lends a Workbench',
    summary: '阅读社区修理图书馆的运作方式，训练细节定位与作者态度判断。',
    level: 'B2–C1',
    durationMinutes: 25,
    topics: ['社区', '公共知识'],
    difficulty: 'medium',
    estimatedBand: 6.5,
    passage: {
      title: 'When a Library Lends a Workbench',
      deck: 'A quiet experiment is expanding what it means for a public library to share knowledge.',
      sections: [
        {
          heading: 'Beyond borrowed objects',
          paragraphs: [
            'At the Westbridge public library, Saturday mornings now begin with an unusual queue. Some visitors carry books to return, but others arrive with lamps that no longer switch on, jackets with broken zips or radios that produce only static. They are waiting for the Repair Room, a weekly session where volunteers help people investigate why ordinary possessions have stopped working.',
            'The room is sometimes described as a tool-lending service, but that label misses its central rule: tools do not leave the building, and volunteers do not simply take an object away and return it fixed. Owner and volunteer work side by side. The library wants a repaired lamp, certainly, but it also wants its owner to understand the loose connection that caused the fault.',
          ],
        },
        {
          heading: 'A catalogue of uncertainty',
          paragraphs: [
            'Libraries are comfortable with catalogues, yet repair knowledge resists neat classification. Two kettles of the same model may fail for different reasons. A written manual can show where screws are hidden, but it cannot describe every sound made by a worn bearing. The volunteers therefore keep “repair notes”: short records of symptoms, tests, wrong guesses and eventual solutions. These notes are searchable, but they deliberately include uncertainty instead of presenting every repair as a smooth sequence of instructions.',
            'This practice has changed how the library measures success. At first, staff counted only objects restored to use. They soon noticed that a failed repair could still teach a valuable diagnostic method, reveal that a spare part was unsafe, or help an owner decide not to spend money on further work. The monthly report now distinguishes repaired objects from completed investigations.',
          ],
        },
        {
          heading: 'The value of a boundary',
          paragraphs: [
            'The Repair Room does not accept every object. Staff exclude microwave ovens and other equipment that can retain dangerous electrical charges. They also refuse repairs that would bypass a manufacturer’s safety system. These limits initially disappointed some visitors, but the coordinators argue that saying “we should not open this” is itself a form of practical knowledge.',
            'Another boundary concerns expertise. Volunteers wear name cards listing what they are comfortable examining, such as textiles, low-voltage electronics or wooden furniture. A confident bicycle mechanic may still decline a radio. This visible permission to stop has reduced the pressure to invent an answer and makes it easier to invite a second opinion.',
          ],
        },
        {
          heading: 'Knowledge that stays local',
          paragraphs: [
            'The project began with a small environmental grant, but its continuing costs are modest: replacement hand tools, safety testing and a part-time coordinator. The harder resource to maintain is the volunteer group. Rather than depend on one expert, Westbridge pairs newcomers with experienced repairers and rotates responsibility for the opening safety briefing.',
            'Supporters sometimes claim that repair rooms will transform consumer culture. Westbridge’s staff use more cautious language. A weekly session cannot change how every product is manufactured, and many objects remain uneconomic or unsafe to fix. What the room can do is make technical curiosity ordinary. In a building dedicated to shared knowledge, the workbench becomes another kind of reading table—one at which evidence is handled, assumptions are questioned and a useful answer may begin with uncertainty.',
          ],
        },
      ],
    },
    provenance: {
      kind: 'original',
      author: 'IELTS Pilot',
      note: 'Original practice passage and questions written for this project; not an official IELTS item.',
      license: 'CC-BY-4.0',
    },
    questions: [
      {
        id: 'repair_q1',
        type: 'multiple-choice',
        prompt: 'What distinguishes the Repair Room from a simple repair service?',
        options: [
          { key: 'A', label: 'Visitors must buy the tools they use' },
          { key: 'B', label: 'Owners take part in diagnosing their own objects' },
          { key: 'C', label: 'Only library employees may repair electrical items' },
          { key: 'D', label: 'Every object is returned on the same day' },
        ],
        acceptedAnswers: ['B'],
        explanation: 'Owners and volunteers work side by side so the owner understands the cause, not merely the outcome.',
      },
      {
        id: 'repair_q2',
        type: 'true-false-not-given',
        prompt: 'The repair notes include unsuccessful ideas as well as final solutions.',
        acceptedAnswers: ['true'],
        explanation: 'The notes record symptoms, tests, wrong guesses and eventual solutions.',
      },
      {
        id: 'repair_q3',
        type: 'true-false-not-given',
        prompt: 'Westbridge now counts every completed investigation as a repaired object.',
        acceptedAnswers: ['false'],
        explanation: 'The monthly report distinguishes repaired objects from completed investigations.',
      },
      {
        id: 'repair_q4',
        type: 'true-false-not-given',
        prompt: 'The environmental grant was renewed for a second year.',
        acceptedAnswers: ['not given'],
        explanation: 'The passage says the project began with a grant but does not state whether it was renewed.',
      },
      {
        id: 'repair_q5',
        type: 'short-answer',
        prompt: 'What documents record the symptoms and tests from previous repairs?',
        acceptedAnswers: ['repair notes'],
        wordLimit: 2,
        explanation: 'The second section calls these searchable records “repair notes”.',
      },
      {
        id: 'repair_q6',
        type: 'short-answer',
        prompt: 'Which dangerous household appliance is specifically excluded?',
        acceptedAnswers: ['microwave ovens', 'microwave oven', 'microwaves'],
        wordLimit: 2,
        explanation: 'Microwave ovens are excluded because they can retain dangerous electrical charges.',
      },
      {
        id: 'repair_q7',
        type: 'multiple-choice',
        prompt: 'Why do volunteers list their areas of comfort on name cards?',
        options: [
          { key: 'A', label: 'To decide who receives the largest payment' },
          { key: 'B', label: 'To advertise private repair businesses' },
          { key: 'C', label: 'To make the limits of their expertise visible' },
          { key: 'D', label: 'To prevent newcomers from joining the group' },
        ],
        acceptedAnswers: ['C'],
        explanation: 'The cards make it acceptable to decline unfamiliar work and seek another opinion.',
      },
      {
        id: 'repair_q8',
        type: 'multiple-choice',
        prompt: 'What is the author’s final view of the project?',
        options: [
          { key: 'A', label: 'It will force manufacturers to redesign every product' },
          { key: 'B', label: 'Its modest value lies in making evidence-based curiosity normal' },
          { key: 'C', label: 'It should replace the library’s traditional reading tables' },
          { key: 'D', label: 'Its environmental benefits cannot be measured in any way' },
        ],
        acceptedAnswers: ['B'],
        explanation: 'The conclusion avoids grand claims and values the room for making technical curiosity and careful uncertainty ordinary.',
      },
      {
        id: 'repair_q9',
        type: 'matching-headings',
        prompt: 'Choose the best heading for “The value of a boundary”.',
        options: [
          { key: 'i', label: 'Knowing when not to continue' },
          { key: 'ii', label: 'The fastest route to expert status' },
          { key: 'iii', label: 'Why every appliance can be repaired' },
          { key: 'iv', label: 'A catalogue without uncertainty' },
        ],
        acceptedAnswers: ['i'],
        explanation: 'The section treats safety limits and permission to stop as valuable knowledge.',
      },
      {
        id: 'repair_q10',
        type: 'matching-features',
        prompt: 'Who rotates responsibility for the opening safety briefing?',
        options: [
          { key: 'A', label: 'Library visitors' },
          { key: 'B', label: 'The volunteer group' },
          { key: 'C', label: 'Product manufacturers' },
        ],
        acceptedAnswers: ['B'],
        explanation: 'Westbridge pairs newcomers with experienced repairers and rotates the briefing responsibility.',
      },
      {
        id: 'repair_q11',
        type: 'yes-no-not-given',
        prompt: 'The staff consider some unsuccessful repairs to be educationally useful.',
        acceptedAnswers: ['yes'],
        explanation: 'A failed repair can still teach diagnosis, expose an unsafe part or inform a spending decision.',
      },
      {
        id: 'repair_q12',
        type: 'sentence-completion',
        prompt: 'Complete the sentence using no more than two words.',
        beforeBlank: 'The monthly report separates repaired objects from',
        afterBlank: '.',
        wordLimit: 2,
        acceptedAnswers: ['completed investigations'],
        explanation: 'The passage explicitly names these two reporting categories.',
      },
      {
        id: 'repair_q13',
        type: 'multiple-select',
        prompt: 'Which TWO continuing costs are listed besides the part-time coordinator?',
        options: [
          { key: 'A', label: 'Replacement hand tools' },
          { key: 'B', label: 'Safety testing' },
          { key: 'C', label: 'Advertising campaigns' },
          { key: 'D', label: 'New library buildings' },
        ],
        selectLimit: 2,
        acceptedAnswers: [['A', 'B']],
        explanation: 'Replacement tools and safety testing are the other continuing costs named.',
      },
    ],
  },
  {
    id: 'rainwater-ledgers',
    sequence: '03',
    eyebrow: 'Resource Design',
    title: 'The Ledger Beneath the Roof',
    summary: '从公共建筑雨水回收系统出发，练习配对、摘要填空与流程信息定位。',
    level: 'C1',
    durationMinutes: 28,
    topics: ['水资源', '建筑系统'],
    difficulty: 'advanced',
    estimatedBand: 7,
    passage: {
      title: 'The Ledger Beneath the Roof',
      deck: 'Why successful rainwater systems begin with a record of demand rather than the size of a tank.',
      sections: [
        {
          heading: 'Count before capture',
          paragraphs: [
            'When the North Quay education district decided to collect rainwater from six public buildings, its first purchase was not a tank. Engineers installed temporary sub-meters on toilets, garden taps and cleaning stations. For twelve weeks, the team recorded when non-drinking water was used, then compared that demand with roof area and historical rainfall. The exercise revealed that two buildings with similar roofs had very different daily patterns because one hosted evening classes while the other closed at four o’clock.',
            'This demand ledger prevented an attractive but expensive mistake. A tank sized only from annual rainfall totals might appear generous, yet remain empty during a long dry period or stay full when a building had little use for the water. The designers instead tested several storage sizes against week-by-week supply and demand. Their aim was not to capture every drop, but to select a tank that would be used regularly enough to justify its cost and embodied materials.',
          ],
        },
        {
          heading: 'Keeping streams apart',
          paragraphs: [
            'Water from a roof is not automatically ready for use. Dust, leaves and bird droppings collect between storms, so North Quay fitted each system with a first-flush diverter. This device sends the earliest runoff away from the storage tank. Later water passes through a coarse screen and a finer filter before entering storage. Neither step makes the water drinkable; the district uses it only for toilet flushing, irrigation and selected cleaning tasks.',
            'Separate, clearly marked pipework carries the reclaimed water. Physical separation is more reliable than a sign alone because it prevents an accidental connection to the drinking-water supply. At outlets accessible to staff, simple labels still explain the restriction. The combination of engineered separation and visible information allows maintenance workers to understand both the rule and the reason behind it.',
          ],
        },
        {
          heading: 'Maintenance as evidence',
          paragraphs: [
            'During the first winter, one building reported surprisingly low savings. The tank was filling, but a valve had been left in a position that allowed mains water to supply the toilets even when rainwater was available. A visible gauge showed the tank level, while the maintenance log showed when the valve had last been inspected. Together, these ordinary records helped staff find the fault without replacing working equipment.',
            'The incident changed the project’s management. Facilities teams added monthly checks for filters, valves and tank levels, and the water utility included these records in its quarterly review. Budget responsibility was also clarified: the district paid for major components, while each building covered routine inspection. Without this agreement, small tasks could easily fall between organisations even though the technology itself was sound.',
          ],
        },
        {
          heading: 'Useful, not independent',
          paragraphs: [
            'After two years, the six systems supplied just over half of the water used for the selected non-drinking purposes. Performance varied with rainfall patterns, roof size, building schedules and the length of dry spells. The result was substantial, but it did not make the district independent of the mains network. Designers had always retained a protected backup connection for periods when stored water ran out.',
            'North Quay publishes monthly figures for collection, use, overflow and mains backup. These figures allow other institutions to test assumptions against a working system rather than copy a tank size blindly. The broader lesson is that rainwater equipment is only one part of a service. Measurement, safe separation, maintenance and clear ownership turn a container beneath a roof into dependable infrastructure.',
          ],
        },
      ],
    },
    provenance: {
      kind: 'original',
      author: 'IELTS Pilot',
      note: 'Original practice passage and questions written for this project; not an official IELTS item.',
      license: 'CC-BY-4.0',
    },
    questions: [
      {
        id: 'rain_q1', type: 'matching-headings', prompt: 'Choose the best heading for Section A.',
        options: [{ key: 'i', label: 'A fault hidden in the controls' }, { key: 'ii', label: 'Measuring need before choosing equipment' }, { key: 'iii', label: 'Publishing results for other organisations' }, { key: 'iv', label: 'Protecting the drinking supply' }],
        acceptedAnswers: ['ii'], explanation: 'Section A starts with demand measurement and uses it to choose storage.',
      },
      {
        id: 'rain_q2', type: 'matching-headings', prompt: 'Choose the best heading for Section B.',
        options: [{ key: 'i', label: 'A fault hidden in the controls' }, { key: 'ii', label: 'Measuring need before choosing equipment' }, { key: 'iii', label: 'Publishing results for other organisations' }, { key: 'iv', label: 'Protecting the drinking supply' }],
        acceptedAnswers: ['iv'], explanation: 'Section B explains filtration, separate pipes and protection of potable water.',
      },
      {
        id: 'rain_q3', type: 'matching-headings', prompt: 'Choose the best heading for Section C.',
        options: [{ key: 'i', label: 'A fault hidden in the controls' }, { key: 'ii', label: 'Measuring need before choosing equipment' }, { key: 'iii', label: 'Publishing results for other organisations' }, { key: 'iv', label: 'Protecting the drinking supply' }],
        acceptedAnswers: ['i'], explanation: 'A valve position caused low savings even though the tank was filling.',
      },
      {
        id: 'rain_q4', type: 'matching-information', prompt: 'Which section explains why other institutions can learn from monthly operating figures?',
        options: [{ key: 'A', label: 'Count before capture' }, { key: 'B', label: 'Keeping streams apart' }, { key: 'C', label: 'Maintenance as evidence' }, { key: 'D', label: 'Useful, not independent' }],
        acceptedAnswers: ['D'], explanation: 'The final section says published figures let others test assumptions.',
      },
      {
        id: 'rain_q5', type: 'true-false-not-given', prompt: 'The largest possible tank was considered the best option for every building.',
        acceptedAnswers: ['false'], explanation: 'Designers chose tanks through week-by-week use rather than maximising capacity.',
      },
      {
        id: 'rain_q6', type: 'true-false-not-given', prompt: 'North Quay uses collected rainwater as drinking water.',
        acceptedAnswers: ['false'], explanation: 'The collected water is limited to non-drinking uses.',
      },
      {
        id: 'rain_q7', type: 'true-false-not-given', prompt: 'Most of the project’s water savings occurred during summer.',
        acceptedAnswers: ['not given'], explanation: 'The passage does not compare seasonal saving totals.',
      },
      {
        id: 'rain_q8', type: 'yes-no-not-given', prompt: 'The writer suggests that records and maintenance are essential parts of the system.',
        acceptedAnswers: ['yes'], explanation: 'The conclusion names measurement and maintenance as parts of dependable infrastructure.',
      },
      {
        id: 'rain_q9', type: 'summary-word-bank', prompt: 'Before selecting storage, the team created a detailed record of each building’s _____.',
        options: [{ key: 'A', label: 'demand' }, { key: 'B', label: 'ownership' }, { key: 'C', label: 'colour' }, { key: 'D', label: 'insurance' }],
        acceptedAnswers: ['A'], explanation: 'Temporary sub-meters produced a demand ledger before tank selection.',
      },
      {
        id: 'rain_q10', type: 'sentence-completion', prompt: 'Complete the sentence using no more than two words.',
        beforeBlank: 'The first-flush diverter keeps the earliest runoff out of the', afterBlank: '.', wordLimit: 2,
        acceptedAnswers: ['storage tank', 'tank'], explanation: 'The earliest, dirtiest runoff is diverted away from storage.',
      },
      {
        id: 'rain_q11', type: 'diagram-label', prompt: 'Complete the label for the item observed by the visible gauge.',
        diagramDescription: 'ROOF → DIVERTER → FILTER → TANK → GAUGE: ______', wordLimit: 2,
        acceptedAnswers: ['tank level', 'tank levels'], explanation: 'The visible gauge showed the tank level.',
      },
      {
        id: 'rain_q12', type: 'matching-sentence-endings', prompt: 'Separate pipework is used in order to…',
        options: [{ key: 'A', label: 'prevent reclaimed water entering the drinking supply.' }, { key: 'B', label: 'make all outlet labels unnecessary.' }, { key: 'C', label: 'collect every drop from the roof.' }, { key: 'D', label: 'remove the need for filters.' }],
        acceptedAnswers: ['A'], explanation: 'Physical separation prevents accidental cross-connection.',
      },
      {
        id: 'rain_q13', type: 'multiple-choice', prompt: 'What is the writer’s main conclusion?',
        options: [{ key: 'A', label: 'Rainwater tanks should replace all mains connections.' }, { key: 'B', label: 'Equipment becomes dependable when paired with measurement, maintenance and ownership.' }, { key: 'C', label: 'Only buildings with evening classes benefit from rainwater.' }, { key: 'D', label: 'Public reporting makes safety separation unnecessary.' }],
        acceptedAnswers: ['B'], explanation: 'The conclusion frames the tank as one component in a managed service.',
      },
      {
        id: 'rain_q14', type: 'multiple-select', prompt: 'Which TWO factors affected performance across the six buildings?',
        options: [{ key: 'A', label: 'Rainfall patterns' }, { key: 'B', label: 'Building schedules' }, { key: 'C', label: 'Wall colour' }, { key: 'D', label: 'Library membership' }],
        selectLimit: 2, acceptedAnswers: [['A', 'B']], explanation: 'Performance varied with rainfall, roof size, schedules and dry-spell length.',
      },
    ],
  },
]

const sourceRefs: SourceReference[][] = [
  [
    { sectionIndex: 3, paragraphIndex: 1 }, { sectionIndex: 0, paragraphIndex: 1 },
    { sectionIndex: 1, paragraphIndex: 1 }, { sectionIndex: 2, paragraphIndex: 0 },
    { sectionIndex: 0, paragraphIndex: 1 }, { sectionIndex: 0, paragraphIndex: 0 },
    { sectionIndex: 2, paragraphIndex: 0 }, { sectionIndex: 3, paragraphIndex: 1 },
    { sectionIndex: 1, paragraphIndex: 0 }, { sectionIndex: 0, paragraphIndex: 1 },
    { sectionIndex: 2, paragraphIndex: 0 }, { sectionIndex: 2, paragraphIndex: 1 },
    { sectionIndex: 3, paragraphIndex: 0 },
  ],
  [
    { sectionIndex: 0, paragraphIndex: 1 }, { sectionIndex: 1, paragraphIndex: 0 },
    { sectionIndex: 1, paragraphIndex: 1 }, { sectionIndex: 3, paragraphIndex: 0 },
    { sectionIndex: 1, paragraphIndex: 0 }, { sectionIndex: 2, paragraphIndex: 0 },
    { sectionIndex: 2, paragraphIndex: 1 }, { sectionIndex: 3, paragraphIndex: 1 },
    { sectionIndex: 2, paragraphIndex: 0 }, { sectionIndex: 3, paragraphIndex: 0 },
    { sectionIndex: 1, paragraphIndex: 1 }, { sectionIndex: 1, paragraphIndex: 1 },
    { sectionIndex: 3, paragraphIndex: 0 },
  ],
  [
    { sectionIndex: 0, paragraphIndex: 0 }, { sectionIndex: 1, paragraphIndex: 0 },
    { sectionIndex: 2, paragraphIndex: 0 }, { sectionIndex: 3, paragraphIndex: 1 },
    { sectionIndex: 0, paragraphIndex: 1 }, { sectionIndex: 1, paragraphIndex: 0 },
    { sectionIndex: 3, paragraphIndex: 0 }, { sectionIndex: 3, paragraphIndex: 1 },
    { sectionIndex: 0, paragraphIndex: 0 }, { sectionIndex: 1, paragraphIndex: 0 },
    { sectionIndex: 2, paragraphIndex: 0 }, { sectionIndex: 1, paragraphIndex: 1 },
    { sectionIndex: 3, paragraphIndex: 1 }, { sectionIndex: 3, paragraphIndex: 0 },
  ],
]

export const practiceSets: PracticeSet[] = rawPracticeSets.map((set, setIndex) => ({
  ...set,
  questions: set.questions.map((question, questionIndex) => ({
    ...question,
    sourceRef: sourceRefs[setIndex]?.[questionIndex] ?? { sectionIndex: 0, paragraphIndex: 0 },
  })) as ReadingQuestion[],
}))

export function getPracticeSet(testId: string): PracticeSet | undefined {
  return practiceSets.find(({ id }) => id === testId)
}
