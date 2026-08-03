export const MOBILE_BREAKPOINT = 640

interface FontSizeTier {
  maxLen: number
  desktop: string
  mobile: string
}

function resolve(text: string, tiers: FontSizeTier[], fallback: { desktop: string; mobile: string }) {
  const len = text.length
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT
  for (const t of tiers) {
    if (len <= t.maxLen) return mobile ? t.mobile : t.desktop
  }
  return mobile ? fallback.mobile : fallback.desktop
}

/** CJK / 全角字符占两个字符宽 (1em), 拉丁字母只占约半个 (0.5em). */
const FULLWIDTH =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/

/**
 * 视觉宽度(以"半个字"为单位): 全角记 2, 大写字母记 1.4, 其他记 1.
 *
 * <p>text.length 会把 "小明同学" 和 "abcd" 当成一样长, 但前者实际宽一倍; 大写字母也明显比小写宽
 * (Helvetica 里 W 是 l 的 4 倍), 所以 "WalkingAFK" 这种混了 4 个大写的名字按 length 分档会溢出.
 */
function visualWidth(text: string) {
  let w = 0
  for (const ch of text) {
    if (FULLWIDTH.test(ch)) w += 2
    else if (ch >= 'A' && ch <= 'Z') w += 1.4
    else w += 1
  }
  return w
}

/**
 * 与 resolve 的区别: 按 visualWidth 分档, 且 mobile 由调用方传入(useIsMobile) 而不是现场读
 * window.innerWidth —— 后者不会触发重渲染, 旋转屏幕或缩放窗口跨过断点后字号会停在旧值.
 */
function resolveByWidth(
  text: string,
  mobile: boolean,
  tiers: FontSizeTier[],
  fallback: { desktop: string; mobile: string }
) {
  const width = visualWidth(text)
  for (const t of tiers) {
    if (width <= t.maxLen) return mobile ? t.mobile : t.desktop
  }
  return mobile ? fallback.mobile : fallback.desktop
}

export function statFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '2rem', mobile: '1.4rem' },
      { maxLen: 8, desktop: '2rem', mobile: '1.1rem' },
      { maxLen: 12, desktop: '1.5rem', mobile: '0.9rem' },
      { maxLen: 16, desktop: '1.2rem', mobile: '0.8rem' },
      { maxLen: 22, desktop: '0.9rem', mobile: '0.6rem' },
    ],
    { desktop: '0.75rem', mobile: '0.5rem' }
  )
}

export function nameFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '0.95rem', mobile: '1rem' },
      { maxLen: 8, desktop: '0.95rem', mobile: '0.8rem' },
      { maxLen: 12, desktop: '0.8rem', mobile: '0.75rem' },
      { maxLen: 16, desktop: '0.7rem', mobile: '0.6rem' },
    ],
    { desktop: '0.65rem', mobile: '0.45rem' }
  )
}

/**
 * 统计页表格里的玩家名 — 手机上名字只剩 66px 左右(段位徽章占掉一半列宽), 所以按 visualWidth
 * 分档(中文名按两倍宽算), 尽量让完整 ID 显示出来而不是被省略号截掉.
 * maxLen 的单位是"半个字": 8 = 4 个汉字 = 8 个字母. 桌面端列宽充裕, 档位放宽.
 */
export function tableNameFontSize(text: string, mobile: boolean) {
  return resolveByWidth(
    text,
    mobile,
    [
      { maxLen: 8, desktop: '0.95rem', mobile: '0.85rem' },
      { maxLen: 10, desktop: '0.95rem', mobile: '0.72rem' },
      { maxLen: 12, desktop: '0.85rem', mobile: '0.62rem' },
      { maxLen: 14, desktop: '0.8rem', mobile: '0.54rem' },
      { maxLen: 18, desktop: '0.7rem', mobile: '0.48rem' },
    ],
    { desktop: '0.65rem', mobile: '0.44rem' }
  )
}

export function cardFontSize(text: string) {
  return resolve(
    text,
    [
      { maxLen: 6, desktop: '1.05rem', mobile: '1rem' },
      { maxLen: 8, desktop: '1.05rem', mobile: '0.8rem' },
      { maxLen: 12, desktop: '0.85rem', mobile: '0.8rem' },
    ],
    { desktop: '0.75rem', mobile: '0.7rem' }
  )
}
