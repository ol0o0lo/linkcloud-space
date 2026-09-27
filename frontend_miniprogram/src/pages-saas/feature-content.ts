export const featureKeys = ['inventory', 'clients', 'contracts', 'insights'] as const

export type FeatureKey = typeof featureKeys[number]

export interface FeatureContent {
  key: FeatureKey
  number: string
  name: string
  overline: string
  title: string
  accent: string
  summary: string
  highlights: string[]
  previewTitle: string
  sectionTitle: string
  sectionDescription: string
  scenario: string
  capabilities: { icon: string, title: string, description: string }[]
  steps: { title: string, description: string }[]
  outcome: string
}

export const featureContent: Record<FeatureKey, FeatureContent> = {
  inventory: {
    key: 'inventory',
    number: '01',
    name: '房源盘面',
    overline: 'ONE CLEAR INVENTORY',
    title: '每套房源，',
    accent: '都在掌控之中。',
    summary: '从小区、楼栋到具体房间，把分散的房源资料整理成清晰盘面。门店成员查看同一份信息，安排带看时心里有数。',
    highlights: ['小区楼栋层级', '房态快速筛选', '房源资料集中'],
    previewTitle: '房源状态总览',
    sectionTitle: '打开盘面，就知道接下来该做什么。',
    sectionDescription: '房源信息有位置、状态有变化、资料有归属。日常找房、补资料和安排带看，都能从同一处开始。',
    scenario: '客户想看城西某小区的空置房源？先按小区和房态缩小范围，再打开房源资料确认房号、租金和招租信息，减少来回核对。',
    capabilities: [
      { icon: 'i-carbon-building', title: '按小区、楼栋组织房源', description: '先建立小区与楼栋，再维护具体房源。层级关系清楚，房源多了也方便查找。' },
      { icon: 'i-carbon-filter', title: '房态一眼可见', description: '按空置、招租中、已出租等状态筛选，快速识别当前可以推进的房源。' },
      { icon: 'i-carbon-document', title: '资料跟着房源走', description: '把租金、图片、业主与房间信息集中维护，团队减少重复询问和版本不一致。' },
    ],
    steps: [
      { title: '建立盘面', description: '录入小区和楼栋，给房源一个清晰的位置。' },
      { title: '补全资料', description: '添加房间、租金、图片与相关联系人。' },
      { title: '跟进房态', description: '根据招租和成交进展更新状态，方便下一次协作。' },
    ],
    outcome: '房源越多，越需要一张大家都看得懂的盘面。',
  },
  clients: {
    key: 'clients',
    number: '02',
    name: '客户与带看',
    overline: 'EVERY FOLLOW-UP COUNTS',
    title: '客户跟进，',
    accent: '不再断在交接处。',
    summary: '客户资料、带看安排和跟进过程连在一起。下一次联系客户，团队知道需求是什么、看过哪些房、接下来该推进哪一步。',
    highlights: ['联系人统一维护', '带看安排清晰', '跟进过程留痕'],
    previewTitle: '客户带看进度',
    sectionTitle: '把每一次沟通，接到下一次行动上。',
    sectionDescription: '客户需求不只是一条备注。联系人、带看时间、房源与跟进状态共同组成可继续推进的业务线索。',
    scenario: '客户看完房源后需要再比较一套？把带看结果和下一步安排留在记录里，换一位同事继续跟进，也能了解前面的沟通。',
    capabilities: [
      { icon: 'i-carbon-user-multiple', title: '联系人统一管理', description: '集中维护房东与租客联系人，按角色查找，减少资料散落在个人手机里。' },
      { icon: 'i-carbon-calendar', title: '带看排期可追踪', description: '把客户、房源和带看时间关联起来，待看、已看等进度更加清楚。' },
      { icon: 'i-carbon-collaborate', title: '交接有上下文', description: '带看与跟进记录沿业务过程留存，接手的同事不用从零追问。' },
    ],
    steps: [
      { title: '记录需求', description: '维护客户基本信息和想看的房源方向。' },
      { title: '安排带看', description: '关联房源与时间，让排期和负责人清晰可见。' },
      { title: '更新结果', description: '记录看房进展，为下一次联系和成交铺路。' },
    ],
    outcome: '一次带看结束，下一次沟通就有了更好的起点。',
  },
  contracts: {
    key: 'contracts',
    number: '03',
    name: '签约与租约',
    overline: 'FROM DEAL TO LEASE',
    title: '从成交登记，',
    accent: '到租约履行。',
    summary: '把成交房源、租客、租期与租金信息整理在同一条业务线上。签约之后，租约状态和后续任务仍然清楚可查。',
    highlights: ['成交信息归档', '租约状态可查', '关键节点清晰'],
    previewTitle: '签约履行进度',
    sectionTitle: '成交不是终点，后面的节点也要接住。',
    sectionDescription: '从带看转成交，再到租约生效和履行，关键资料与进度持续留在工作台，方便团队协作与查询。',
    scenario: '带看成交后，登记对应房源、租客、租期和月租金。后续查看租约时，可按待生效、履约中或已到期状态继续处理。',
    capabilities: [
      { icon: 'i-carbon-document-signed', title: '成交信息有依据', description: '登记签约房源、租客、租期和租金，让业务结果与前面的带看过程衔接。' },
      { icon: 'i-carbon-time', title: '租约状态可追踪', description: '区分待生效、履约中和已到期租约，及时知道当前处在哪个阶段。' },
      { icon: 'i-carbon-task', title: '后续任务接得上', description: '租约与团队任务同在工作台，关键事项更容易找到处理入口。' },
    ],
    steps: [
      { title: '确认成交', description: '从房源或已成交带看进入签约登记。' },
      { title: '登记租约', description: '补齐租客、租期、租金等履行所需信息。' },
      { title: '持续跟进', description: '按租约状态查看记录，处理后续事项。' },
    ],
    outcome: '让成交结果留下来，也让履约过程跟得上。',
  },
  insights: {
    key: 'insights',
    number: '04',
    name: '经营分析',
    overline: 'TURN ACTIVITY INTO INSIGHT',
    title: '每天的动作，',
    accent: '最终形成答案。',
    summary: '业务事件随着日常工作逐步沉淀。选择时间范围，查看指标概览与近期趋势，让门店复盘有清晰依据。',
    highlights: ['经营事件汇总', '时间范围筛选', '近期趋势查看'],
    previewTitle: '经营趋势概览',
    sectionTitle: '从业务发生，到经营看见。',
    sectionDescription: '经营分析基于工作台里产生的业务事件，帮助团队了解一段时间内的活动数量、指标分布与变化趋势。',
    scenario: '想知道最近一段时间业务动作有没有变化？选择日期范围，先看指标概览，再沿时间趋势寻找值得进一步了解的波动。',
    capabilities: [
      { icon: 'i-carbon-chart-bar', title: '指标概览更直接', description: '汇总所选日期内的经营事件，快速浏览各项指标数量。' },
      { icon: 'i-carbon-calendar', title: '按时间范围查看', description: '自己选择开始和结束日期，把注意力放在需要复盘的阶段。' },
      { icon: 'i-carbon-chart-line', title: '沿趋势继续追问', description: '查看近期事件趋势，结合具体业务过程理解变化从哪里来。' },
    ],
    steps: [
      { title: '选定周期', description: '设置需要复盘的开始和结束日期。' },
      { title: '查看概览', description: '了解经营事件总量与各项指标分布。' },
      { title: '观察趋势', description: '结合时间变化，找到值得继续追踪的业务信号。' },
    ],
    outcome: '让经营判断多一份真实过程的支撑。',
  },
}

export function resolveFeatureKey(value: unknown): FeatureKey {
  return featureKeys.find(key => key === value) || 'inventory'
}
