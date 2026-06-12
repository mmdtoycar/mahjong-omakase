import React from 'react'

interface Props {
  /** "凤凰台" / "麒麟阁" / "太极殿" / "困龙阙" / "百雀林" or null/undefined */
  table?: string | null
  size?: 'sm' | 'md'
  className?: string
}

const TABLE_META: Record<string, { emoji: string; theme: string }> = {
  凤凰台: { emoji: '🔥', theme: 'phoenix' },
  麒麟阁: { emoji: '🦄', theme: 'qilin' },
  太极殿: { emoji: '☯️', theme: 'taiji' },
  困龙阙: { emoji: '🐉', theme: 'dragon' },
  百雀林: { emoji: '🐦', theme: 'sparrow' },
}

export const TableStrengthTag: React.FC<Props> = ({ table, size = 'sm', className }) => {
  if (!table) return null
  const meta = TABLE_META[table] ?? { emoji: '·', theme: 'taiji' }
  return (
    <span className={`table-strength table-strength-${meta.theme} table-strength-${size} ${className ?? ''}`}>
      <span className="table-strength-emoji" aria-hidden>
        {meta.emoji}
      </span>
      <span>{table}</span>
    </span>
  )
}
