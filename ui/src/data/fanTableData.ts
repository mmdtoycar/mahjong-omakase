export interface FanItem {
  name: string
  fan: number
  description: string
  // Format: "Tile Tile Tile | Tile Tile Tile"
  // Prefix a group with * to highlight it
  example: string
  tags?: string[]
}

export const fanTableData: FanItem[] = [
  {
    fan: 88,
    name: '大四喜',
    description: '和牌中，有东、南、西、北四副刻子（杠）。',
    example: '*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Pei Pei Pei | Man1 Man1',
  },
  {
    fan: 88,
    name: '大三元',
    description: '和牌中，有中、发、白三副刻子（杠）。',
    example: '*Chun Chun Chun | *Hatsu Hatsu Hatsu | *Haku Haku Haku | Man1 Man2 Man3 | Pin1 Pin1',
  },
  {
    fan: 88,
    name: '绿一色',
    description: '由“23468条”及“发”字中的任何牌组成的和牌。',
    example: '*Sou2 Sou3 Sou4 | *Sou6 Sou6 Sou6 | *Sou8 Sou8 Sou8 | *Hatsu Hatsu Hatsu | *Sou2 Sou2',
  },
  {
    fan: 88,
    name: '九莲宝灯',
    description:
      '由一种花色序数牌按“1112345678999”组成的特定牌型，见同花色任何一张序数牌即成和牌（自摸加计不求人分）。',
    example: '*Man1 Man1 Man1 Man2 Man3 Man4 Man5 Man6 Man7 Man8 Man9 Man9 Man9 Man1',
  },
  {
    fan: 88,
    name: '四杠',
    description: '和牌中，有四副杠牌（暗杠加计）。',
    example: '*Pin1 Pin1 Pin1 Pin1 | *Pin2 Pin2 Pin2 Pin2 | *Pin3 Pin3 Pin3 Pin3 | *Pin4 Pin4 Pin4 Pin4 | Shaa Shaa',
  },
  {
    fan: 88,
    name: '连七对',
    description: '由一种花色序数相连的七个对子组成的和牌（自摸加计不求人分）。',
    example: '*Man1 Man1 | *Man2 Man2 | *Man3 Man3 | *Man4 Man4 | *Man5 Man5 | *Man6 Man6 | *Man7 Man7',
  },
  {
    fan: 88,
    name: '十三幺',
    description: '由三种序数牌的一、九牌，七种字牌及其中一对作将牌组成的和牌（自摸加计不求人分）。',
    example: '*Man1 Man9 Pin1 Pin9 Sou1 Sou9 Ton Nan Shaa Pei Haku Hatsu Chun Chun',
  },
  {
    fan: 64,
    name: '清幺九',
    description: '由序数牌一、九刻子（杠）、将牌组成的和牌。',
    example: '*Man1 Man1 Man1 | *Man9 Man9 Man9 | *Pin1 Pin1 Pin1 | *Pin9 Pin9 Pin9 | *Sou1 Sou1',
  },
  {
    fan: 64,
    name: '小四喜',
    description: '和牌中，有风牌的三副刻子（杠）、另一种风牌作将牌。',
    example: '*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Pei Pei | Man1 Man2 Man3',
  },
  {
    fan: 64,
    name: '小三元',
    description: '和牌中，有箭牌的两副刻子（杠）、另一种箭牌作将牌。',
    example: '*Chun Chun Chun | *Hatsu Hatsu Hatsu | *Haku Haku | Man1 Man2 Man3 | Pin1 Pin2 Pin3',
  },
  {
    fan: 64,
    name: '字一色',
    description: '由字牌的刻子（杠）、将牌组成的和牌。',
    example: '*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | *Haku Haku Haku | *Chun Chun',
  },
  {
    fan: 64,
    name: '四暗刻',
    description: '和牌中，有四副暗刻（暗杠）（自摸加计不求人分）。',
    example: '*Man1 Man1 Man1 | *Man2 Man2 Man2 | *Man3 Man3 Man3 | *Man4 Man4 Man4 | Pin1 Pin1',
  },
  {
    fan: 64,
    name: '一色双龙会',
    description: '一种花色的两个老少副、5作将牌。',
    example: '*Man1 Man2 Man3 | *Man1 Man2 Man3 | *Man7 Man8 Man9 | *Man7 Man8 Man9 | *Man5 Man5',
  },
  {
    fan: 48,
    name: '一色四同顺',
    description: '一种花色四副序数相同的顺子。',
    example: '*Man1 Man2 Man3 | *Man1 Man2 Man3 | *Man1 Man2 Man3 | *Man1 Man2 Man3 | Pin1 Pin1',
  },
  {
    fan: 48,
    name: '一色四节高',
    description: '一种花色四副依次递增一个序数的刻子（杠）。',
    example: '*Man1 Man1 Man1 | *Man2 Man2 Man2 | *Man3 Man3 Man3 | *Man4 Man4 Man4 | Pin1 Pin1',
  },
  {
    fan: 32,
    name: '一色四步高',
    description: '一种花色四副依次递增一个或两个序数的顺子。',
    example: '*Man1 Man2 Man3 | *Man2 Man3 Man4 | *Man3 Man4 Man5 | *Man4 Man5 Man6 | Pin1 Pin1',
  },
  {
    fan: 32,
    name: '三杠',
    description: '和牌中，有三副杠牌（暗杠加计）。',
    example: '*Pin1 Pin1 Pin1 Pin1 | *Pin2 Pin2 Pin2 Pin2 | *Pin3 Pin3 Pin3 Pin3 | Man1 Man2 Man3 | Man5 Man5',
  },
  {
    fan: 32,
    name: '混幺九',
    description: '由字牌和序数牌一、九的刻子（杠）、将牌组成的和牌。',
    example: '*Man1 Man1 Man1 | *Pin9 Pin9 Pin9 | *Ton Ton Ton | *Nan Nan Nan | *Haku Haku',
  },
  {
    fan: 24,
    name: '七对',
    description: '由七个对子组成的和牌（自摸加计不求人分）。',
    example: '*Man1 Man1 | *Man4 Man4 | *Pin2 Pin2 | *Pin5 Pin5 | *Sou3 Sou3 | *Sou8 Sou8 | *Ton Ton',
  },
  {
    fan: 24,
    name: '七星不靠',
    description:
      '必须有七个单张的东、南、西、北、中、发、白，加上三种花色数位按147、258、369中的七张序数牌组成的没有将牌的和牌（自摸加计不求人分）。',
    example: '*Man1 Man4 Man7 Pin2 Pin5 Pin8 Sou3 Ton Nan Shaa Pei Haku Hatsu Chun',
  },
  {
    fan: 24,
    name: '全双刻',
    description: '由2、4、6、8序数牌的刻子（杠）、将牌组成的和牌。',
    example: '*Man2 Man2 Man2 | *Man4 Man4 Man4 | *Pin6 Pin6 Pin6 | *Sou8 Sou8 Sou8 | *Pin2 Pin2',
  },
  {
    fan: 24,
    name: '清一色',
    description: '由一种花色序数牌组成的和牌。',
    example: '*Man1 Man2 Man3 | *Man4 Man5 Man6 | *Man7 Man8 Man9 | *Man2 Man3 Man4 | *Man5 Man5',
  },
  {
    fan: 24,
    name: '一色三同顺',
    description: '和牌中，有一种花色三副序数相同的顺子。',
    example: '*Man1 Man2 Man3 | *Man1 Man2 Man3 | *Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou1 Sou1',
  },
  {
    fan: 24,
    name: '一色三节高',
    description: '和牌中，有一种花色三副依次递增一个序数的刻子（杠）。',
    example: '*Man1 Man1 Man1 | *Man2 Man2 Man2 | *Man3 Man3 Man3 | Pin4 Pin5 Pin6 | Sou1 Sou1',
  },
  {
    fan: 24,
    name: '全大',
    description: '由序数牌7、8、9组成的和牌。',
    example: '*Man7 Man8 Man9 | *Pin7 Pin8 Pin9 | *Sou7 Sou7 Sou7 | *Sou8 Sou8 Sou8 | *Pin9 Pin9',
  },
  {
    fan: 24,
    name: '全中',
    description: '由序数牌4、5、6组成的和牌。',
    example: '*Man4 Man5 Man6 | *Pin4 Pin5 Pin6 | *Sou4 Sou4 Sou4 | *Sou5 Sou5 Sou5 | *Pin5 Pin5',
  },
  {
    fan: 24,
    name: '全小',
    description: '由序数牌1、2、3组成的和牌。',
    example: '*Man1 Man2 Man3 | *Pin1 Pin2 Pin3 | *Sou1 Sou1 Sou1 | *Sou2 Sou2 Sou2 | *Pin2 Pin2',
  },
  {
    fan: 16,
    name: '清龙',
    description: '和牌中，有同花色123、456、789相连的序数牌。',
    example: '*Man1 Man2 Man3 Man4 Man5 Man6 Man7 Man8 Man9 | Pin1 Pin2 Pin3 | Ton Ton',
  },
  {
    fan: 16,
    name: '三色双龙会',
    description: '两种花色两个老少副、另一种花色5作将牌的和牌。',
    example: '*Man1 Man2 Man3 | *Man7 Man8 Man9 | *Pin1 Pin2 Pin3 | *Pin7 Pin8 Pin9 | *Sou5 Sou5',
  },
  {
    fan: 16,
    name: '一色三步高',
    description: '和牌中，有一种花色三副依次递增一个或两个序数的顺子。',
    example: '*Man1 Man2 Man3 | *Man2 Man3 Man4 | *Man3 Man4 Man5 | Pin6 Pin7 Pin8 | Ton Ton',
  },
  {
    fan: 16,
    name: '全带五',
    description: '每副牌及将牌中必须有5的序数牌。',
    example: '*Man3 Man4 Man5 | *Pin5 Pin6 Pin7 | *Sou5 Sou5 Sou5 | *Sou4 Sou5 Sou6 | *Man5 Man5',
  },
  {
    fan: 16,
    name: '三同刻',
    description: '和牌中，有三副序数相同的刻子（杠）。',
    example: '*Man2 Man2 Man2 | *Pin2 Pin2 Pin2 | *Sou2 Sou2 Sou2 | Pin6 Pin7 Pin8 | Ton Ton',
  },
  {
    fan: 16,
    name: '三暗刻',
    description: '和牌中，有三副暗刻（暗杠）。',
    example: '*Man2 Man2 Man2 | *Pin4 Pin4 Pin4 | *Sou6 Sou6 Sou6 | Pin7 Pin8 Pin9 | Ton Ton',
  },
  {
    fan: 12,
    name: '全不靠',
    description:
      '由三种花色147、258、369不能错位的序数牌及东、南、西、北、中、发、白中任何14张单张牌组成的和牌（自摸加计不求人分）。',
    example: '*Man1 Man4 Man7 Pin2 Pin5 Pin8 Sou3 Sou6 Sou9 Ton Shaa Haku Hatsu Chun',
  },
  {
    fan: 12,
    name: '组合龙',
    description: '和牌中，有三种花色的147、258、369不能错位的序数牌（特殊顺子）。',
    example: '*Man1 Man4 Man7 Pin2 Pin5 Pin8 Sou3 Sou6 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 12,
    name: '大于五',
    description: '由序数牌6、7、8、9组成的和牌。',
    example: '*Man6 Man7 Man8 | *Pin7 Pin8 Pin9 | *Sou6 Sou6 Sou6 | *Sou8 Sou8 Sou8 | *Pin6 Pin6',
  },
  {
    fan: 12,
    name: '小于五',
    description: '由序数牌1、2、3、4组成的和牌。',
    example: '*Man1 Man2 Man3 | *Pin2 Pin3 Pin4 | *Sou1 Sou1 Sou1 | *Sou3 Sou3 Sou3 | *Pin2 Pin2',
  },
  {
    fan: 12,
    name: '三风刻',
    description: '和牌中，有三副风刻（杠）。',
    example: '*Ton Ton Ton | *Nan Nan Nan | *Shaa Shaa Shaa | Man1 Man2 Man3 | Pin2 Pin2',
  },
  {
    fan: 8,
    name: '花龙',
    description: '和牌中，有三种花色的三副顺子连接成123、456、789。',
    example: '*Man1 Man2 Man3 | *Pin4 Pin5 Pin6 | *Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 8,
    name: '推不倒',
    description: '由牌面图形没有上下区别的牌组成的和牌。包括“1234589饼”、“245689条”、“白板”。',
    example: '*Pin1 Pin2 Pin3 | *Pin8 Pin8 Pin8 | *Sou2 Sou2 Sou2 | *Sou4 Sou5 Sou6 | *Haku Haku',
  },
  {
    fan: 8,
    name: '三色三同顺',
    description: '和牌中，有三种花色三副序数相同的顺子。',
    example: '*Man2 Man3 Man4 | *Pin2 Pin3 Pin4 | *Sou2 Sou3 Sou4 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 8,
    name: '三色三节高',
    description: '和牌中，有三种花色三副依次递增一个序数的刻子（杠）。',
    example: '*Man2 Man2 Man2 | *Pin3 Pin3 Pin3 | *Sou4 Sou4 Sou4 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 8,
    name: '无番和',
    description: '和牌后，数不出任何番种分（花牌不计算在内）。',
    example: '*Man1 Man2 Man3 | *Pin4 Pin5 Pin6 | *Sou2 Sou3 Sou4 | *Man8 Man8 Man8 | *Nan Nan',
  },
  { fan: 8, name: '妙手回春', description: '自拿牌墙上最后一张牌和牌（不计自摸分）。', example: '' },
  { fan: 8, name: '海底捞月', description: '和打出的最后一张牌。', example: '' },
  {
    fan: 8,
    name: '杠上开花',
    description: '杠牌时，从牌墙补上一张牌成和牌。杠牌加计，不计自摸；杠来花牌再补花成和，不计杠上开花，可计自摸分。',
    example: '',
  },
  { fan: 8, name: '抢杠和', description: '和他人自拿开明杠的牌（不计和绝张）。', example: '' },
  {
    fan: 8,
    name: '双暗杠',
    description: '和牌中，有两副暗杠。',
    example: '*Back Man1 Man1 Back | *Back Pin4 Pin4 Back | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 6,
    name: '碰碰和',
    description: '由四副刻子（杠）、将牌组成的和牌。',
    example: '*Man2 Man2 Man2 | *Pin5 Pin5 Pin5 | *Sou8 Sou8 Sou8 | *Ton Ton Ton | *Nan Nan',
  },
  {
    fan: 6,
    name: '混一色',
    description: '由一种花色序数牌及字牌组成的和牌。',
    example: '*Man1 Man2 Man3 | *Man5 Man6 Man7 | *Man8 Man8 Man8 | *Ton Ton Ton | *Nan Nan',
  },
  {
    fan: 6,
    name: '三色三步高',
    description: '和牌中，有三种花色三副依次递增一个序数的顺子。',
    example: '*Man2 Man3 Man4 | *Pin3 Pin4 Pin5 | *Sou4 Sou5 Sou6 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 6,
    name: '五门齐',
    description: '由三种花色序数牌、风牌、箭牌组成的和牌。',
    example: '*Man1 Man2 Man3 | *Pin4 Pin5 Pin6 | *Sou7 Sou8 Sou9 | *Ton Ton Ton | *Chun Chun',
  },
  { fan: 6, name: '全求人', description: '四副牌组全是吃、碰（明杠），和他家打出的牌。不计单调将分。', example: '' },
  {
    fan: 6,
    name: '双箭刻',
    description: '和牌中，有两副箭刻（杠）。',
    example: '*Chun Chun Chun | *Hatsu Hatsu Hatsu | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Nan Nan',
  },
  {
    fan: 4,
    name: '全带幺',
    description: '每副牌及将牌中都有幺九牌。',
    example: '*Man1 Man2 Man3 | *Man7 Man8 Man9 | *Pin1 Pin2 Pin3 | *Ton Ton Ton | *Nan Nan',
  },
  { fan: 4, name: '不求人', description: '没有吃牌、碰牌、明杠，自摸和牌。', example: '' },
  {
    fan: 4,
    name: '双明杠',
    description: '和牌中，有两副明杠（一明杠与一暗杠计6分）。',
    example: '*Man1 Man1 Man1 Man1 | *Pin4 Pin4 Pin4 Pin4 | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  { fan: 4, name: '和绝张', description: '和牌池、桌面已亮明三张所剩的第四张相同的牌。', example: '' },
  {
    fan: 2,
    name: '箭刻',
    description: '由中、发、白三张相同的牌组成的刻子（杠）。',
    example: '*Chun Chun Chun | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '圈风刻',
    description: '与圈风相同的风刻（杠）。',
    example: '*Ton Ton Ton | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '门风刻',
    description: '与本门风相同的风刻（杠）。',
    example: '*Pei Pei Pei | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '门前清',
    description: '没有吃牌、碰牌、明杠，和他家打出的牌。',
    example: '*Man1 Man2 Man3 | *Pin4 Pin5 Pin6 | *Sou7 Sou8 Sou9 | *Ton Ton Ton | *Nan Nan',
  },
  {
    fan: 2,
    name: '平和',
    description: '由四副顺子及序数牌作将牌组成的和牌。',
    example: '*Man1 Man2 Man3 | *Pin4 Pin5 Pin6 | *Sou2 Sou3 Sou4 | *Sou7 Sou8 Sou9 | *Man5 Man5',
  },
  {
    fan: 2,
    name: '四归一',
    description: '和牌中，有四张相同的牌（不包括杠牌）。',
    example: '*Man1 Man2 Man3 | *Man1 Man1 Man1 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '双同刻',
    description: '和牌中，有两副序数相同的刻子（杠）。',
    example: '*Man2 Man2 Man2 | *Pin2 Pin2 Pin2 | Man4 Man5 Man6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '双暗刻',
    description: '和牌中，有两副暗刻（暗杠）。',
    example: '*Man2 Man2 Man2 | *Pin4 Pin4 Pin4 | Man7 Man8 Man9 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 2,
    name: '断幺',
    description: '和牌中没有一、九及字牌。',
    example: '*Man2 Man3 Man4 | *Pin4 Pin5 Pin6 | *Sou6 Sou7 Sou8 | *Sou2 Sou3 Sou4 | *Man5 Man5',
  },
  {
    fan: 2,
    name: '暗杠',
    description: '自拿四张相同的牌开杠。',
    example: '*Back Man1 Man1 Back | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 1,
    name: '一般高',
    description: '由一种花色的序数相同的顺子组成。',
    example: '*Man2 Man3 Man4 | *Man2 Man3 Man4 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 1,
    name: '喜相逢',
    description: '由两种花色的序数相同的顺子组成。',
    example: '*Man2 Man3 Man4 | *Pin2 Pin3 Pin4 | Sou4 Sou5 Sou6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 1,
    name: '连六',
    description: '由一种花色六张序数相连的顺子组成。',
    example: '*Man1 Man2 Man3 | *Man4 Man5 Man6 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 1,
    name: '老少副',
    description: '由一种花色的123、789的顺子组成。',
    example: '*Man1 Man2 Man3 | *Man7 Man8 Man9 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 1,
    name: '幺九刻',
    description: '由三张相同的一、九序数牌，字牌组成的刻子（杠）。',
    example: '*Man1 Man1 Man1 | Man4 Man5 Man6 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Nan Nan',
  },
  {
    fan: 1,
    name: '明杠',
    description: '他家打出一张与暗刻相同的牌开杠；或拿进一张与明刻相同的牌开杠。',
    example: '*Man1 Man1 Man1 Man1 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 1,
    name: '缺一门',
    description: '和牌中缺少一种花色序数牌。',
    example: '*Man1 Man2 Man3 | *Man4 Man5 Man6 | *Pin4 Pin5 Pin6 | *Pin7 Pin8 Pin9 | *Ton Ton',
  },
  {
    fan: 1,
    name: '无字',
    description: '和牌中没有字牌。',
    example: '*Man1 Man2 Man3 | *Man4 Man5 Man6 | *Pin4 Pin5 Pin6 | *Sou7 Sou8 Sou9 | *Man8 Man8',
  },
  {
    fan: 1,
    name: '边张',
    description: '只能听和123的3或789的7。',
    example: '^Man1 ^Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 1,
    name: '坎张',
    description: '只能听和顺子中间的牌。',
    example: '^Sou2 Sou3 ^Sou4 | Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Ton Ton Ton | Nan Nan',
  },
  {
    fan: 1,
    name: '单钓将',
    description: '调单张牌作将和牌。',
    example: 'Man1 Man2 Man3 | Pin4 Pin5 Pin6 | Sou7 Sou8 Sou9 | Ton Ton Ton | ^Nan Nan',
  },
  { fan: 1, name: '自摸', description: '拿牌后成和牌。', example: '' },
  {
    fan: 1,
    name: '花牌',
    description:
      '每张花牌计1分，不计在起和分内，和牌后才能计分。补花成和牌计自摸，不计杠上开花分；未补的花牌允许打出。',
    example: '',
    tags: ['不计起和分'],
  },
]

export const groupedFanTable = fanTableData.reduce((acc, current) => {
  if (!acc[current.fan]) {
    acc[current.fan] = []
  }
  acc[current.fan].push(current)
  return acc
}, {} as Record<number, FanItem[]>)
