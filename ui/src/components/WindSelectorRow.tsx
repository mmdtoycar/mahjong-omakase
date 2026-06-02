import React from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
}

const WIND_NAMES: Record<number, string> = { 1: '东', 2: '南', 3: '西', 4: '北' }

export const WindSelectorRow: React.FC<Props> = ({ label, value, onChange }) => (
  <div className="configs-row-section" style={{ gap: 4 }}>
    <span className="config-row-label">{label}:</span>
    {[1, 2, 3, 4].map((w) => (
      <button
        key={w}
        className={`compact-toggle-btn ${value === w ? 'active' : ''}`}
        onClick={() => onChange(w)}
      >
        {WIND_NAMES[w]}
      </button>
    ))}
  </div>
)
