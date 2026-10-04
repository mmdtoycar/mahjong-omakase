export type WindName = '东' | '南' | '西' | '北'

export interface WhatIfScenario {
  drawTile: string // Tile string, e.g. "3m"
  label: string // Short button label, e.g. "摸入 3m (中张成搭)"
  tag: 'optimal' | 'good' | 'trap' | 'neutral'
  outcome: string // Detailed takeaway
}

export interface PracticeQuestion {
  id: string
  chapterId: number
  chapterTitle: string
  title: string
  subtitle: string
  conceptTags: string[]
  hand: string // Space-separated tile string, e.g. "1m 2m 3m 4p 5p..."
  roundWind: '东' | '南' // 场风 (Round wind)
  seatWind: WindName // 自风 / 门风 (Seat wind)
  turnNumber: number // 巡目 (Turn number)
  doraIndicator?: string // 宝牌指示牌 (Dora indicator)
  optimalDiscards: string[] // Tile strings like "1z"
  viableDiscards?: string[]
  coachTakeaway: string // Concise theoretical rule
  coachExplanation: string // Detailed breakdown
  mistakeExplanations?: Record<string, string> // Custom feedback for specific wrong choices
  whatIfScenarios?: WhatIfScenario[]
}

export interface ChapterInfo {
  id: number
  title: string
  shortTitle: string
  description: string
  icon: string
}

export const CHAPTERS: ChapterInfo[] = [
  {
    id: 1,
    title: '第一章：孤张与字牌处理',
    shortTitle: '孤张与字牌',
    description: '掌握字牌顺位、19端牌与中张靠张价值，告别无目的乱出牌。',
    icon: '🀅',
  },
  {
    id: 2,
    title: '第二章：五块理论与拆搭抉择',
    shortTitle: '五块理论拆搭',
    description: '理解4面子1雀头模型，识别五块已齐与六块超额，学会搭子优劣比拼。',
    icon: '🧱',
  },
  {
    id: 3,
    title: '第三章：复合搭子与改良技巧',
    shortTitle: '复合搭子进阶',
    description: '解密两坎、中膨、亚两面与四连形，挖掘被忽视的高效进张。',
    icon: '✨',
  },
  {
    id: 4,
    title: '第四章：一向听黄金法则与好形率',
    shortTitle: '一向听与好形率',
    description: '学习完全一向听、避开无雀头地狱陷阱，理解枚数与好形率的深度平衡。',
    icon: '🎯',
  },
  {
    id: 5,
    title: '第五章：役种倾向与实战打点',
    shortTitle: '役种与打点',
    description: '平和、断幺九与宝牌权衡，从纯牌效迈向实战高手。',
    icon: '👑',
  },
]

export const PRACTICE_QUESTIONS: PracticeQuestion[] = [
  // ==========================================
  // CHAPTER 1: 孤张与字牌处理
  // ==========================================
  {
    id: 'ch1-1',
    chapterId: 1,
    chapterTitle: '第一章：孤张与字牌处理',
    title: '客风孤张 vs 中张孤张',
    subtitle: '手牌起手阶段，如何辨别最有潜力的单张？',
    conceptTags: ['字牌优劣', '中张靠张', '基础牌效'],
    hand: '1m 2m 3m 4p 5p 7s 8s 2s 2s 4m 3z 1z 9p 5s',
    roundWind: '南',
    seatWind: '北',
    turnNumber: 3,
    doraIndicator: '9s',
    optimalDiscards: ['1z', '3z'],
    viableDiscards: ['9p'],
    coachTakeaway: '不足五块时，先出客风牌，留中张靠搭！',
    coachExplanation:
      '【局况解析】：当前为【南场·北家】（场风为南，自风为北），因此手牌中的东风（1z）与西风（3z）均为【无役客风牌】（既非场风亦非自风，即使摸成对子也无法获得番数）。' +
      '手牌中 123m 为顺子，45p 和 78s 均为两面搭子，22s 为雀头。手牌目前只有 4 块，必须靠手中的孤张靠出第 5 块！' +
      '中张 4m、5s 摸到邻近数牌（2~8）均能形成新的搭子或面子，靠张面极宽；而客风字牌（东/西风）完全无法顺子靠张，只能等抓对子（仅剩3张）。因此应毫不犹豫切除客风牌 1z 或 3z。',
    mistakeExplanations: {
      '4m': '切除 4m 是极大失误！4m 能够靠 2,3,4,5,6m 成搭，是形成第5块的最强中张种子，切掉它会严重阻碍做牌速度。',
      '5s': '5s 连接着 78s 并且是中张，能极大增强索子部分的变化能力，切除属于严重减损手牌改良潜力。',
      '9p': '9p 虽然也是孤张，但属于数牌，摸 7p/8p 尚能成坎/边搭，虽然也是劣牌，但仍优于完全无法靠搭的客风牌。',
    },
    whatIfScenarios: [
      {
        drawTile: '3m',
        label: '摸入 3m (中张成搭)',
        tag: 'optimal',
        outcome:
          '摸入 3m 与 4m 形成优质两面搭子 [34m]！手牌凑齐 123m(面) + 34m(搭) + 45p(搭) + 78s(搭) + 22s(雀头) 共 5 块！向听数直接前进至一向听！这就是保留中张的巨大威力！',
      },
      {
        drawTile: '6s',
        label: '摸入 6s (三连形升级)',
        tag: 'good',
        outcome:
          '摸入 6s 使得 5s 与 78s 形成 5678s 四连形！此时摸 4s/6s/7s/9s 均成面子，有效受入扩充至 14 张，大大提升进张广度！',
      },
      {
        drawTile: '1z',
        label: '若留字牌摸 1z (客风对子)',
        tag: 'trap',
        outcome:
          '新手常以为“看，留字牌摸到对子了多好”！但注意：南场北家下东风为【无役客风】，即便碰出也没有役无法胡牌，反而占用了搭子位置拖累做牌速度！',
      },
    ],
  },
  {
    id: 'ch1-2',
    chapterId: 1,
    chapterTitle: '第一章：孤张与字牌处理',
    title: '役牌孤张 vs 客风孤张',
    subtitle: '都是字牌，红中和南风到底先切哪一张？',
    conceptTags: ['役牌价值', '客风牌', '字牌顺位'],
    hand: '2m 3m 4m 6p 7p 1s 2s 3s 7s 8s 9s 2z 5z 4s',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 4,
    doraIndicator: '3p',
    optimalDiscards: ['2z'],
    viableDiscards: ['4s'],
    coachTakeaway: '役牌（三元牌/自风/场风）具有1番价值，优先保留役牌，先出客风！',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。南风（2z）既非场风亦非自风，是纯粹的客风牌；而红中（5z）是三元牌，属于所有玩家通用的役牌。' +
      '红中只要后续摸成对子碰出，即可确立 1 番并随时鸣牌加速；而客风南风成刻子也没有任何役。因此字牌取舍永远遵循：【客风牌 < 自风/场风 < 三元牌】。先切客风 2z！',
    mistakeExplanations: {
      '5z': '切红中浪费了重要的役牌价值！三元牌一旦摸成对子既可鸣牌加速又可作为确定雀头，应保留红中而切客风 2z。',
    },
    whatIfScenarios: [
      {
        drawTile: '5z',
        label: '摸入 5z (役牌成对)',
        tag: 'optimal',
        outcome:
          '红中成对！此时既可作为确定雀头立直，也能随时碰出确定 1 番起胡，整手牌瞬间提速！这就是役牌相比客风的绝大优势。',
      },
      {
        drawTile: '5p',
        label: '摸入 5p (两面成顺)',
        tag: 'good',
        outcome: '摸入 5p 形成 567p 顺子！手牌面子直接成型，向听前进至听牌！',
      },
      {
        drawTile: '2z',
        label: '若留客风摸 2z (无役卡手)',
        tag: 'trap',
        outcome: '摸成南风对子毫无役牌番数，不可鸣牌加速，留在手中后期还可能成为放铳危险牌，价值极低。',
      },
    ],
  },
  {
    id: 'ch1-3',
    chapterId: 1,
    chapterTitle: '第一章：孤张与字牌处理',
    title: '19 端张孤张 vs 客风字牌',
    subtitle: '幺九数牌到底比客风牌强多少？',
    conceptTags: ['端牌价值', '字牌效率', '靠张枚数'],
    hand: '3m 4m 5m 6p 7p 8p 2s 3s 4s 7s 7s 1m 4z 9s',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 4,
    doraIndicator: '6p',
    optimalDiscards: ['4z'],
    viableDiscards: ['1m', '9s'],
    coachTakeaway: '手牌已有确定雀头（77s）时，客风字牌对向听推进几乎毫无帮助，应先于 19 舍弃。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】，北风（4z）为客风牌。' +
      '手牌已经有雀头 77s。1m 虽是端牌，但若摸到 2m 可成 12m 边搭，摸到 3m 可成 13m 坎搭，仍有 8 张靠张空间；而客风北风 4z 只能摸一张成对子（3张），且此时手牌不需要多余对子。因此切 4z 效率最高。',
    mistakeExplanations: {
      '1m': '先切 1m 虽无大碍，但 1m 仍有摸 2m, 3m 的数牌靠搭可能，保留 1m 舍弃纯字牌 4z 进张面更广。',
      '9s': '9s 摸 7s, 8s 均能与现有索子形成配合，保留数牌先出客风字牌是标准牌效。',
    },
  },
  {
    id: 'ch1-4',
    chapterId: 1,
    chapterTitle: '第一章：孤张与字牌处理',
    title: '28 近端张 vs 456 中张孤张',
    subtitle: '数牌孤张的价值阶梯比较',
    conceptTags: ['数牌价值链', '28 vs 456', '好形靠张率'],
    hand: '2m 3m 4m 5p 6p 7p 1s 2s 3s 8s 8s 2p 5s 8m',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 5,
    doraIndicator: '1m',
    optimalDiscards: ['8m'],
    viableDiscards: ['2p'],
    coachTakeaway: '数牌价值法则：4/5/6 中张 > 3/7 尖张 > 2/8 近端张 > 1/9 端张。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '手牌已有 3 个完成面子（234m、567p、123s）和雀头 88s，第 5 块需要在 2p、5s、8m 之间依靠张形成搭子。' +
      '5s 作为中张，摸 3,4,5,6,7 均成搭，且摸 4,6 可成高质量两面搭；2p 摸 1,2,3,4 成搭（两面率仅 3p 一种）；8m 摸 6,7,8,9 成搭。对比 2p 与 8m，切 8m 或 2p 均可，但 5s 绝对不可切！由于 8m 偏边，切 8m 进张效率最佳。',
    mistakeExplanations: {
      '5s': '大忌！5s 是中张，能靠出 35, 45, 55, 56, 57 五种搭子（其中 45, 56 为进张8张的高质量两面）。切 5s 会大幅降低好形率！',
    },
  },
  {
    id: 'ch1-5',
    chapterId: 1,
    chapterTitle: '第一章：孤张与字牌处理',
    title: '早期清理顺序综合实战',
    subtitle: '多张单牌同时存在时的标准取舍',
    conceptTags: ['综合牌效', '清理顺序', '向听推进'],
    hand: '2m 3m 7p 8p 4s 5s 6s 8s 8s 1z 9m 1p 6z 4m',
    roundWind: '南',
    seatWind: '西',
    turnNumber: 2,
    doraIndicator: '5m',
    optimalDiscards: ['1z'],
    viableDiscards: ['6z'],
    coachTakeaway: '标准孤张切除顺序：客风字牌 ➔ 无役字牌 ➔ 1/9端张 ➔ 2/8 ➔ 3/7 ➔ 4/5/6。',
    coachExplanation:
      '【局况解析】：当前为【南场·西家】。东风（1z）为客风，白板（6z）为三元役牌。' +
      '手牌拥有 1z、6z、9m、1p 等多个孤张。客风 1z 完全无役且不可靠搭，排在最优先切除位；白板 6z 是役牌可保留待碰；1p 和 9m 可随后依次处理。第一手果断切 1z！',
    mistakeExplanations: {
      '6z': '白板是三元役牌，摸成对子就能确定 1 番起胡，价值远高于客风 1z，切莫先切役牌。',
      '9m': '9m 虽是端张，但尚有摸 7m, 8m 成搭的微弱可能，客风 1z 连这种可能性都没有。',
    },
  },

  // ==========================================
  // CHAPTER 2: 五块理论与拆搭抉择
  // ==========================================
  {
    id: 'ch2-1',
    chapterId: 2,
    chapterTitle: '第二章：五块理论与拆搭抉择',
    title: '五块已齐，多余孤张已无意义',
    subtitle: '5个搭子结构完全固定时的决断',
    conceptTags: ['五块理论', '五块已齐', '切除浮牌'],
    hand: '2m 3m 5m 6m 2p 3p 7s 8s 4s 4s 6p 7m 8m 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 6,
    doraIndicator: '8p',
    optimalDiscards: ['1z'],
    viableDiscards: ['6p'],
    coachTakeaway: '手牌 5 块已齐时，手牌轮廓已经定型，多余孤张的靠张意义归零，果断切除！',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】，1z 为客风牌。' +
      '我们来数手牌的“块”：' +
      '① 23m（两面）② 56m（两面）③ 23p（两面）④ 78s（两面）⑤ 44s（雀头）！加上已成顺子的 78m（或者与56m复合）。' +
      '手牌已经完整具备了 5 个极高质量的两面/面子搭子，不再需要任何孤张去靠搭！此时留在手里的字牌 1z 和孤张 6p 毫无价值，直接切除 1z 安全推进。',
    mistakeExplanations: {
      '4s': '切 4s 破坏了手牌唯一的确定雀头，会导致进入“无雀头一向听地狱”，严重降效！',
      '2m': '23m 是宝贵的两面搭子，五块已齐时绝不需要拆解优质两面。',
    },
    whatIfScenarios: [
      {
        drawTile: '1m',
        label: '摸入 1m (两面成顺)',
        tag: 'optimal',
        outcome: '摸入 1m 形成 123m 顺子！手牌直接进入【完全一向听】，双面搭子全部就位，好形率达到 100%！',
      },
      {
        drawTile: '4p',
        label: '摸入 4p (两面进张)',
        tag: 'good',
        outcome: '摸入 4p 形成 234p 顺子，手牌向听数前进，五块结构高效运转！',
      },
      {
        drawTile: '7p',
        label: '若留 6p 摸 7p (产生第6块冗余)',
        tag: 'trap',
        outcome:
          '若留着 6p 摸到 7p，看似成了 67p 两面搭，但在五块已齐的前提下，这个搭子成了第 6 块冗余，反而面临拆哪一个的纠结，完全没有加快听牌速度！',
      },
    ],
  },
  {
    id: 'ch2-2',
    chapterId: 2,
    chapterTitle: '第二章：五块理论与拆搭抉择',
    title: '六块超额：果断拆除死边张',
    subtitle: '当搭子数量达到6块时，该拆哪一个？',
    conceptTags: ['五块理论', '六块超额', '边张拆除'],
    hand: '3m 4m 6m 7m 2p 3p 7p 8p 8s 9s 5s 5s 1z 1z',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 5,
    doraIndicator: '1m',
    optimalDiscards: ['8s', '9s'],
    viableDiscards: [],
    coachTakeaway: '搭子优劣阶梯：两面 (8张) 远优于 边张 (仅4张且不可改良)！六块必拆弱搭。',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '手牌搭子盘点：' +
      '① 34m (两面8张) ② 67m (两面8张) ③ 23p (两面8张) ④ 78p (两面8张) ⑤ 89s (边张4张) ⑥ 55s/11z (对子)。' +
      '手牌共有 6 块，明显“六块超额”！在 4 个两面与 1 个边张之间比拼，边张 89s 只能进 7s（4张）且无法改良为两面，是手牌绝对的累赘。果断拆除 8s 或 9s！',
    mistakeExplanations: {
      '3m': '拆 34m 两面是严重失误！两面进张高达 8 张，而 89s 仅 4 张进张，切勿弃优留劣。',
      '1z': '切 1z 虽然也是打法，但留着死边张 89s 会让手牌听牌时大概率变成愚形边张 7s，拆 89s 能保证 100% 好形听牌！',
    },
    whatIfScenarios: [
      {
        drawTile: '5m',
        label: '摸入 5m (两面进张)',
        tag: 'optimal',
        outcome: '摸入 5m 形成 345m 顺子！拆掉边张 89s 后，剩下 4 个搭子全都是 8 张两面，手牌听牌 100% 为两面好形！',
      },
      {
        drawTile: '1p',
        label: '摸入 1p (两面进张)',
        tag: 'good',
        outcome: '摸入 1p 形成 123p 顺子，向听前进！高效率两面搭子带来超强听牌稳定性。',
      },
      {
        drawTile: '7s',
        label: '若留 89s 摸 7s (愚形受制)',
        tag: 'trap',
        outcome: '即便撞大运摸到了仅有的 7s 成了 789s，但为了留它而拆掉两面，整体进张概率大跌一半，长期打法必然亏损！',
      },
    ],
  },
  {
    id: 'ch2-3',
    chapterId: 2,
    chapterTitle: '第二章：五块理论与拆搭抉择',
    title: '坎张 vs 边张：谁更值得保留？',
    subtitle: '同样是4张进张，为什么坎张价值远高于边张？',
    conceptTags: ['坎张 vs 边张', '改良空间', '搭子质量'],
    hand: '2m 4m 8s 9s 3p 4p 6p 7p 5s 6s 1m 1m 2z 2z',
    roundWind: '南',
    seatWind: '西',
    turnNumber: 6,
    doraIndicator: '4m',
    optimalDiscards: ['8s', '9s'],
    viableDiscards: ['2m', '4m'],
    coachTakeaway: '坎张（24m）摸 5m 可改良为 45m 两面；而边张（89s）永远无法改良！',
    coachExplanation:
      '【局况解析】：当前为【南场·西家】。' +
      '六块超额状态下，面临坎张 24m 与边张 89s 的抉择。' +
      '表面看 24m 进 3m（4张），89s 进 7s（4张），进张数一样。但是！24m 摸到 5m 时，手牌立即转化为 45m 的优质两面搭子；而 89s 摸 6s、7s 都无法让其变成两面。' +
      '因此【坎张具有改良属性，边张是死搭】。优先拆除边张 8s/9s！',
    mistakeExplanations: {
      '2m': '切 2m 拆了坎张而保留边张，放弃了潜在的两面改良机会，属于牌理上的次级选择。',
    },
  },
  {
    id: 'ch2-4',
    chapterId: 2,
    chapterTitle: '第二章：五块理论与拆搭抉择',
    title: '二度进张避坑指南',
    subtitle: '看起来很美的搭子，进张居然严重重叠？',
    conceptTags: ['二度进张', '搭子重叠', '进张损耗'],
    hand: '3m 4m 5m 6m 7m 2p 3p 7p 8p 4s 6s 9s 9s 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 7,
    doraIndicator: '9p',
    optimalDiscards: ['1z'],
    viableDiscards: ['4s', '6s'],
    coachTakeaway: '警惕二度进张！如果两个搭子进同一张牌，进张枚数会减半。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '注意万子部分：34567m 包含 34m（进 25m）和 67m（进 58m）。这里的 5m 是重叠的（手牌已有1张，外部仅剩3张），这就是典型的“二度进张”。' +
      '不过本题中手牌已有 34567m (多面复合)、23p、78p、46s (坎张)、99s (雀头)，外加孤张 1z。第一手仍应先切除毫无瓜葛的孤张 1z，随后在索子与万子之间做平滑过渡。',
    mistakeExplanations: {
      '9s': '切 9s 破坏了手牌唯一的雀头对子，属于新手常见误区。',
    },
  },
  {
    id: 'ch2-5',
    chapterId: 2,
    chapterTitle: '第二章：五块理论与拆搭抉择',
    title: '三对子手牌的雀头取舍',
    subtitle: '手里有3个对子，是留着碰牌还是拆掉一个？',
    conceptTags: ['三对子处理', '定雀头', '对子拆解'],
    hand: '2m 2m 5m 6m 4p 4p 7p 8p 8s 8s 2s 3s 4s 1m',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 5,
    doraIndicator: '3s',
    optimalDiscards: ['1m'],
    viableDiscards: ['2m', '4p', '8s'],
    coachTakeaway: '手牌搭子充足时，先清理单张孤张 1m；如果四对子或六块超额，再拆弱对子。',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '手牌拥有 22m、44p、88s 三个对子，同时有 56m、78p 两面，以及 234s 完成顺子。' +
      '此时手中还有一张孤张 1m。手牌结构已经非常充盈，1m 既不是搭子也不是对子，果断切除 1m 即可让手牌进入极佳的一向听！',
    mistakeExplanations: {
      '2m': '在还有废牌 1m 的情况下直接拆 22m 对子是舍近求远，浪费了摸 2m 成暗刻的机会。',
    },
  },

  // ==========================================
  // CHAPTER 3: 复合搭子与改良技巧
  // ==========================================
  {
    id: 'ch3-1',
    chapterId: 3,
    chapterTitle: '第三章：复合搭子与改良技巧',
    title: '隐藏的8张进张：两坎结构',
    subtitle: '千万不要把 246 误当成两张分散的散牌！',
    conceptTags: ['两坎结构', '复合搭子', '受入倍增'],
    hand: '2m 4m 6m 2p 3p 7p 8p 3s 4s 7s 7s 9p 1z 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 6,
    doraIndicator: '5s',
    optimalDiscards: ['9p'],
    viableDiscards: ['6m', '2m'],
    coachTakeaway: '两坎（246 或 357）进中间两张牌（3,5）均成顺子，受入高达 8 张，媲美两面！',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '手牌万子 246m 是经典的【两坎结构（Ryankan）】。摸 3m 形成 234m 顺子留下 6m 孤张；摸 5m 形成 456m 顺子留下 2m 孤张。总进张是 3m（4张）+ 5m（4张）= 8张！' +
      '很多新手看到 246m 觉得很别扭，随手把 6m 切了，瞬间让进张折损一半。手牌已有 5 块，孤张 9p 毫无价值，果断切 9p 锁定两坎！',
    mistakeExplanations: {
      '6m': '新手致命失误！切 6m 会将强大的两坎结构（8张进张）降级为脆弱的单坎张 24m（仅4张进张），进张损失高达 50%！',
      '2m': '同理，切 2m 拆毁两坎，严重降效。',
    },
  },
  {
    id: 'ch3-2',
    chapterId: 3,
    chapterTitle: '第三章：复合搭子与改良技巧',
    title: '摸哪都开花：中膨形（Nakabukure）',
    subtitle: '4556 中间成对，蕴含着惊人的威力',
    conceptTags: ['中膨形', '好形改良', '雀头来源'],
    hand: '4m 5m 5m 6m 2p 3p 6p 7p 7s 8s 2s 2s 1z 9p',
    roundWind: '南',
    seatWind: '西',
    turnNumber: 5,
    doraIndicator: '2m',
    optimalDiscards: ['1z'],
    viableDiscards: ['9p'],
    coachTakeaway: '中膨形（如 4556 或 3445）两翼可成顺、中间可成雀头，是极高阶的好形源泉！',
    coachExplanation:
      '【局况解析】：当前为【南场·西家】。' +
      '手牌中 4556m 是著名的【中膨形】。摸 3m 或 6m，可形成 345m 顺子并保留 56m 两面；摸 4m 或 5m，直接把对子升华为暗刻！' +
      '新手常误以为 4556m 是“多了一张废牌 5m”想随手打掉，殊不知它是整手牌最灵活的变幻枢纽。先切除无用的客风 1z 或边端 9p。',
    mistakeExplanations: {
      '5m': '绝对不要拆中膨形！切 5m 会把如此灵活的复合型缩减为普通的 456m 单一顺子，失去极其关键的雀头与改良可能。',
    },
  },
  {
    id: 'ch3-3',
    chapterId: 3,
    chapterTitle: '第三章：复合搭子与改良技巧',
    title: '雀头与两面兼备：亚两面',
    subtitle: '223 或 788 的双重身份',
    conceptTags: ['亚两面', '双碰两面', '搭子复用'],
    hand: '2m 2m 3m 4p 5p 6p 7s 8s 1s 2s 3s 8p 8p 9m',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 6,
    doraIndicator: '7p',
    optimalDiscards: ['9m'],
    viableDiscards: [],
    coachTakeaway: '亚两面（223m）既能进 1,4m 成顺子，又能摸 2m 成刻子，一牌两用。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '223m 称为【亚两面】。若手牌缺少雀头，摸 1m 或 4m 时，2m 自行退居为雀头；若摸到 2m，则形成 222m 暗刻加上 3m 浮牌。' +
      '本牌已有 88p 和 22m 两个对子，配合 456p、123s、78s，结构极为完整。单张 9m 是纯废牌，果断切 9m 维持充沛受入！',
    mistakeExplanations: {
      '2m': '切 2m 会把亚两面变成普通两面 23m，同时丢失了 22m 的雀头备选，完全没必要。',
    },
  },
  {
    id: 'ch3-4',
    chapterId: 3,
    chapterTitle: '第三章：复合搭子与改良技巧',
    title: '四连形（延伸两面）的延展性',
    subtitle: '2345 不仅仅是一副顺子加单张',
    conceptTags: ['四连形', '延伸两面', '双头单骑'],
    hand: '2m 3m 4m 5m 6p 7p 2s 3s 6s 7s 9s 9s 1z 1z',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 5,
    doraIndicator: '4p',
    optimalDiscards: ['1z'],
    viableDiscards: ['2m', '5m'],
    coachTakeaway: '四连形（2345）进 1, 4, 2, 5 均产生强力演化，听牌时更是优质的延展双头待牌！',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '2345m 拥有 4 个进张点：摸 1m 变为 123m + 45m（两面）；摸 4m 变为 234m + 45m；摸 6m 变为 234m + 56m。' +
      '切莫因为 2345m 看着像 4 张牌就急于修剪成 3 张。当前手牌 6 块稍多，先切无用字牌 1z 对子中的一张，保留四连形的变化。',
    mistakeExplanations: {
      '5m': '切 5m 把四连形退回普通顺子 234m，丧失了摸 1m, 4m, 6m 的连环好形扩展机会。',
    },
  },
  {
    id: 'ch3-5',
    chapterId: 3,
    chapterTitle: '第三章：复合搭子与改良技巧',
    title: '拆单坎张还是拆两坎？',
    subtitle: '当搭子过剩时，复合形的优先级比拼',
    conceptTags: ['拆搭优劣', '两坎 vs 单坎', '受入保护'],
    hand: '2m 4m 6m 7p 9p 3s 4s 6s 7s 8s 8s 1z 1z 4p',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 7,
    doraIndicator: '8m',
    optimalDiscards: ['4p'],
    viableDiscards: ['7p', '9p'],
    coachTakeaway: '单坎张（79p）进张仅 4 张；而两坎（246m）进张有 8 张。绝不可误拆两坎！',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '手牌中万子是 246m（两坎 8 张受入），饼子是 79p（单坎 4 张受入）附带一张单张 4p。' +
      '此时手牌搭子充沛，孤张 4p 毫无价值应优先切出。即使要在搭子中做减法，也一定是先拆单坎张 79p，而绝不能动 246m！',
    mistakeExplanations: {
      '6m': '切 6m 是大恶手！把 8 张进张的两坎自断一臂，留着仅 4 张进张的 79p 单坎，属于本末倒置。',
    },
  },

  // ==========================================
  // CHAPTER 4: 一向听黄金法则与好形率
  // ==========================================
  {
    id: 'ch4-1',
    chapterId: 4,
    chapterTitle: '第四章：一向听黄金法则与好形率',
    title: '牌效天花板：完全一向听',
    subtitle: '日麻最高效率形态的标准构建',
    conceptTags: ['完全一向听', '受入最大', '进张率'],
    hand: '2m 3m 4p 5p 5p 7s 8s 2s 3s 4s 8m 8m 8m 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 6,
    doraIndicator: '2p',
    optimalDiscards: ['1z'],
    viableDiscards: [],
    coachTakeaway: '完全一向听：2两面 + 1雀头 + 1复合搭（如对子/亚两面），进张面高达 20~28 张！',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '手牌拥有：23m（两面8张）、455p（亚两面两用）、78s（两面8张）、234s（顺子）、888m（暗刻兼雀头候补）。' +
      '摸 14m、36p、69s 均能听牌，且听牌 100% 为两面好形！这就是日麻理论推崇备至的【完全一向听】。单张 1z 属于纯杂质，果断切 1z！',
    mistakeExplanations: {
      '5p': '切 5p 会把 455p 破坏为普通两面 45p，损失了摸 5p 成雀头以及双碰进张的可能，直接瓦解了完全一向听架构！',
    },
  },
  {
    id: 'ch4-2',
    chapterId: 4,
    chapterTitle: '第四章：一向听黄金法则与好形率',
    title: '雀头固定 vs 搭子固定',
    subtitle: '小心掉入“无雀头一向听”的深渊陷阱！',
    conceptTags: ['雀头固定', '无头地狱', '一向听法则'],
    hand: '2m 3m 6m 7m 3p 4p 7p 8p 2s 2s 5s 5s 1m 9s',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 7,
    doraIndicator: '8m',
    optimalDiscards: ['1m', '9s'],
    viableDiscards: ['2s', '5s'],
    coachTakeaway: '宁可保留两个对子（雀头候选），也绝不提早把对子全拆光导致“无雀头一向听”！',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '手牌有 23m、67m、34p、78p 共 4 个极为优秀的两面搭子，以及 22s、55s 两个对子。' +
      '此时手中还有废牌 1m 和 9s。切莫手欠去拆 22s 或 55s！先切 1m/9s，保留两个对子争夺雀头与刻子（双碰进张）。一旦提早拆对子，后续若连续摸到顺子就会陷入无头单骑的尴尬地步。',
    mistakeExplanations: {
      '2s': '过早拆 2s 会让手牌只剩 55s 一个对子，丧失了双碰进张 2s 的 2 张受入，先打 1m/9s 才是正手。',
    },
  },
  {
    id: 'ch4-3',
    chapterId: 4,
    chapterTitle: '第四章：一向听黄金法则与好形率',
    title: '枚数 vs 好形率：少2张但听两面！',
    subtitle: '不要只迷信冷冰冰的数字，好形听牌才是实战王道',
    conceptTags: ['好形听牌率', '枚数抉择', '实战和率'],
    hand: '3m 4m 5m 6m 7m 2p 4p 6s 7s 2s 2s 4s 4s 8p',
    roundWind: '南',
    seatWind: '西',
    turnNumber: 8,
    doraIndicator: '1s',
    optimalDiscards: ['8p'],
    viableDiscards: ['2p', '4p'],
    coachTakeaway: '在日麻实战中，两面听牌的和牌率是坎张的 2.5 倍以上，且容易立直自摸。好形率优先！',
    coachExplanation:
      '【局况解析】：当前为【南场·西家】。' +
      '手牌饼子有 24p 坎张和孤张 8p；索子有 67s 两面与 22s、44s 两个对子。' +
      '如果保留 8p 拆 24p，进张数可能微弱变动，但如果保留好形搭子、切掉浮牌 8p，后续听牌能确保极佳的好形两面听牌率。宁要 14 张好形进张，不要 16 张愚形进张！',
    mistakeExplanations: {
      '2p': '保留孤张 8p 而拆 24p 搭子属于本末倒置，8p 没有任何搭子基础。',
    },
  },
  {
    id: 'ch4-4',
    chapterId: 4,
    chapterTitle: '第四章：一向听黄金法则与好形率',
    title: '避开二度进张的搭子拆除',
    subtitle: '同一张牌的进张重复出现，果断拆掉劣势方',
    conceptTags: ['二度进张避坑', '好形率提升', '拆搭选择'],
    hand: '2m 3m 4m 5m 2p 3p 4p 7p 8p 8p 9p 5s 5s 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 7,
    doraIndicator: '3m',
    optimalDiscards: ['1z'],
    viableDiscards: ['9p'],
    coachTakeaway: '78p 与 89p 共享 7p 和 8p 进张（二度进张）。清理孤张后，应优先拆除边张 89p。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '观察饼子：78p 是两面（进 6,9p），89p 是边张（进 7p），7889p 组合中 7p 的进张是重叠的，且 8p 已经消耗了两张。' +
      '当前巡目首先切除单张孤张 1z 锁定一向听。后续进张时，绝不留恋死边张 89p，直接拆除 9p 让饼子回归清爽的 78p 两面。',
    mistakeExplanations: {
      '5s': '55s 是手牌极其关键的唯一雀头，切 5s 会瞬间导致手牌进入无头地狱，严禁切除！',
    },
  },
  {
    id: 'ch4-5',
    chapterId: 4,
    chapterTitle: '第四章：一向听黄金法则与好形率',
    title: '一向听黄金形态：两面双碰复合',
    subtitle: '多进张与好形听牌兼得的高效解法',
    conceptTags: ['双碰两面', '一向听', '黄金形'],
    hand: '3m 4m 5m 6m 7m 2p 3p 7s 7s 9s 9s 4p 4p 1z',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 6,
    doraIndicator: '6p',
    optimalDiscards: ['1z'],
    viableDiscards: [],
    coachTakeaway: '万子延伸两面 + 饼子两面对子复合 + 索子双雀头 = 全能听牌引擎！',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '手牌结构极其美妙：' +
      '万子 34567m 是五连形；饼子 2344p 是两面带雀头（摸 14p 听牌，摸 4p 成暗刻）；索子 77s 与 99s 互为双碰候补。' +
      '整手牌完全处于一向听的爆发期，无论摸入什么邻牌都能以极高番数与好形听牌。孤张 1z 是唯一累赘，立刻切 1z！',
    mistakeExplanations: {
      '7s': '盲目拆 77s 会破坏双对子结构，损失 7s 与 9s 的 4 张双碰进张，切 1z 才是完美牌效。',
    },
  },

  // ==========================================
  // CHAPTER 5: 役种倾向与实战打点
  // ==========================================
  {
    id: 'ch5-1',
    chapterId: 5,
    chapterTitle: '第五章：役种倾向与实战打点',
    title: '平和（Pinfu）导向的搭子与雀头定夺',
    subtitle: '为了这关键的 1 番，什么牌绝对不能留作雀头？',
    conceptTags: ['平和倾向', '役种导向', '雀头纯净度'],
    hand: '2m 3m 4m 6p 7p 2s 3s 4s 5s 6s 1z 1z 7m 7m',
    roundWind: '东',
    seatWind: '东',
    turnNumber: 6,
    doraIndicator: '8s',
    optimalDiscards: ['1z'],
    viableDiscards: ['7m'],
    coachTakeaway: '平和必须全顺子、两面听牌、且雀头不能是役牌！役牌字牌不可留作平和雀头。',
    coachExplanation:
      '【局况解析】：当前为【东场·东家】（庄家，场风自风皆为东）。此时东风（1z）是【连风东】（高达2番的特大役牌！）。' +
      '手牌中全是顺子搭子（234m、67p、234s、56s），极其适合做门清【平和】。' +
      '此时雀头候选有数牌 77m 和字牌 11z。如果用役牌 11z 当雀头，虽然有东风番数，但直接失去了平和役（甚至可能因为听牌变成双碰或单骑而丧失两面）；' +
      '而保留 77m 作为纯数牌雀头，手牌形成完美的 4 顺子+数牌雀头，兼备极快立直平和自摸。果断切 1z 保持平和高和率！',
    mistakeExplanations: {
      '7m': '切 7m 会被迫让字牌 11z 充当雀头，直接破坏了平和（Pinfu）役，损失宝贵的两面平和结构。',
    },
  },
  {
    id: 'ch5-2',
    chapterId: 5,
    chapterTitle: '第五章：役种倾向与实战打点',
    title: '断幺九（Tanyao）转型：果断舍弃幺九',
    subtitle: '当中张极为密集时，提前切出19端牌打开鸣牌通道',
    conceptTags: ['断幺九', '加速鸣牌', '役种意识'],
    hand: '2m 3m 4m 5m 3p 4p 5p 6s 7s 8s 1m 9p 4s 4s',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 5,
    doraIndicator: '7m',
    optimalDiscards: ['1m', '9p'],
    viableDiscards: [],
    coachTakeaway: '手牌中张扎实、幺九牌极少时，及早切除 1/9，不仅门清立直快，紧急时还能吃碰鸣牌！',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】。' +
      '手牌除了一张 1m 和一张 9p 以外，全部由 2~8 的中张构成！' +
      '一旦切除 1m 和 9p，整手牌瞬间变身为【断幺九】。断幺九不仅是日麻最容易成和的役种之一，更重要的是在实战中一旦需要抢攻或防守，可以随时通过吃、碰副露火速听牌。果断切 1m 或 9p 净化手牌！',
    mistakeExplanations: {
      '4s': '切 4s 破坏了中张雀头，纯属牌理错误。',
      '5m': '5m 是赤宝牌/中张核心，切 5m 严重降速。',
    },
  },
  {
    id: 'ch5-3',
    chapterId: 5,
    chapterTitle: '第五章：役种倾向与实战打点',
    title: '宝牌（Dora）孤张的去留时机',
    subtitle: '打点诱惑与速度之间，怎样权衡？',
    conceptTags: ['宝牌取舍', '打点速度平衡', 'Dora处理'],
    hand: '2m 3m 4m 7p 8p 2s 3s 7s 8s 9s 5m 5m 9m 1z',
    roundWind: '东',
    seatWind: '南',
    turnNumber: 6,
    doraIndicator: '4m',
    optimalDiscards: ['1z'],
    viableDiscards: ['9m'],
    coachTakeaway: '在起手与一向听推进阶段，孤张字牌与死端牌永远先于宝牌或有价值中张舍弃。',
    coachExplanation:
      '【局况解析】：当前为【东场·南家】，宝牌指示牌为 4m，因此 5m 为宝牌（Dora，手牌自带两张 5m 宝牌对子！）。1z（东）为场风役牌。' +
      '手牌已有 234m、78p、23s、789s，雀头是 55m（Dora对子，价值连城保底2番）。' +
      '端牌 9m 与客风 1z 都是浮牌，应毫不犹豫先切除 1z，随后切 9m，保护好 55m 的高打点。',
    mistakeExplanations: {
      '5m': '切 5m 纯属白送宝牌！两张 5m 提供了保底 2 番的巨大打点，绝不可随意舍弃。',
    },
  },
  {
    id: 'ch5-4',
    chapterId: 5,
    chapterTitle: '第五章：役种倾向与实战打点',
    title: '纯牌效与染手的平衡',
    subtitle: '多门子齐整时，切莫盲目强转清一色',
    conceptTags: ['染手误区', '纯牌效优先', '速度考量'],
    hand: '2m 3m 4m 5m 6m 7m 3p 4p 5p 6s 7s 8s 9m 9m',
    roundWind: '东',
    seatWind: '西',
    turnNumber: 7,
    doraIndicator: '1p',
    optimalDiscards: ['9m'],
    viableDiscards: ['3p', '5p'],
    coachTakeaway: '门清全好形面子齐备时，纯牌效一向听立直速度极快，强转混一色/清一色会导致严重降速！',
    coachExplanation:
      '【局况解析】：当前为【东场·西家】。' +
      '新手常看到自己有 23456799m 就想“做万子清一色”，把 345p、678s 这些已经完成的顺子拆掉。' +
      '这是严重的实战失误！当前手牌只需切一张 9m，立刻进入极其强大的两面听牌（立直+平和+自摸起步），速度极快，和牌率极高。切 9m 维持最纯粹的牌效！',
    mistakeExplanations: {
      '3p': '拆 345p 顺子强行做染手，会让手牌从听牌边缘退回三向听，实战中极易被对手先制立直击毙。',
    },
  },
]
