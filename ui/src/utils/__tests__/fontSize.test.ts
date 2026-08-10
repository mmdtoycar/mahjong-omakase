import { describe, it, expect } from 'vitest'
import { cardFontSize, nameFontSize, statFontSize, tableNameFontSize } from '../fontSize'

/**
 * These functions pick a font size from how wide the text draws, and the unit is easy to misread as
 * "number of characters". It is not: a Chinese character counts 2 and a capital 1.4, so a 12-character
 * user name — the registration maximum — can be anywhere from 12 to 24 units wide. That is why the
 * tier tables run past 12, and why trimming them "because names are capped at 12" would give Chinese
 * names a size that overflows the column.
 */
describe('visual width, not character count', () => {
  it('treats one CJK character as two latin ones', () => {
    // 四个汉字 = 8 units = 八个字母, so both land in the same tier.
    expect(tableNameFontSize('王小明白', true)).toBe(tableNameFontSize('abcdefgh', true))
  })

  it('drops a Chinese name a tier below a latin name of the same length', () => {
    // Six of each: 12 units against 6. Sizing by length would give them the same font.
    expect(tableNameFontSize('王小明白日月', true)).not.toBe(tableNameFontSize('abcdef', true))
  })

  it('counts capitals as wider than lowercase', () => {
    // 8 × 1.4 = 11.2 units, past the 10-unit tier that the lowercase form sits in.
    expect(tableNameFontSize('ABCDEFGH', true)).not.toBe(tableNameFontSize('abcdefgh', true))
  })

  it('reaches the widest tiers within the 12-character registration cap', () => {
    // Nine CJK characters is 18 units, twelve is 24 — both beyond the 12-unit tier.
    const nine = tableNameFontSize('一二三四五六七八九', true)
    const twelve = tableNameFontSize('一二三四五六七八九十百千', true)
    expect(nine).toBe('0.48rem')
    expect(twelve).toBe('0.44rem')
    expect(twelve).not.toBe(nine)
  })
})

describe('tiers per surface', () => {
  it('gives a table cell a smaller size than a card for the same name', () => {
    // The table cell shares its column with a 段位 badge; the card has the width to itself.
    expect(tableNameFontSize('abcdefgh', true)).not.toBe(cardFontSize('abcdefgh', true))
  })

  it('separates desktop from mobile', () => {
    expect(tableNameFontSize('abcdefghij', false)).toBe('0.95rem')
    expect(tableNameFontSize('abcdefghij', true)).toBe('0.72rem')
  })

  it('falls back rather than returning undefined for anything wider than every tier', () => {
    const wide = '一二三四五六七八九十百千万'
    expect(statFontSize(wide, true)).toBe('0.5rem')
    expect(nameFontSize(wide, true)).toBe('0.45rem')
    expect(cardFontSize(wide, true)).toBe('0.7rem')
    expect(tableNameFontSize(wide, true)).toBe('0.44rem')
  })

  it('sizes an empty string like the shortest name rather than crashing', () => {
    expect(tableNameFontSize('', true)).toBe('0.85rem')
  })
})

/**
 * The tiers are unchanged from when they were resolved by `text.length`, so a lowercase latin name —
 * where width and length are the same number — must come out at exactly the size it did before.
 */
describe('latin names keep the sizes they had', () => {
  it.each([
    ['abcdef', '1.4rem', '1rem', '1rem', '0.85rem'],
    ['abcdefgh', '1.1rem', '0.8rem', '0.8rem', '0.85rem'],
    ['abcdefghijkl', '0.9rem', '0.75rem', '0.8rem', '0.62rem'],
  ])('%s', (name, stat, nameSize, card, table) => {
    expect(statFontSize(name, true)).toBe(stat)
    expect(nameFontSize(name, true)).toBe(nameSize)
    expect(cardFontSize(name, true)).toBe(card)
    expect(tableNameFontSize(name, true)).toBe(table)
  })
})
