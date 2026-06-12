import React from 'react'

interface Props {
  /** "凤凰台" / "麒麟阁" / "太极殿" / "困龙阙" / "百雀林" or null/undefined */
  table?: string | null
  size?: 'sm' | 'md'
  className?: string
}

const TABLE_THEME: Record<string, string> = {
  凤凰台: 'phoenix',
  麒麟阁: 'qilin',
  太极殿: 'taiji',
  困龙阙: 'dragon',
  百雀林: 'sparrow',
}

export const TableStrengthTag: React.FC<Props> = ({ table, size = 'sm', className }) => {
  if (!table) return null
  const theme = TABLE_THEME[table] ?? 'taiji'
  return (
    <span className={`table-strength table-strength-${theme} table-strength-${size} ${className ?? ''}`}>{table}</span>
  )
}
