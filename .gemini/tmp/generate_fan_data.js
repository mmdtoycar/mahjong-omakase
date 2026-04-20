const fs = require('fs');

const fanTableData = [
  { fan: 88, name: '大四喜', description: '由4副风刻(杠)组成的和牌。不计圈风刻、门风刻、三风刻、碰碰和。', example: ['Ton', 'Ton', 'Ton', 'Nan', 'Nan', 'Nan', 'Shaa', 'Shaa', 'Shaa', 'Pei', 'Pei', 'Pei', 'Man1', 'Man1'] },
  { fan: 88, name: '大三元', description: '和牌中，有中发白3副刻子。不计箭刻、双箭刻。', example: ['Chun', 'Chun', 'Chun', 'Hatsu', 'Hatsu', 'Hatsu', 'Haku', 'Haku', 'Haku', 'Man1', 'Man2', 'Man3', 'Pin1', 'Pin1'] },
  { fan: 88, name: '绿一色', description: '由23468条及发字中的任何牌组成的顺子、刻子、将的和牌。不计混一色。如无发字组成的各牌，可计清一色。', example: ['Sou2', 'Sou3', 'Sou4', 'Sou6', 'Sou6', 'Sou6', 'Sou8', 'Sou8', 'Sou8', 'Hatsu', 'Hatsu', 'Hatsu', 'Sou2', 'Sou2'] },
  { fan: 88, name: '九莲宝灯', description: '由一种花色序数牌子按1112345678999组成的特定牌型，见同花色任何1张序数牌即成和牌。不计清一色。', example: ['Man1', 'Man1', 'Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Man7', 'Man8', 'Man9', 'Man9', 'Man9', 'Man1'] },
  { fan: 88, name: '四杠', description: '4个杠。不计三杠、双暗杠、双明杠、明杠、暗杠、单钓将。', example: ['Pin1', 'Pin1', 'Pin1', 'Pin1', 'Pin2', 'Pin2', 'Pin2', 'Pin2', 'Pin3', 'Pin3', 'Pin3', 'Pin3', 'Pin4', 'Pin4', 'Pin4', 'Pin4', 'Shaa', 'Shaa'] },
  { fan: 88, name: '连七对', description: '由一种花色序数牌组成序数相连的7个对子的和牌。不计清一色、不求人、单钓将。', example: ['Man1', 'Man1', 'Man2', 'Man2', 'Man3', 'Man3', 'Man4', 'Man4', 'Man5', 'Man5', 'Man6', 'Man6', 'Man7', 'Man7'] },
  { fan: 88, name: '十三幺', description: '由3种序数牌的一、九牌，7种字牌及其中一对作将组成的和牌。不计五门齐、不求人、单钓将。', example: ['Man1', 'Man9', 'Pin1', 'Pin9', 'Sou1', 'Sou9', 'Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun', 'Chun'] },
  { fan: 64, name: '清幺九', description: '由序数牌一、九刻子组成的和牌。不计碰碰和、全带幺、幺九刻、无字。', example: ['Man1', 'Man1', 'Man1', 'Man9', 'Man9', 'Man9', 'Pin1', 'Pin1', 'Pin1', 'Pin9', 'Pin9', 'Pin9', 'Sou1', 'Sou1'] },
  { fan: 64, name: '小四喜', description: '和牌时有风牌的3副刻子及将牌。不计三风刻。', example: ['Ton', 'Ton', 'Ton', 'Nan', 'Nan', 'Nan', 'Shaa', 'Shaa', 'Shaa', 'Pei', 'Pei', 'Man1', 'Man2', 'Man3'] },
  { fan: 64, name: '小三元', description: '和牌时有箭牌的2副刻子及将牌。不计双箭刻、箭刻。', example: ['Chun', 'Chun', 'Chun', 'Hatsu', 'Hatsu', 'Hatsu', 'Haku', 'Haku', 'Man1', 'Man2', 'Man3', 'Pin1', 'Pin2', 'Pin3'] },
  { fan: 64, name: '字一色', description: '由字牌的刻子(杠)、将组成的和牌。不计碰碰和。', example: ['Ton', 'Ton', 'Ton', 'Nan', 'Nan', 'Nan', 'Shaa', 'Shaa', 'Shaa', 'Haku', 'Haku', 'Haku', 'Chun', 'Chun'] },
  { fan: 64, name: '四暗刻', description: '4个暗刻(暗杠)。不计门前清、碰碰和。', example: ['Man1', 'Man1', 'Man1', 'Man2', 'Man2', 'Man2', 'Man3', 'Man3', 'Man3', 'Man4', 'Man4', 'Man4', 'Pin1', 'Pin1'] },
  { fan: 64, name: '一色双龙会', description: '一种花色的两个老少副，5为将牌。不计平和、七对、清一色。', example: ['Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Man7', 'Man8', 'Man9', 'Man7', 'Man8', 'Man9', 'Man5', 'Man5'] },
  { fan: 48, name: '一色四同顺', description: '一种花色4副序数相同的顺子。不计一色三节高、一色三同顺、一般高、四归一。', example: ['Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Pin1', 'Pin1'] },
  { fan: 48, name: '一色四节高', description: '一种花色4副依次递增一位数的刻子。不计一色三同顺、碰碰和。', example: ['Man1', 'Man1', 'Man1', 'Man2', 'Man2', 'Man2', 'Man3', 'Man3', 'Man3', 'Man4', 'Man4', 'Man4', 'Pin1', 'Pin1'] },
  { fan: 32, name: '一色四步高', description: '一种花色4副依次递增一位数或二位数的顺子。', example: ['Man1', 'Man2', 'Man3', 'Man2', 'Man3', 'Man4', 'Man3', 'Man4', 'Man5', 'Man4', 'Man5', 'Man6', 'Pin1', 'Pin1'] },
  { fan: 32, name: '三杠', description: '3个杠。', example: ['Pin1', 'Pin1', 'Pin1', 'Pin1', 'Pin2', 'Pin2', 'Pin2', 'Pin2', 'Pin3', 'Pin3', 'Pin3', 'Pin3', 'Man1', 'Man2', 'Man3', 'Man5', 'Man5'] },
  { fan: 32, name: '混幺九', description: '由字牌和序数牌一、九的刻子及将牌组成的和牌。不计碰碰和。', example: ['Man1', 'Man1', 'Man1', 'Pin9', 'Pin9', 'Pin9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan', 'Nan', 'Haku', 'Haku'] },
  { fan: 24, name: '七对', description: '由7个对子组成和牌。不计不求人、单钓将。', example: ['Man1', 'Man1', 'Man4', 'Man4', 'Pin2', 'Pin2', 'Pin5', 'Pin5', 'Sou3', 'Sou3', 'Sou8', 'Sou8', 'Ton', 'Ton'] },
  { fan: 24, name: '七星不靠', description: '必须有7个单张的东西南北中发白，加上3种花色，数位按147、258、369中的7张序数牌组成没有将牌的和牌。不计五门齐、不求人、单钓将。', example: ['Man1', 'Man4', 'Man7', 'Pin2', 'Pin5', 'Pin8', 'Sou3', 'Ton', 'Nan', 'Shaa', 'Pei', 'Haku', 'Hatsu', 'Chun'] },
  { fan: 24, name: '全双刻', description: '由2、4、6、8序数牌的刻子、将牌组成的和牌。不计碰碰和、断幺。', example: ['Man2', 'Man2', 'Man2', 'Man4', 'Man4', 'Man4', 'Pin6', 'Pin6', 'Pin6', 'Sou8', 'Sou8', 'Sou8', 'Pin2', 'Pin2'] },
  { fan: 24, name: '清一色', description: '由一种花色的序数牌组成和牌。不计无字。', example: ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Man7', 'Man8', 'Man9', 'Man2', 'Man3', 'Man4', 'Man5', 'Man5'] },
  { fan: 24, name: '一色三同顺', description: '和牌时有一种花色3副序数相同的顺子。不计一色三节高。', example: ['Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou1', 'Sou1'] },
  { fan: 24, name: '一色三节高', description: '和牌时有一种花色3副依次递增一位数字的刻子。不计一色三同顺。', example: ['Man1', 'Man1', 'Man1', 'Man2', 'Man2', 'Man2', 'Man3', 'Man3', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou1', 'Sou1'] },
  { fan: 24, name: '全大', description: '由序数牌789组成的顺子、刻子(杠)、将牌的和牌。不计无字。', example: ['Man7', 'Man8', 'Man9', 'Pin7', 'Pin8', 'Pin9', 'Sou7', 'Sou7', 'Sou7', 'Sou8', 'Sou8', 'Sou8', 'Pin9', 'Pin9'] },
  { fan: 24, name: '全中', description: '由序数牌456组成的顺子、刻子(杠)、将牌的和牌。不计断幺。', example: ['Man4', 'Man5', 'Man6', 'Pin4', 'Pin5', 'Pin6', 'Sou4', 'Sou4', 'Sou4', 'Sou5', 'Sou5', 'Sou5', 'Pin5', 'Pin5'] },
  { fan: 24, name: '全小', description: '由序数牌123组成的顺子、刻子(杠)、将牌的和牌。不计无字。', example: ['Man1', 'Man2', 'Man3', 'Pin1', 'Pin2', 'Pin3', 'Sou1', 'Sou1', 'Sou1', 'Sou2', 'Sou2', 'Sou2', 'Pin2', 'Pin2'] },
  { fan: 16, name: '清龙', description: '和牌时，有一种花色1-9相连接的序数牌。', example: ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Man7', 'Man8', 'Man9', 'Pin1', 'Pin2', 'Pin3', 'Ton', 'Ton'] },
  { fan: 16, name: '三色双龙会', description: '2种花色2个老少副、另一种花色5作将的和牌。不计喜相逢、老少副、无字、平和。', example: ['Man1', 'Man2', 'Man3', 'Man7', 'Man8', 'Man9', 'Pin1', 'Pin2', 'Pin3', 'Pin7', 'Pin8', 'Pin9', 'Sou5', 'Sou5'] },
  { fan: 16, name: '一色三步高', description: '和牌时，有一种花色3副依次递增一位或二位数字的顺子。', example: ['Man1', 'Man2', 'Man3', 'Man2', 'Man3', 'Man4', 'Man3', 'Man4', 'Man5', 'Pin6', 'Pin7', 'Pin8', 'Ton', 'Ton'] },
  { fan: 16, name: '全带五', description: '每副牌及将牌必须有5的序数牌。不计断幺。', example: ['Man3', 'Man4', 'Man5', 'Pin5', 'Pin6', 'Pin7', 'Sou5', 'Sou5', 'Sou5', 'Sou4', 'Sou5', 'Sou6', 'Man5', 'Man5'] },
  { fan: 16, name: '三同刻', description: '3个序数相同的刻子(杠)。', example: ['Man2', 'Man2', 'Man2', 'Pin2', 'Pin2', 'Pin2', 'Sou2', 'Sou2', 'Sou2', 'Pin6', 'Pin7', 'Pin8', 'Ton', 'Ton'] },
  { fan: 16, name: '三暗刻', description: '3个暗刻。', example: ['Man2', 'Man2', 'Man2', 'Pin4', 'Pin4', 'Pin4', 'Sou6', 'Sou6', 'Sou6', 'Pin7', 'Pin8', 'Pin9', 'Ton', 'Ton'] },
  { fan: 12, name: '全不靠', description: '由单张3种花色147、258、369不能错位的序数牌及东南西北中发白中的任何14张牌组成的和牌。不计五门齐、不求人、单钓将。', example: ['Man1', 'Man4', 'Man7', 'Pin2', 'Pin5', 'Pin8', 'Sou3', 'Sou6', 'Sou9', 'Ton', 'Shaa', 'Haku', 'Hatsu', 'Chun'] },
  { fan: 12, name: '组合龙', description: '3种花色的147、258、369不能错位的序数牌。', example: ['Man1', 'Man4', 'Man7', 'Pin2', 'Pin5', 'Pin8', 'Sou3', 'Sou6', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 12, name: '大于五', description: '由序数牌6-9的顺子、刻子、将牌组成的和牌。不计无字。', example: ['Man6', 'Man7', 'Man8', 'Pin7', 'Pin8', 'Pin9', 'Sou6', 'Sou6', 'Sou6', 'Sou8', 'Sou8', 'Sou8', 'Pin6', 'Pin6'] },
  { fan: 12, name: '小于五', description: '由序数牌1-4的顺子、刻子、将牌组成的和牌。不计无字。', example: ['Man1', 'Man2', 'Man3', 'Pin2', 'Pin3', 'Pin4', 'Sou1', 'Sou1', 'Sou1', 'Sou3', 'Sou3', 'Sou3', 'Pin2', 'Pin2'] },
  { fan: 12, name: '三风刻', description: '3个风刻。', example: ['Ton', 'Ton', 'Ton', 'Nan', 'Nan', 'Nan', 'Shaa', 'Shaa', 'Shaa', 'Man1', 'Man2', 'Man3', 'Pin2', 'Pin2'] },
  { fan: 8, name: '花龙', description: '3种花色的3副顺子连接成1-9的序数牌。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '推不倒', description: '由牌面图形没有上下区别的牌组成的和牌，包括1234589饼、245689条、白板。不计缺一门。', example: ['Pin1', 'Pin2', 'Pin3', 'Pin8', 'Pin8', 'Pin8', 'Sou2', 'Sou2', 'Sou2', 'Sou4', 'Sou5', 'Sou6', 'Haku', 'Haku'] },
  { fan: 8, name: '三色三同顺', description: '和牌时，有3种花色3副序数相同的顺子。', example: ['Man2', 'Man3', 'Man4', 'Pin2', 'Pin3', 'Pin4', 'Sou2', 'Sou3', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '三色三节高', description: '和牌时，有3种花色3副依次递增一位数的刻子。', example: ['Man2', 'Man2', 'Man2', 'Pin3', 'Pin3', 'Pin3', 'Sou4', 'Sou4', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '无番和', description: '和牌后，数不出任何番种分(花牌不计算在内)。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Man8', 'Man8', 'Man8', 'Nan', 'Nan'] },
  { fan: 8, name: '妙手回春', description: '自摸牌墙上最后一张牌和牌。不计自摸。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '海底捞月', description: '和打出的最后一张牌。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '杠上开花', description: '开杠抓进的牌成和牌(不包括补花)。不计自摸。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 8, name: '抢杠和', description: '和别人自抓开明杠的牌。不计和绝张。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '碰碰和', description: '由4副刻子(或杠)、将牌组成的和牌。', example: ['Man2', 'Man2', 'Man2', 'Pin5', 'Pin5', 'Pin5', 'Sou8', 'Sou8', 'Sou8', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '混一色', description: '由一种花色序数牌及字牌组成的和牌。', example: ['Man1', 'Man2', 'Man3', 'Man5', 'Man6', 'Man7', 'Man8', 'Man8', 'Man8', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '三色三步高', description: '3种花色3副依次递增一位序数的顺子。', example: ['Man2', 'Man3', 'Man4', 'Pin3', 'Pin4', 'Pin5', 'Sou4', 'Sou5', 'Sou6', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '五门齐', description: '和牌时3种序数牌、风、箭牌齐全。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Chun', 'Chun'] },
  { fan: 6, name: '全求人', description: '全靠吃牌、碰牌、单钓别人批出的牌和牌。不计单钓。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '双暗杠', description: '2个暗杠。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 6, name: '双箭刻', description: '2副箭刻(或杠)。', example: ['Chun', 'Chun', 'Chun', 'Hatsu', 'Hatsu', 'Hatsu', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Nan', 'Nan'] },
  { fan: 4, name: '全带幺', description: '和牌时，每副牌、将牌都有幺牌。', example: ['Man1', 'Man2', 'Man3', 'Man7', 'Man8', 'Man9', 'Pin1', 'Pin2', 'Pin3', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 4, name: '不求人', description: '4副牌及将中没有吃牌、碰牌(包括明杠)，自摸和牌。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 4, name: '双明杠', description: '2个明杠。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 4, name: '和绝张', description: '和牌池、桌面已亮明的3张牌所剩的第4张牌(抢杠和不计和绝张)。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 2, name: '箭刻', description: '由中、发、白3张相同的牌组成的刻子。', example: ['Chun', 'Chun', 'Chun', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '圈风刻', description: '与圈风相同的风刻。', example: ['Ton', 'Ton', 'Ton', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '门风刻', description: '与本门风相同的风刻。', example: ['Ton', 'Ton', 'Ton', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '门前清', description: '没有吃、碰、明杠，和别人打出的牌。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 2, name: '平和', description: '由4副顺子及序数牌作将组成的和牌，边、坎、钓不影响平和。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou2', 'Sou3', 'Sou4', 'Sou7', 'Sou8', 'Sou9', 'Man5', 'Man5'] },
  { fan: 2, name: '四归一', description: '和牌中，有4张相同的牌归于一家的顺、刻子、对、将牌中(不包括杠牌)。', example: ['Man1', 'Man2', 'Man3', 'Man1', 'Man1', 'Man1', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '双同刻', description: '2副序数相同的刻子。', example: ['Man2', 'Man2', 'Man2', 'Pin2', 'Pin2', 'Pin2', 'Man4', 'Man5', 'Man6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '双暗刻', description: '2个暗刻。', example: ['Man2', 'Man2', 'Man2', 'Pin4', 'Pin4', 'Pin4', 'Man7', 'Man8', 'Man9', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 2, name: '断幺', description: '和牌中没有一、九及字牌。', example: ['Man2', 'Man3', 'Man4', 'Pin4', 'Pin5', 'Pin6', 'Sou6', 'Sou7', 'Sou8', 'Sou2', 'Sou3', 'Sou4', 'Man5', 'Man5'] },
  { fan: 1, name: '一般高', description: '由一种花色2副相同的顺子组成的牌。', example: ['Man2', 'Man3', 'Man4', 'Man2', 'Man3', 'Man4', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 1, name: '喜相逢', description: '2种花色2副序数相同的顺子。', example: ['Man2', 'Man3', 'Man4', 'Pin2', 'Pin3', 'Pin4', 'Sou4', 'Sou5', 'Sou6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 1, name: '连六', description: '一种花色6张相连接的序数牌。', example: ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 1, name: '老少副', description: '一种花色牌的123、789两副顺子。', example: ['Man1', 'Man2', 'Man3', 'Man7', 'Man8', 'Man9', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 1, name: '幺九刻', description: '3张相同的一、九序数牌或字牌组成的刻子(或杠)。', example: ['Man1', 'Man1', 'Man1', 'Man4', 'Man5', 'Man6', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Nan', 'Nan'] },
  { fan: 1, name: '明杠', description: '自己有暗刻，碰别人打出的一张相同的牌开杠：或自己抓进一张与碰的明刻相同的牌开杠。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 1, name: '缺一门', description: '和牌中缺少一种花色序数牌。', example: ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Pin4', 'Pin5', 'Pin6', 'Pin7', 'Pin8', 'Pin9', 'Ton', 'Ton'] },
  { fan: 1, name: '无字', description: '和牌中没有字牌。', example: ['Man1', 'Man2', 'Man3', 'Man4', 'Man5', 'Man6', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Man8', 'Man8'] },
  { fan: 1, name: '边张', description: '单和123的3及789的7或1233和3、7789和7都为边张。手中有12345和3，56789和7不算边张。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 1, name: '坎张', description: '和2条、4条之间的3条。4556和5也算坎张，手中有45567和6不算坎张。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 1, name: '单钓将', description: '钓单张牌作将成和。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 1, name: '自摸', description: '自己抓进牌成和牌。', example: ['Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] },
  { fan: 1, name: '花牌', description: '即春夏秋冬，梅兰竹菊，每花计一分。不计在起和分内，和牌后才能计分。花牌补花成和计自摸，不计杠上开花。', example: ['Haku', 'Man1', 'Man2', 'Man3', 'Pin4', 'Pin5', 'Pin6', 'Sou7', 'Sou8', 'Sou9', 'Ton', 'Ton', 'Ton', 'Nan', 'Nan'] }
];

let content = `export interface FanItem {
  name: string;
  fan: number;
  description: string;
  example: string[];
}

export const fanTableData: FanItem[] = ${JSON.stringify(fanTableData, null, 2)};

export const groupedFanTable = fanTableData.reduce((acc, current) => {
  if (!acc[current.fan]) {
    acc[current.fan] = [];
  }
  acc[current.fan].push(current);
  return acc;
}, {} as Record<number, FanItem[]>);
`;

fs.writeFileSync('c:/Users/lepei/program/mahjong-omakase/frontend/src/data/fanTableData.ts', content);
