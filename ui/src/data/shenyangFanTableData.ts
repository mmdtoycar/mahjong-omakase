export interface ShenyangFanItem {
  name: string;
  fan: number;
  description: string;
  example: string;
  tags?: string[];
}

/**
 * 沈阳穷胡规则数据
 * 计算公式：分数 = 基础底分 * 2^N (N 为总番数叠加，通常 N 最大封顶为 6)
 */
export const shenyangFanTableData: ShenyangFanItem[] = [
  // 0番 (规则说明)
  {
    fan: 0,
    name: "沈阳麻将规则概览",
    description: "沈阳麻将是辽宁省沈阳地区的特色麻将玩法，采用136张牌包含万、筒、索、风、字五类牌型，参与者共4人。该玩法以庄家轮换制为基础，开局时庄家持14张牌、其余玩家持13张牌，按逆时针顺序轮流出牌。和牌需满足开门、有横牌或中发白掌牌、包含幺九牌及三门齐等条件。胜负结算时自摸则三家负，点炮仅由放铳者担责（注：闭门不点炮亦需赔付），番数按2的幂次计算。允许旋风杠特殊算番机制。该玩法因规则复杂且娱乐性强，深受当地牌友欢迎。",
    example: "",
    tags: ["官方规则", "玩法简介"]
  },

  // 1番
  {
    fan: 1,
    name: "闭门 (负方惩罚)",
    description: "特定惩罚性质：对于所有处于‘闭门’状态的负方（即无吃、碰、明杠），不仅其必须向赢家支付分数（即便其不是点炮者），且其承担的结算番数 N 额外增加 1 番。",
    example: "",
    tags: ["负方惩罚", "强制支付", "1番叠加"]
  },
  {
    fan: 1,
    name: "自摸",
    description: "自己抓得所需之牌。番数 N 增加 1 番。",
    example: "",
    tags: ["赢家番"]
  },
  {
    fan: 1,
    name: "点炮",
    description: "由别人打出所需之牌。番数 N 增加 1 番。",
    example: "",
    tags: ["输家番"]
  },
  {
    fan: 1,
    name: "庄家身份 (庄胡/点庄)",
    description: "如果庄家胡牌，或者闲家胡了庄家打出的炮，结算时番数 N 增加 1 番。",
    example: "",
    tags: ["身份叠加"]
  },
  {
    fan: 1,
    name: "闷大山",
    description: "指胜方在其余三名玩家中有人开门（吃、碰、明杠）之前胡牌。计1番。",
    example: "",
    tags: ["时机番"]
  },
  {
    fan: 1,
    name: "一口听 (胡单张/一本听)",
    description: "胡牌时听牌仅为一张，共分四种情况：\na. 边：和123中的3或789中的7；\nb. 夹：和顺子中间张（如和123中的2）；\nc. 单胡幺：除和牌外无其它幺九时，和123中的1或789中的9；\nd. 单砸：即单吊将牌（和牌是将来凑成对子的一张）。\n符合以上任一情况计1番。",
    example: "Pin2 ^Pin3 Pin4 | Man1 Man2 Man3 | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan",
    tags: ["判定番", "1番"]
  },
  {
    fan: 1,
    name: "手把一",
    description: "只在‘飘胡’（对对胡）的情况下成立。经过吃、碰、明杠后，手牌仅剩一张，单钓这张牌胡牌。计1番。沈阳规则下，非飘胡牌型不允许计手把一。",
    example: "Man2 Man2 Man2 | Pin5 Pin5 Pin5 | Sou8 Sou8 Sou8 | Ton Ton Ton | ^Nan",
    tags: ["番型", "需复合飘胡"]
  },
  {
    fan: 1,
    name: "旋风杠 (中发白)",
    description: "手中集齐中、发、白各一张即可亮雷。玩家可在自己行牌的任意回合亮出。计1番。\n注意：\n1. 亮出旋风杠不算开门（不影响闭门状态）。\n2. 在胡牌之前必须主动亮出，否则该局不得胡牌。",
    example: "*Chun *Hatsu *Haku",
    tags: ["杠牌", "特殊规则", "不开门"]
  },
  {
    fan: 1,
    name: "中发白碰",
    description: "手中持有中、发、白任意一门组成的碰牌，计1番。",
    example: "*Chun Chun Chun",
    tags: ["碰牌"]
  },
  {
    fan: 1,
    name: "明杠",
    description: "包括点杠或补杠，计1番。",
    example: "*Man1 Man1 Man1 Man1",
    tags: ["杠牌"]
  },
  {
    fan: 1,
    name: "杠上开花",
    description: "开杠抓进的牌成和牌。计1番。",
    example: "",
    tags: ["状态番"]
  },
  {
    fan: 1,
    name: "海底捞月",
    description: "在分张（最后一轮牌，只抓牌不出牌）时和牌。计1番。",
    example: "",
    tags: ["状态番"]
  },
  {
    fan: 1,
    name: "抢杠",
    description: "和别人补杠后打出的牌。计1番。",
    example: "",
    tags: ["状态番"]
  },
  {
    fan: 1,
    name: "四归一",
    description: "和牌时，非杠牌可以组成4张相同牌。计1番。",
    example: "*Man1 Man2 Man3 | *Man1 Man1 Man1",
    tags: ["番型"]
  },
  {
    fan: 1,
    name: "黄庄长毛 / 跟庄长毛",
    description: "流局或首轮跟庄，累积计入后续对局番数，计1番。",
    example: "",
    tags: ["长毛叠加"]
  },

  // 2番
  {
    fan: 2,
    name: "旋风杠 (东南西北)",
    description: "手中集齐东、南、西、北各一张即可亮雷。玩家可在自己行牌的任意回合亮出。计2番。\n注意：\n1. 亮出旋风杠不算开门（不影响闭门状态）。\n2. 在胡牌之前必须主动亮出，否则该局不得胡牌。",
    example: "*Ton *Nan *Shaa *Pei",
    tags: ["杠牌", "特殊规则", "不开门"]
  },
  {
    fan: 2,
    name: "暗杠",
    description: "自己抓齐四张同样的牌面朝下开杠。计2番。",
    example: "*Back Man1 Man1 Back",
    tags: ["杠牌"]
  },
  {
    fan: 2,
    name: "中发白明杠",
    description: "中发白组成的明杠。计2番。",
    example: "*Chun Chun Chun Chun",
    tags: ["杠牌"]
  },
  {
    fan: 2,
    name: "七小对",
    description: "胡牌由7个对子组成。计2番。\n特点：沈阳穷胡中唯一允许‘不开门’（闭门）胡牌的情况。\n限制：虽不要求有‘横’（刻子），但仍必须满足三门齐（不缺门）和有幺九（不缺幺）的要求。此外，不再计入‘胡单张’番数。",
    example: "Man1 Man1 | Man9 Man9 | Pin1 Pin1 | Pin9 Pin9 | Sou1 Sou1 | Sou9 Sou9 | Ton Ton",
    tags: ["特殊胡法", "不开门许可"]
  },

  // 3番
  {
    fan: 3,
    name: "飘胡 (对对胡)",
    description: "胡牌时，手牌由4副刻子或杠（暗刻、明刻、杠均开）与一对将牌组成。沈阳穷胡中的大番型，计3番。",
    example: "*Man2 Man2 Man2 | *Pin5 Pin5 Pin5 | *Sou8 Sou8 Sou8 | *Ton Ton Ton | *Nan Nan",
    tags: ["大番型"]
  },
  {
    fan: 3,
    name: "中发白暗杠",
    description: "中发白组成的暗杠。计3番。",
    example: "*Back Chun Chun Back",
    tags: ["杠牌", "高收益"]
  }
];
