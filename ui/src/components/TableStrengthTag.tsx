import React from 'react'

interface Props {
  /** "铳之间" / "狠之间" / "贪之间" / "狱之间" / "大圣之间" or null/undefined */
  table?: string | null
  size?: 'sm' | 'md'
  className?: string
}

// theme 皮肤按档位由低到高: chong→hen→tan→yu→dasheng, dasheng 最华丽(火焰).
const TABLE_META: Record<string, { emoji: string; theme: string }> = {
  铳之间: { emoji: '💥', theme: 'chong' },
  狠之间: { emoji: '🥊', theme: 'hen' },
  贪之间: { emoji: '🤑', theme: 'tan' },
  狱之间: { emoji: '🏴‍☠️', theme: 'yu' },
  大圣之间: { emoji: '🇨🇳', theme: 'dasheng' },
}

export const TableStrengthTag: React.FC<Props> = ({ table, size = 'sm', className }) => {
  if (!table) return null
  const meta = TABLE_META[table] ?? { emoji: '·', theme: 'hen' }
  return (
    <span className={`table-strength table-strength-${meta.theme} table-strength-${size} ${className ?? ''}`}>
      <span className="table-strength-emoji" aria-hidden>
        {meta.emoji}
      </span>
      <span>{table}</span>
    </span>
  )
}
