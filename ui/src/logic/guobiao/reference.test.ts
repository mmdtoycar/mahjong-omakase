import { test, expect, describe } from 'vitest';
import { Tile, TileSuit } from './tiles';
import { Meld, GameOptions } from './types';
import { calculateBestScore, calculateAllBestScores, getTingTiles } from './fan';

/**
 * Hand String Format Parser based on GB-Mahjong (zheng-fan)
 * Example: "[EEE,2][SSSS,1]WWWNN55pN|EE1000"
 */
function parseHand(s_ori: string): { concealed: Tile[], melds: Meld[], options: GameOptions } {
    const s = s_ori.replace(/\s/g, '');
    const concealed: Tile[] = [];
    const melds: Meld[] = [];
    let quanfeng = 1;
    let menfeng = 1;
    let zimo = false;
    let juezhang = false;
    let haidi = false;
    let gang = false;
    let huaCount = 0;

    const parts = s.split('|');
    const mainPart = parts[0];
    const contextPart = parts[1];
    const huaPart = parts[2];

    // Parse Main Part (Melds and Concealed)
    let i = 0;
    while (i < mainPart.length) {
        if (mainPart[i] === '[') {
            const closeBracket = mainPart.indexOf(']', i);
            const meldStr = mainPart.substring(i + 1, closeBracket);
            const [tilesPart, offerPart] = meldStr.split(',');
            const offer = offerPart ? parseInt(offerPart) : (tilesPart.length === 3 ? 1 : 0);
            
            const suitChar = tilesPart[tilesPart.length - 1];
            const isZ = 'ESWNCFP'.includes(suitChar);
            const suit = isZ ? 'z' : (suitChar as TileSuit);
            const tiles: Tile[] = [];
            const ranksOrChars = isZ ? tilesPart : tilesPart.substring(0, tilesPart.length - 1);
            
            for (const char of ranksOrChars) {
                if (isZ) {
                    const zMap: Record<string, number> = { 'E':1,'S':2,'W':3,'N':4,'C':5,'F':6,'P':7 };
                    tiles.push(new Tile('z', zMap[char]));
                } else {
                    tiles.push(new Tile(suit, parseInt(char)));
                }
            }

            if (tiles.length === 3) {
                const isShun = !isZ && tiles[1].rank === tiles[0].rank + 1 && tiles[2].rank === tiles[1].rank + 1;
                melds.push({
                    type: isShun ? 'shun' : 'ke',
                    tiles,
                    isOpen: offer !== 0
                });
            } else {
                melds.push({
                    type: 'gang',
                    tiles,
                    isOpen: offer !== 0
                });
            }
            i = closeBracket + 1;
        } else {
            let j = i;
            let nums = "";
            while (j < mainPart.length && '123456789'.includes(mainPart[j])) {
                nums += mainPart[j];
                j++;
            }
            if (j < mainPart.length && 'msp'.includes(mainPart[j])) {
                const suit = mainPart[j] as TileSuit;
                for (const n of nums) {
                    concealed.push(new Tile(suit, parseInt(n)));
                }
                i = j + 1;
            } else if (j < mainPart.length && 'ESWNCFP'.includes(mainPart[j])) {
                const zMap: Record<string, number> = { 'E':1,'S':2,'W':3,'N':4,'C':5,'F':6,'P':7 };
                concealed.push(new Tile('z', zMap[mainPart[j]]));
                i = j + 1;
            } else if (j < mainPart.length && 'a-h'.includes(mainPart[j])) {
                huaCount++;
                i = j + 1;
            } else {
                if ('ESWNCFP'.includes(mainPart[i])) {
                    const zMap: Record<string, number> = { 'E':1,'S':2,'W':3,'N':4,'C':5,'F':6,'P':7 };
                    concealed.push(new Tile('z', zMap[mainPart[i]]));
                }
                i++;
            }
        }
    }

    if (contextPart) {
        const zMap: Record<string, number> = { 'E':1,'S':2,'W':3,'N':4 };
        quanfeng = zMap[contextPart[0]] || 1;
        menfeng = zMap[contextPart[1]] || 1;
        zimo = contextPart[2] === '1';
        juezhang = contextPart[3] === '1';
        haidi = contextPart[4] === '1';
        gang = contextPart[5] === '1';
    }

    if (huaPart) {
        if ('012345678'.includes(huaPart)) {
            huaCount = parseInt(huaPart);
        } else {
            huaCount = huaPart.length;
        }
    }

    const options: GameOptions = {
        quanfeng,
        menfeng,
        zimo,
        juezhang,
        lastTile: haidi,
        gangShang: gang && zimo,
        qiangGang: gang && !zimo,
        huaCount,
        showTingFans: false
    };

    return { concealed, melds, options };
}

const FAN_NAME_MAP: Record<string, string> = {
    "FAN_DASIXI": "大四喜", "FAN_DASANYUAN": "大三元", "FAN_LVYISE": "绿一色",
    "FAN_JIULIANBAODENG": "九莲宝灯", "FAN_SIGANG": "四杠", "FAN_LIANQIDUI": "连七对",
    "FAN_SHISANYAO": "十三幺", "FAN_QINGYAOJIU": "清幺九", "FAN_XIAOSIXI": "小四喜",
    "FAN_XIAOSANYUAN": "小三元", "FAN_ZIYISE": "字一色", "FAN_SIANKE": "四暗刻",
    "FAN_YISESHUANGLONGHUI": "一色双龙会", "FAN_YISESITONGSHUN": "一色四同顺",
    "FAN_YISESIJIEGAO": "一色四节高", "FAN_YISESIBUGAO": "一色四步高", "FAN_SANGANG": "三杠",
    "FAN_HUNYAOJIU": "混幺九", "FAN_QIDUI": "七对", "FAN_QIXINGBUKAO": "七星不靠",
    "FAN_QUANSHUANGKE": "全双刻", "FAN_QINGYISE": "清一色", "FAN_YISESANTONGSHUN": "一色三同顺",
    "FAN_YISESANJIEGAO": "一色三节高", "FAN_QUANDA": "全大", "FAN_QUANZHONG": "全中",
    "FAN_QUANXIAO": "全小", "FAN_QINGLONG": "清龙", "FAN_SANSESHUANGLONGHUI": "三色双龙会",
    "FAN_YISESANBUGAO": "一色三步高", "FAN_QUANDAIWU": "全带五", "FAN_SANTONGKE": "三同刻",
    "FAN_SANANKE": "三暗刻", "FAN_QUANBUKAO": "全不靠", "FAN_ZUHELONG": "组合龙",
    "FAN_DAYUWU": "大于五", "FAN_XIAOYUWU": "小于五", "FAN_SANFENGKE": "三风刻",
    "FAN_HUALONG": "花龙", "FAN_TUIBUDAO": "推不倒", "FAN_SANSESANTONGSHUN": "三色三同顺",
    "FAN_SANSESANJIEGAO": "三色三节高", "FAN_WUFANHU": "无番和", "FAN_MIAOSHOUHUICHUN": "妙手回春",
    "FAN_HAIDILAOYUE": "海底捞月", "FAN_GANGSHANGKAIHUA": "杠上开花", "FAN_QIANGGANGHU": "抢杠和",
    "FAN_PENGPENGHU": "碰碰和", "FAN_HUNYISE": "混一色", "FAN_SANSESANBUGAO": "三色三步高",
    "FAN_WUMENQI": "五门齐", "FAN_QUANQIUREN": "全求人", "FAN_SHUANGANGANG": "双暗杠",
    "FAN_SHUANGJIANKE": "双箭刻", "FAN_QUANDAIYAO": "全带幺", "FAN_BUQIUREN": "不求人",
    "FAN_SHUANGMINGGANG": "双明杠", "FAN_HUJUEZHANG": "和绝张", "FAN_JIANKE": "箭刻",
    "FAN_QUANFENGKE": "圈风刻", "FAN_MENFENGKE": "门风刻", "FAN_MENQIANQING": "门前清",
    "FAN_PINGHU": "平和", "FAN_SIGUIYI": "四归一", "FAN_SHUANGTONGKE": "双同刻",
    "FAN_SHUANGANKE": "双暗刻", "FAN_ANGANG": "暗杠", "FAN_DUANYAO": "断幺",
    "FAN_YIBANGAO": "一般高", "FAN_XIXIANGFENG": "喜相逢", "FAN_LIANLIU": "连六",
    "FAN_LAOSHAOFU": "老少副", "FAN_YAOJIUKE": "幺九刻", "FAN_MINGGANG": "明杠",
    "FAN_QUEYIMEN": "缺一门", "FAN_WUZI": "无字", "FAN_BIANZHANG": "边张",
    "FAN_KANZHANG": "坎张", "FAN_DANDIAOJIANG": "单钓将", "FAN_ZIMO": "自摸",
    "FAN_HUAPAI": "花牌", "FAN_MINGANGANG": "明暗杠"
};

function runTest(handStr: string, expectedFans: string[], altFans: string[] | null = null) {
    const { concealed, melds, options } = parseHand(handStr);
    const lastTile = concealed.length > 0 ? concealed[concealed.length - 1] : undefined;
    const resultObj = calculateAllBestScores(concealed, melds, options, lastTile);

    expect(resultObj, `Hand failed to Hu: ${handStr}`).not.toBeNull();
    const allResults = resultObj!.results;
    
    const mapped1 = expectedFans.map(f => FAN_NAME_MAP[f] || f);
    
    let pass = false;
    for (const res of allResults) {
        const actualFans = res.fans.map(f => f.name);
        if (mapped1.every(e => actualFans.includes(e))) {
            pass = true;
            break;
        }
        if (altFans) {
            const mapped2 = altFans.map(f => FAN_NAME_MAP[f] || f);
            if (mapped2.every(e => actualFans.includes(e))) {
                pass = true;
                break;
            }
        }
    }

    if (!pass) {
        const firstActual = allResults[0].fans.map(f => f.name);
        expect(firstActual, `Hand: ${handStr}\nNo combination matched expectations.\nFirst Actual: [${firstActual.join(', ')}]\nExpected: [${mapped1.join(', ')}]${altFans ? ' OR [' + altFans.map(f => FAN_NAME_MAP[f] || f).join(', ') + ']' : ''}`).toBeTruthy();
    }
}

function runTingTest(handStr: string, expectedTingTiles: number[]) {
    const { concealed, melds, options } = parseHand(handStr);
    const tingResult = getTingTiles(concealed, melds, options);
    
    const mappedExpected = expectedTingTiles.map(id => {
        if (id <= 9) return `${id}m`;
        if (id <= 18) return `${id - 9}s`;
        if (id <= 27) return `${id - 18}p`;
        return `${id - 27}z`;
    });

    const actualTing = tingResult.map(t => t.tile.toString());
    expect(actualTing.sort(), `Hand: ${handStr}`).toEqual(mappedExpected.sort());
}

describe('GB-Mahjong Reference Tests', () => {
    describe('Ting Checks', () => {
        test('Case 182', () => runTingTest("[CCCC][FFFF][PPPP][NNNN]E ", [28]));
        test('Case 183', () => runTingTest("19m19s19pESWNCFP ", [1, 19, 10, 9, 27, 18, 28, 29, 30, 31, 32, 33, 34]));
        test('Case 184', () => runTingTest("19m19s19pESWNNFP ", [32]));
        test('Case 185', () => runTingTest("22559m11sEESSPP ", [9]));
        test('Case 186', () => runTingTest("47m28s369pESWCFP ", [1, 14, 31]));
        test('Case 187', () => runTingTest("28m47s369pESWCFP ", [10, 5, 31]));
        test('Case 188', () => runTingTest("28m47s369pESWCCP ", []));
        test('Case 189', () => runTingTest("1112345678999s ", [10, 11, 12, 13, 14, 15, 16, 17, 18]));
        test('Case 190', () => runTingTest("[111s,1]2345678999s ", [10, 11, 13, 14, 16, 17]));
        test('Case 191', () => runTingTest("1112345689999s ", [16]));
        test('Case 192', () => runTingTest("1112346778999s ", [14, 16, 17]));
        test('Case 193', () => runTingTest("3344455566667m ", [2, 3, 4, 5, 7, 8]));
        test('Case 194', () => runTingTest("234m45s88899pEEE ", [12, 15]));
        test('Case 195', () => runTingTest("234m35s88899pEEE ", [13]));
        test('Case 196', () => runTingTest("234m345s8889pEEE ", [25, 27]));
        test('Case 197', () => runTingTest("234m345s6669pEEE ", [27]));
        test('Case 198', () => runTingTest("234m345s3399pEEE ", [21, 27]));
        test('Case 199', () => runTingTest("34444556789pPP ", [25, 34]));
        test('Case 200', () => runTingTest("23344445m888pWW ", [1, 30]));
        test('Case 201', () => runTingTest("234m345s333pEEEE ", []));
    });

    describe('Fan Checks', () => {
        test('Case 205', () => runTest("[EEE,2][SSSS,1]WWWNN55pN|EE1000", ["FAN_DASIXI", "FAN_HUNYISE", "FAN_SHUANGANKE", "FAN_MINGGANG", "FAN_ZIMO"]));
        test('Case 206', () => runTest("[EEE,2][SSSS,1]WWWNN555p|SN1000", ["FAN_XIAOSIXI", "FAN_HUNYISE", "FAN_PENGPENGHU", "FAN_QUANFENGKE", "FAN_SHUANGANKE", "FAN_MINGGANG", "FAN_ZIMO"]));
        test('Case 207', () => runTest("[EEE,2][SSS,1]WWW78m55p9m|NN1000", ["FAN_SANFENGKE", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 208', () => runTest("[EEE,2][SSS,1]WWW99m55p9m|NN1000", ["FAN_SANFENGKE", "FAN_PENGPENGHU", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 209', () => runTest("[PPP,2][FFF,3]CC66999sC|EE1000", ["FAN_DASANYUAN", "FAN_HUNYISE", "FAN_PENGPENGHU", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_ZIMO"]));
        test('Case 210', () => runTest("[PPP,2][FFF,3]345p666sCC|EE1000", ["FAN_XIAOSANYUAN", "FAN_QUEYIMEN", "FAN_DANDIAOJIANG", "FAN_ZIMO"]));
        test('Case 211', () => runTest("[PPP,2][FFF,3]3335p999s4p|EE1000", ["FAN_SHUANGJIANKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 212', () => runTest("[EEE,2][SSS,1][FFF,3]WWNNW|WW1000", ["FAN_XIAOSIXI", "FAN_ZIYISE", "FAN_QUANFENGKE", "FAN_MENFENGKE", "FAN_JIANKE", "FAN_ZIMO"]));
        test('Case 213', () => runTest("EESSWWNNPPFFCC|EE1000", ["FAN_ZIYISE", "FAN_QIDUI", "FAN_ZIMO"]));
        test('Case 214', () => runTest("[111m,2]111999p11991s|EE1000", ["FAN_QINGYAOJIU", "FAN_SANANKE", "FAN_SANTONGKE", "FAN_ZIMO"]));
        test('Case 215', () => runTest("[1111m,2][111p,3]999p11999s|EE1000", ["FAN_QINGYAOJIU", "FAN_SHUANGANKE", "FAN_MINGGANG", "FAN_ZIMO"]));
        test('Case 216', () => runTest("1199m119999p1991s|EE1000", ["FAN_QINGYAOJIU", "FAN_QIDUI", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 217', () => runTest("[NNN,3][999s,1][CCC,2]999m11p|ES1000", ["FAN_HUNYAOJIU", "FAN_WUMENQI", "FAN_SHUANGTONGKE", "FAN_JIANKE", "FAN_DANDIAOJIANG", "FAN_ZIMO"]));
        test('Case 218', () => runTest("99m11pSWWNNPPFFS|EE1000", ["FAN_HUNYAOJIU", "FAN_QIDUI", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 219', () => runTest("[123p,1][CCC,1]999m79998p|EE1000", ["FAN_QUANDAIYAO", "FAN_JIANKE", "FAN_QUEYIMEN", "FAN_LAOSHAOFU", "FAN_YAOJIUKE", "FAN_ZIMO"]));
        test('Case 220', () => runTest("44558m22p225566s8m|EE1000", ["FAN_QIDUI", "FAN_DUANYAO", "FAN_ZIMO"]));
        test('Case 221', () => runTest("[345m,1]22456p222567s", ["FAN_SANSESANBUGAO", "FAN_DUANYAO"]));
        test('Case 222', () => runTest("[EEE,2][SSS,1][CCCC]88m456s|ES1000", ["FAN_QUANFENGKE", "FAN_MENFENGKE", "FAN_JIANKE", "FAN_ANGANG", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 223', () => runTest("[WWW,2][NNNN,3][111p,2]99s55m9s|ES1000", ["FAN_PENGPENGHU", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_MINGGANG", "FAN_ZIMO"]));
        test('Case 224', () => runTest("[123s,1][333s,2]45678996s|EE1000", ["FAN_QINGYISE", "FAN_SIGUIYI", "FAN_LIANLIU", "FAN_ZIMO"]));
        test('Case 225', () => runTest("11224455668899p|EE1000", ["FAN_QINGYISE", "FAN_QIDUI", "FAN_ZIMO"]));
        test('Case 226', () => runTest("[CCC,2][789m,1]12345mNN6m|EE1000", ["FAN_HUNYISE", "FAN_QINGLONG", "FAN_JIANKE", "FAN_ZIMO"]));
        test('Case 227', () => runTest("1122559mNNCCCC9m|EE1000", ["FAN_HUNYISE", "FAN_QIDUI", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 228', () => runTest("12345789p55678m6p|EE1000", ["FAN_QINGLONG", "FAN_BUQIUREN", "FAN_PINGHU", "FAN_QUEYIMEN"]));
        test('Case 229', () => runTest("556699m22334455p", ["FAN_QIDUI", "FAN_QUEYIMEN", "FAN_WUZI"]));
        test('Case 230', () => runTest("[678m,1][444s,2][FFF,1]234pWW", ["FAN_WUMENQI", "FAN_JIANKE", "FAN_DANDIAOJIANG"]));
        test('Case 231', () => runTest("7788m44s3344pWWFF|EE1000", ["FAN_QIDUI", "FAN_WUMENQI", "FAN_ZIMO"]));
        test('Case 232', () => runTest("[FFF,2]147m258p39sWW6s", ["FAN_ZUHELONG", "FAN_WUMENQI", "FAN_JIANKE"]));
        test('Case 233', () => runTest("[789m,1][999s,2]7899p789s9p|EE1000", ["FAN_QUANDA", "FAN_SANSESANTONGSHUN", "FAN_QUANDAIYAO", "FAN_SIGUIYI", "FAN_YAOJIUKE", "FAN_ZIMO"]));
        test('Case 234', () => runTest("[444m,2][666m,3]444p44664s", ["FAN_QUANZHONG", "FAN_QUANSHUANGKE", "FAN_SANTONGKE"]));
        test('Case 235', () => runTest("11223333p33s1122m|EE1000", ["FAN_QUANXIAO", "FAN_QIDUI", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 236', () => runTest("[666m,2][777m,2][999m,2]78886m|EE0100", ["FAN_QINGYISE", "FAN_DAYUWU", "FAN_HUJUEZHANG", "FAN_SIGUIYI", "FAN_SIGUIYI", "FAN_YAOJIUKE"]));
        test('Case 237', () => runTest("[123p,3]23334p222444s|EE1000", ["FAN_XIAOYUWU", "FAN_TUIBUDAO", "FAN_SHUANGANKE", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 238', () => runTest("[345m,1]567m45556p345s", ["FAN_QUANDAIWU", "FAN_SANSESANBUGAO", "FAN_PINGHU", "FAN_XIXIANGFENG"]));
        test('Case 239', () => runTest("[444m,2][666m,3]22244s88p4s", ["FAN_QUANSHUANGKE", "FAN_SHUANGTONGKE"]));
        test('Case 240', () => runTest("[111s,3][222s,3][444s,2]333s22p", ["FAN_YISESIJIEGAO", "FAN_XIAOYUWU", "FAN_QUEYIMEN", "FAN_YAOJIUKE", "FAN_DANDIAOJIANG"]));
        test('Case 241', () => runTest("[666p,2]77888p678sWW7p", ["FAN_YISESANJIEGAO", "FAN_QUEYIMEN"]));
        test('Case 242', () => runTest("[444s,2]333m55pWWCCC5p|EE1000", ["FAN_SANANKE", "FAN_SANSESANJIEGAO", "FAN_WUMENQI", "FAN_PENGPENGHU", "FAN_JIANKE", "FAN_ZIMO"]));
        test('Case 243', () => runTest("[444s,2]333666m55pWW5p", ["FAN_SANSESANJIEGAO", "FAN_PENGPENGHU", "FAN_SHUANGANKE"]));
        test('Case 244', () => runTest("[1111m][1111p,2]11134445s|EE1000", ["FAN_SANTONGKE", "FAN_MINGANGANG", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_WUZI", "FAN_ZIMO"]));
        test('Case 245', () => runTest("[234m,1][555m,1]567m55566p", ["FAN_SHUANGTONGKE", "FAN_SIGUIYI", "FAN_DUANYAO", "FAN_QUEYIMEN", "FAN_LIANLIU"]));
        test('Case 246', () => runTest("[222m,1][555m,2]8m222555p8m", ["FAN_PENGPENGHU", "FAN_DUANYAO", "FAN_SHUANGTONGKE", "FAN_SHUANGTONGKE", "FAN_QUEYIMEN", "FAN_DANDIAOJIANG", "FAN_SHUANGANKE"]));
        test('Case 247', () => runTest("[456s,1][456s,1][456s,3]45s55m6s|EE1100", ["FAN_YISESITONGSHUN", "FAN_QUANZHONG", "FAN_QUANDAIWU", "FAN_HUJUEZHANG", "FAN_PINGHU", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 248', () => runTest("[234s,1]22333444sFF2s|EE1000", ["FAN_LVYISE", "FAN_YISESITONGSHUN", "FAN_ZIMO"]));
        test('Case 249', () => runTest("[456s,1][456s,1]456s77mCCC", ["FAN_YISESANTONGSHUN", "FAN_JIANKE", "FAN_QUEYIMEN"]));
        test('Case 250', () => runTest("[123m,1][345m,1]67789mCC5m|EE1000", ["FAN_YISESIBUGAO", "FAN_HUNYISE", "FAN_ZIMO"]));
        test('Case 251', () => runTest("[123p,1][234p,1]344556p99s|EE1000", ["FAN_YISESIBUGAO", "FAN_PINGHU", "FAN_QUEYIMEN", "FAN_DANDIAOJIANG", "FAN_ZIMO"]));
        test('Case 252', () => runTest("[123m,1][345m,1]567m34sCC5s|EE1000", ["FAN_YISESANBUGAO", "FAN_XIXIANGFENG", "FAN_QUEYIMEN", "FAN_ZIMO"]));
        test('Case 253', () => runTest("[234p,1]12334567pEE5p|EE1000", ["FAN_YISESANBUGAO", "FAN_HUNYISE", "FAN_LIANLIU", "FAN_ZIMO"]));
        test('Case 254', () => runTest("12345566789s22p4s|EE1000", ["FAN_QINGLONG", "FAN_BUQIUREN", "FAN_PINGHU", "FAN_YIBANGAO", "FAN_QUEYIMEN"]));
        test('Case 255', () => runTest("123456m456p11789s", ["FAN_HUALONG", "FAN_MENQIANQING", "FAN_PINGHU", "FAN_XIXIANGFENG"], ["FAN_HUALONG", "FAN_MENQIANQING", "FAN_PINGHU", "FAN_LIANLIU"]));
        test('Case 256', () => runTest("[234m,1]11234p233442s", ["FAN_XIAOYUWU", "FAN_SANSESANTONGSHUN", "FAN_PINGHU", "FAN_YIBANGAO"]));
        test('Case 257', () => runTest("[345m,1]55567m456p678s|EE1000", ["FAN_SANSESANBUGAO", "FAN_PINGHU", "FAN_DUANYAO", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 258', () => runTest("12355789m123456p", ["FAN_MENQIANQING", "FAN_PINGHU", "FAN_LAOSHAOFU", "FAN_LIANLIU", "FAN_XIXIANGFENG", "FAN_QUEYIMEN"]));
        test('Case 259', () => runTest("[123m,1][123p,1]123m12p44s3p", ["FAN_XIAOYUWU", "FAN_PINGHU", "FAN_YIBANGAO", "FAN_YIBANGAO", "FAN_XIXIANGFENG", "FAN_BIANZHANG"], ["FAN_XIAOYUWU", "FAN_PINGHU", "FAN_YIBANGAO", "FAN_XIXIANGFENG", "FAN_XIXIANGFENG", "FAN_BIANZHANG"]));
        test('Case 260', () => runTest("234567p34567888s", ["FAN_MENQIANQING", "FAN_PINGHU", "FAN_DUANYAO", "FAN_LIANLIU", "FAN_LIANLIU", "FAN_QUEYIMEN"]));
        test('Case 261', () => runTest("19m19p119sESWNPFC|EE1000", ["FAN_SHISANYAO", "FAN_ZIMO"]));
        test('Case 262', () => runTest("147m28p69sESWNPF3s|EE1000", ["FAN_QUANBUKAO", "FAN_ZIMO"]));
        test('Case 263', () => runTest("14m369p25sESWNPFC|EE1000", ["FAN_QIXINGBUKAO", "FAN_ZIMO"]));
        test('Case 264', () => runTest("369m147p25sSWNPF8s", ["FAN_QUANBUKAO", "FAN_ZUHELONG"]));
        test('Case 265', () => runTest("[234p,1]258m369p14788s", ["FAN_ZUHELONG", "FAN_PINGHU", "FAN_DANDIAOJIANG"]));
        test('Case 266', () => runTest("1111m99p99sWWNNPP", ["FAN_HUNYAOJIU", "FAN_QIDUI", "FAN_WUMENQI", "FAN_SIGUIYI"]));
        test('Case 267', () => runTest("[CCCC][FFFF]333p67pPP5p|EE1000", ["FAN_XIAOSANYUAN", "FAN_SANANKE", "FAN_HUNYISE", "FAN_SHUANGANGANG", "FAN_BUQIUREN"]));
        test('Case 268', () => runTest("[234m,1][345p,1][234s,1][CCCC,2]11m", ["FAN_QUANQIUREN", "FAN_JIANKE", "FAN_MINGGANG", "FAN_XIXIANGFENG"]));
        test('Case 269', () => runTest("[234s,2][666s,2]33888sFFF|EE1000", ["FAN_LVYISE", "FAN_SHUANGANKE", "FAN_JIANKE", "FAN_ZIMO"]));
        test('Case 270', () => runTest("22333344668888s", ["FAN_LVYISE", "FAN_QINGYISE", "FAN_QIDUI", "FAN_DUANYAO", "FAN_SIGUIYI", "FAN_SIGUIYI"]));
        test('Case 271', () => runTest("11123456789999m|EE1000", ["FAN_JIULIANBAODENG", "FAN_QINGLONG", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 272', () => runTest("11123456789992p", ["FAN_JIULIANBAODENG", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_LIANLIU"]));
        test('Case 273', () => runTest("22334556677884s", ["FAN_LIANQIDUI", "FAN_DUANYAO"]));
        test('Case 274', () => runTest("[123p,1]12355778998p|EE1000", ["FAN_YISESHUANGLONGHUI", "FAN_KANZHANG", "FAN_ZIMO"]));
        test('Case 275', () => runTest("[123m,1][789m,1][123p,1]89p55s7p|EE1000", ["FAN_SANSESHUANGLONGHUI", "FAN_BIANZHANG", "FAN_ZIMO"]));
        test('Case 276', () => runTest("[234p,1]123345p88999s", ["FAN_YISESANBUGAO", "FAN_TUIBUDAO", "FAN_YAOJIUKE", "FAN_WUZI"]));
        test('Case 277', () => runTest("223344558pPPPP8p|EE1000", ["FAN_QIDUI", "FAN_TUIBUDAO", "FAN_HUNYISE", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 278', () => runTest("[111m,1][123m,1]33455553m|EE1000", ["FAN_QINGYISE", "FAN_SIGUIYI", "FAN_SIGUIYI", "FAN_SIGUIYI", "FAN_YAOJIUKE", "FAN_ZIMO"]));
        test('Case 279', () => runTest("22448p55m88sPPPP8p|EE1000", ["FAN_QIDUI", "FAN_SIGUIYI", "FAN_ZIMO"]));
        test('Case 280', () => runTest("[123m,1][345m,1]678p56sWW7s", ["FAN_WUFANHU"]));
        test('Case 283', () => runTest("[CCCC][FFFF][PPPP][EEEE]NN|EE1011|8", ["FAN_DASANYUAN", "FAN_SIGANG", "FAN_ZIYISE", "FAN_SIANKE", "FAN_MIAOSHOUHUICHUN", "FAN_GANGSHANGKAIHUA", "FAN_QUANFENGKE", "FAN_MENFENGKE", "FAN_HUAPAI"]));
        test('Case 285', () => runTest("23422333444sFF2s|EE1000", ["FAN_LVYISE", "FAN_YISESITONGSHUN", "FAN_BUQIUREN"]));
        test('Case 286', () => runTest("23422333444562s|EE1000", ["FAN_QINGYISE", "FAN_BUQIUREN", "FAN_SIGUIYI", "FAN_SIGUIYI", "FAN_SIGUIYI", "FAN_SHUANGANKE", "FAN_DUANYAO"]));
        test('Case 288', () => runTest("234567p234567sEE", ["FAN_MENQIANQING", "FAN_XIXIANGFENG", "FAN_XIXIANGFENG", "FAN_LIANLIU", "FAN_QUEYIMEN", "FAN_DANDIAOJIANG"], ["FAN_MENQIANQING", "FAN_XIXIANGFENG", "FAN_LIANLIU", "FAN_LIANLIU", "FAN_QUEYIMEN", "FAN_DANDIAOJIANG"]));
        test('Case 290', () => runTest("258m23469p14788s3p", ["FAN_ZUHELONG", "FAN_MENQIANQING", "FAN_PINGHU"]));
        test('Case 291', () => runTest("258m13369p14788s2p", ["FAN_ZUHELONG", "FAN_MENQIANQING", "FAN_PINGHU", "FAN_KANZHANG"]));
        test('Case 293', () => runTest("[1111m][111p,3]999p11999s|EE1001", ["FAN_QINGYAOJIU", "FAN_SANANKE", "FAN_GANGSHANGKAIHUA", "FAN_ANGANG"]));
        test('Case 295', () => runTest("111999p11999s798p|EE0001", ["FAN_SANANKE", "FAN_QIANGGANGHU", "FAN_QUANDAIYAO", "FAN_MENQIANQING", "FAN_SIGUIYI", "FAN_SHUANGTONGKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN", "FAN_WUZI", "FAN_KANZHANG"]));
        test('Case 296', () => runTest("[111p,3]999p11999s798p|EE0001", ["FAN_QIANGGANGHU", "FAN_QUANDAIYAO", "FAN_SIGUIYI", "FAN_SHUANGTONGKE", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN", "FAN_WUZI", "FAN_KANZHANG"]));
        test('Case 297', () => runTest("[234m,1][555m,1]567m55576p|EE0101|3", ["FAN_QIANGGANGHU", "FAN_SIGUIYI", "FAN_DUANYAO", "FAN_XIXIANGFENG", "FAN_LIANLIU", "FAN_QUEYIMEN", "FAN_HUAPAI"]));
        test('Case 299', () => runTest("[123m,1][345m,1]567m34sCC5s|EE1110", ["FAN_YISESANBUGAO", "FAN_MIAOSHOUHUICHUN", "FAN_HUJUEZHANG", "FAN_XIXIANGFENG", "FAN_QUEYIMEN"]));
        test('Case 301', () => runTest("[123m,1][345m,1]567m34sCC5s|EE0110", ["FAN_YISESANBUGAO", "FAN_HAIDILAOYUE", "FAN_HUJUEZHANG", "FAN_XIXIANGFENG", "FAN_QUEYIMEN"]));
        test('Case 347', () => runTest("[NNN,3]77789m11888p7m|EE0000|", ["FAN_SIGUIYI", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN"]));
        test('Case 348', () => runTest("[NNN,3]78889m11888p8m|EE0000|", ["FAN_SIGUIYI", "FAN_SHUANGTONGKE", "FAN_SHUANGANKE", "FAN_YAOJIUKE", "FAN_QUEYIMEN"]));
        test('Case 349', () => runTest("1234444678m456p1m|NE1000|", ["FAN_BUQIUREN", "FAN_SIGUIYI", "FAN_QUEYIMEN", "FAN_WUZI"]));
        test('Case 351', () => runTest("[1111m][222s,1]78999s44p9s", ["FAN_SIGUIYI", "FAN_SHUANGANKE", "FAN_ANGANG", "FAN_YAOJIUKE", "FAN_YAOJIUKE", "FAN_WUZI"]));
        test('Case 353', () => runTest("[123p,3]55m12379s789p8s", ["FAN_SANSESHUANGLONGHUI", "FAN_KANZHANG"]));
        test('Case 355', () => runTest("[678s,3]147m369s25pSS8p", ["FAN_ZUHELONG"]));
    });
});
