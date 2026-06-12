import React, { useState } from 'react'
import { TierKey, tierLabel } from '../types'

interface Props {
  tier?: TierKey | null
  /** sm = 22px small in lists, md = 56px in cards, lg = 140px headers. */
  size?: 'sm' | 'md' | 'lg'
  /** When unranked, show "X/10" progress instead of empty. Pass `gamesNeeded` to enable. */
  gamesNeeded?: number
  /** Optional rating overlay shown beside the image (md/lg only). */
  rating?: number
  /** Click target — links to player detail / profile / etc. */
  onClick?: () => void
  className?: string
}

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 32, md: 56, lg: 140 }

const TIER_TO_IMAGE: Record<TierKey, string | null> = {
  UNRANKED: null,
  LV1: 'lv1',
  LV2: 'lv2',
  LV3: 'lv3',
  LV4_THRONE: 'lv4',
}

export const RankBadge: React.FC<Props> = ({ tier, size = 'sm', gamesNeeded, rating, onClick, className }) => {
  const [imgFailed, setImgFailed] = useState(false)
  if (!tier) return null
  const px = SIZE_PX[size]
  const imageBase = TIER_TO_IMAGE[tier]
  // Always use _small.png — large versions are 3-6MB and tank performance.
  const src = imageBase ? `/rank/${imageBase}_small.png` : null
  const label = tierLabel(tier)
  const isThrone = tier === 'LV4_THRONE'
  const showProgress = tier === 'UNRANKED' && typeof gamesNeeded === 'number' && gamesNeeded > 0
  const progressPlayed = typeof gamesNeeded === 'number' ? Math.max(0, 10 - gamesNeeded) : 0

  // Unranked + sm: render compact progress chip
  if (tier === 'UNRANKED' && size === 'sm') {
    return (
      <span
        className={`rank-badge rank-badge-unranked-sm ${className ?? ''}`}
        title={showProgress ? `挑战中 ${progressPlayed}/10` : '未定段'}
        onClick={onClick}
      >
        {showProgress ? `${progressPlayed}/10` : '·'}
      </span>
    )
  }

  // Unranked + md/lg: bigger progress card without image
  if (tier === 'UNRANKED') {
    return (
      <div
        className={`rank-badge rank-badge-unranked rank-badge-${size} ${className ?? ''}`}
        onClick={onClick}
        style={{ width: px, height: px }}
      >
        <div className="rank-badge-progress">{showProgress ? `${progressPlayed}/10` : '未定段'}</div>
      </div>
    )
  }

  if (!src || imgFailed) {
    // Fallback: show tier label only when image fails to load
    return (
      <span
        className={`rank-badge rank-badge-${size}${isThrone ? ' rank-badge-throne' : ''} ${className ?? ''}`}
        onClick={onClick}
        title={label}
      >
        <span className="rank-badge-fallback" style={{ width: px, height: px }}>
          {label.slice(0, 1)}
        </span>
        {size !== 'sm' && (
          <span className="rank-badge-meta">
            <span className="rank-badge-name">{label}</span>
            {rating !== undefined && <span className="rank-badge-rating">{rating.toFixed(0)}</span>}
          </span>
        )}
      </span>
    )
  }

  // Ranked: image + (optional throne halo)
  return (
    <span
      className={`rank-badge rank-badge-${size}${isThrone ? ' rank-badge-throne' : ''} ${className ?? ''}`}
      title={`${label}${rating !== undefined ? ` · ${rating.toFixed(0)}` : ''}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={label}
        className="rank-badge-img"
        style={{ width: px, height: px }}
        onError={() => setImgFailed(true)}
      />
      {size !== 'sm' && (
        <span className="rank-badge-meta">
          <span className="rank-badge-name">{label}</span>
          {rating !== undefined && <span className="rank-badge-rating">{rating.toFixed(0)}</span>}
        </span>
      )}
    </span>
  )
}
