export interface RiichiFanItem {
  name: string;
  fan: number;
  description: string;
  example: string;
  tags?: string[];
}

export const riichiFanTableData: RiichiFanItem[] = [
  // 1番
  { fan: 1, name: "立直", description: "门前清状态下，听牌时所作的宣告。", example: "" },
  { fan: 1, name: "断幺九", description: "和牌中没有一、九及字牌。鸣牌也成立（食断）。", example: "*Man2 Man3 Man4 | *Pin4 Pin5 Pin6 | *Sou6 Sou7 Sou8 | *Sou2 Sou3 Sou4 | *Man5 Man5" },
  { fan: 1, name: "役牌：白", description: "包含白板的刻子。鸣牌也成立。", example: "*Haku Haku Haku | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "役牌：发", description: "包含发财的刻子。鸣牌也成立。", example: "*Hatsu Hatsu Hatsu | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "役牌：中", description: "包含红中的刻子。鸣牌也成立。", example: "*Chun Chun Chun | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "役牌：场风", description: "和牌局所处场风的风牌刻子。鸣牌也成立。", example: "*Ton Ton Ton | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "役牌：自风", description: "和自己所处方位的风牌刻子。鸣牌也成立。", example: "*Ton Ton Ton | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "平和", description: "门前清状态下，由4副顺子和非役牌的将牌组成的和牌。且听牌为两面听。", example: "*Man2 Man3 Man4 | *Pin4 Pin5 Pin6 | *Sou2 Sou3 Sou4 | *Sou7 Sou8 Sou9 | *Man5 Man5" },
  { fan: 1, name: "门前清自摸和", description: "门前清状态下，自摸和牌。", example: "" },
  { fan: 1, name: "一发", description: "宣告立直后，在一巡内和牌，或在一巡内自摸和牌。这期间如有吃、碰、明杠，则不成立。", example: "" },
  { fan: 1, name: "一杯口", description: "门前清状态下，和牌中有2副完全相同的顺子。", example: "*Man2 Man3 Man4 | *Man2 Man3 Man4 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan" },
  { fan: 1, name: "岭上开花", description: "摸岭上牌和牌。", example: "" },
  { fan: 1, name: "海底摸月", description: "摸取海底牌和牌。", example: "" },
  { fan: 1, name: "河底捞鱼", description: "别人打出局中的最后一张牌时荣和。", example: "" },
  { fan: 1, name: "枪杠", description: "和别人加杠的牌。国士无双可抢暗杠。", example: "" },
  { fan: 1, name: "宝牌", description: "和牌时，手牌中每有一张宝牌计1番。必须有其他起和役才能和牌。", example: "", tags: ["非役"] },
  { fan: 1, name: "赤宝牌", description: "和牌时，手牌中每有一张红宝牌计1番。必须有其他起和役才能和牌。", example: "", tags: ["非役"] },
  { fan: 1, name: "里宝牌", description: "立直和牌时，翻开悬赏指示牌底下的牌。相应的宝牌每有一张计1番。必须有其他起和役才能和牌。", example: "", tags: ["非役"] },
  { fan: 1, name: "拔北宝牌", description: "(三人麻将) 拔出的北风可以作为宝牌提供相应的番数。必须有其他起和役才能和牌。", example: "", tags: ["非役"] },

  // 2番
  { fan: 2, name: "对对和", description: "和牌中含有4副刻子或杠。", example: "*Man2 Man2 Man2 | *Pin5 Pin5 Pin5 | *Sou8 Sou8 Sou8 | *Ton Ton Ton | *Nan Nan" },
  { fan: 2, name: "七对子", description: "门前清状态下，由7个不同的对子组成的和牌。", example: "*Man1 Man1 | *Man4 Man4 | *Pin2 Pin2 | *Pin5 Pin5 | *Sou3 Sou3 | *Sou8 Sou8 | *Ton Ton" },
  { fan: 2, name: "三色同顺", description: "含有3种花色且序数相同的3副顺子。副露减1番。", example: "*Man2 Man3 Man4 | *Pin2 Pin3 Pin4 | *Sou2 Sou3 Sou4 | Ton Ton Ton | Nan Nan", tags: ["副露-1番"] },
  { fan: 2, name: "一气通贯", description: "含有一种花色的123、456、789三副顺子。副露减1番。", example: "*Man1 Man2 Man3 | *Man4 Man5 Man6 | *Man7 Man8 Man9 | Pin1 Pin2 Pin3 | Ton Ton", tags: ["副露-1番"] },
  { fan: 2, name: "混全带幺九", description: "所有的顺子、刻子、将牌均含有老头牌和字牌。副露减1番。", example: "*Man1 Man2 Man3 | *Man7 Man8 Man9 | *Pin1 Pin2 Pin3 | *Ton Ton Ton | *Nan Nan", tags: ["副露-1番"] },
  { fan: 2, name: "三暗刻", description: "和牌中含有3副暗刻。只要不是别人打出的牌就可以。", example: "*Man2 Man2 Man2 | *Pin4 Pin4 Pin4 | *Sou6 Sou6 Sou6 | Pin7 Pin8 Pin9 | Ton Ton" },
  { fan: 2, name: "两立直", description: "第一巡时宣告立直。在此之前如果有别人的吃、碰、明杠，则该役不成立。", example: "" },
  { fan: 2, name: "小三元", description: "含有由中、发、白组成的2副刻子和1对将牌。", example: "*Chun Chun Chun | *Hatsu Hatsu Hatsu | *Haku Haku | Man1 Man2 Man3 | Pin1 Pin2 Pin3" },
  { fan: 2, name: "混老头", description: "和牌中只含有字牌和老头牌（一、九）。必然复合对对和或七对子。", example: "*Man1 Man1 Man1 | *Pin9 Pin9 Pin9 | *Ton Ton Ton | *Nan Nan Nan | *Haku Haku" },
  { fan: 2, name: "三色同刻", description: "和牌中，含有3种花色且序数相同的3副刻子。", example: "*Man2 Man2 Man2 | *Pin2 Pin2 Pin2 | *Sou2 Sou2 Sou2 | Pin4 Pin5 Pin6 | Nan Nan" },
  { fan: 2, name: "三杠子", description: "一个人开出3副杠。", example: "*Pin1 Pin1 Pin1 Pin1 | *Pin2 Pin2 Pin2 Pin2 | *Man3 Man3 Man3 Man3 | Man1 Man2 Man3 | Man5 Man5" },

  // 3番
  { fan: 3, name: "混一色", description: "含有字牌和一种花色的序数牌。副露减1番。", example: "*Man1 Man2 Man3 | *Man5 Man6 Man7 | *Man8 Man8 Man8 | *Ton Ton Ton | *Nan Nan", tags: ["副露-1番"] },
  { fan: 3, name: "纯全带幺九", description: "所有的顺子、刻子、将牌均含有老头牌（不含字牌）。副露减1番。", example: "*Man1 Man2 Man3 | *Man7 Man8 Man9 | *Pin1 Pin2 Pin3 | *Pin7 Pin8 Pin9 | *Sou1 Sou1", tags: ["副露-1番"] },
  { fan: 3, name: "二杯口", description: "门前清状态下，和牌中有2个一杯口（2个相同顺子组成的对子）。不计一杯口。", example: "*Man2 Man2 Man3 Man3 Man4 Man4 | *Pin4 Pin4 Pin5 Pin5 Pin6 Pin6 | Ton Ton" },

  // 6番
  { fan: 6, name: "清一色", description: "只含有一种花色的序数牌。副露减1番。", example: "*Man1 Man2 Man3 | *Man4 Man5 Man6 | *Man7 Man8 Man9 | *Man2 Man3 Man4 | *Man5 Man5", tags: ["副露-1番"] },

  // 13番 (役满)
  { fan: 13, name: "四暗刻", description: "含有4个暗刻。门前清限定。必须自摸，若荣和则为三暗刻对对和。", example: "*Man1 Man1 Man1 | *Man2 Man2 Man2 | *Man3 Man3 Man3 | *Man4 Man4 Man4 | Pin1 Pin1" },
  { fan: 13, name: "国士无双", description: "由13种一、九及字牌各一张，外加其中任何一种的一张组成的和牌。门前清限定。", example: "*Man1 | *Man9 | *Pin1 | *Pin9 | *Sou1 | *Sou9 | *Ton | *Nan | *Shaa | *Pei | *Haku | *Hatsu | *Chun Chun" },
  { fan: 13, name: "大三元", description: "包含中、发、白的三副刻子。", example: "*Chun Chun Chun | *Hatsu Hatsu Hatsu | *Haku Haku Haku | Man1 Man2 Man3 | Pin1 Pin1" },
  { fan: 13, name: "字一色", description: "全部由字牌组成的和牌。", example: "*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Haku Haku Haku | *Chun Chun" },
  { fan: 13, name: "小四喜", description: "包含风牌的3副刻子和1对将牌组成的和牌。", example: "*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Pei Pei | Man1 Man2 Man3" },
  { fan: 13, name: "绿一色", description: "只包含绿色牌（条子2、3、4、6、8和发财）构成的和牌。可不包含发财。", example: "*Sou2 Sou3 Sou4 | *Sou6 Sou6 Sou6 | *Sou8 Sou8 Sou8 | *Hatsu Hatsu Hatsu | *Sou2 Sou2" },
  { fan: 13, name: "清老头", description: "全部包含老头牌（一、九）的对对和。", example: "*Man1 Man1 Man1 | *Man9 Man9 Man9 | *Pin1 Pin1 Pin1 | *Pin9 Pin9 Pin9 | *Sou1 Sou1" },
  { fan: 13, name: "地和", description: "闲家在第一巡自摸和牌。这之前如有他家的吃、碰、明杠，则该役不成立。", example: "" },
  { fan: 13, name: "九莲宝灯", description: "由一种花色的1112345678999构成的牌型，和该种花色的任意一张。门前清限定。", example: "*Man1 Man1 Man1 Man2 Man3 Man4 Man5 Man6 Man7 Man8 Man9 Man9 Man9 Man1" },
  { fan: 13, name: "天和", description: "庄家发牌后第一张牌即和牌。暗杠不成立。", example: "" },
  { fan: 13, name: "四杠子", description: "4个杠。", example: "*Pin1 Pin1 Pin1 Pin1 | *Pin2 Pin2 Pin2 Pin2 | *Pin3 Pin3 Pin3 Pin3 | *Pin4 Pin4 Pin4 Pin4 | Shaa Shaa" },

  // 26番 (双倍役满)
  { fan: 26, name: "四暗刻单骑", description: "先集齐4个暗刻，单听将牌的和牌型。", example: "*Man1 Man1 Man1 | *Man2 Man2 Man2 | *Man3 Man3 Man3 | *Man4 Man4 Man4 | ^Pin1 Pin1" },
  { fan: 26, name: "国士无双十三面听", description: "手牌先集齐13种么九牌各一张，听所有13种么九牌。", example: "*Man1 *Man9 *Pin1 *Pin9 *Sou1 *Sou9 *Ton *Nan *Shaa *Pei *Haku *Hatsu *Chun | ^Chun" },
  { fan: 26, name: "大四喜", description: "包含风牌的4副刻子组成的和牌。", example: "*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Pei Pei Pei | Man1 Man1" },
  { fan: 26, name: "纯正九莲宝灯", description: "九莲宝灯听九面。1112345678999听所有同花色牌。", example: "*Man1 Man1 Man1 Man2 Man3 Man4 Man5 Man6 Man7 Man8 Man9 Man9 Man9 | ^Man1" },
];
