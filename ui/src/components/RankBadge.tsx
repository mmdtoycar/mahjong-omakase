import React, { useEffect, useState } from 'react'
import { TierKey, tierLabel } from '../types'

interface Props {
  tier?: TierKey | null
  /** sm = list/scoreboard inline, md = card header, lg = profile/detail hero. */
  size?: 'sm' | 'md' | 'lg'
  /** When unranked, show "X/5" progress instead of empty. Pass `gamesNeeded` to enable. */
  gamesNeeded?: number
  /** Optional rating overlay shown beside the image (md/lg only). Unranked ratings render as "XXXX(?)". */
  rating?: number
  /** Player userName — used to detect BOT and render 🤖 instead of UNRANKED placeholder. */
  userName?: string
  /** Click target — links to player detail / profile / etc. */
  onClick?: () => void
  className?: string
}

const TIER_TO_IMAGE: Record<TierKey, string | null> = {
  UNRANKED: null,
  LV1: 'lv1',
  LV2: 'lv2',
  LV3: 'lv3',
  LV4_THRONE: 'lv4',
}

export const RankBadge: React.FC<Props> = ({
  tier,
  size = 'sm',
  gamesNeeded,
  rating,
  userName,
  onClick,
  className,
}) => {
  const [imgFailed, setImgFailed] = useState(false)
  if (!tier) return null
  const isBot = !!userName && userName.toUpperCase() === 'BOT'
  const imageBase = TIER_TO_IMAGE[tier]
  // Always use _small.png — large versions are 3-6MB and tank performance.
  const src = imageBase ? `/rank/${imageBase}_small.png` : null
  // Reset failure state when src changes — otherwise a one-time load failure
  // would stick around for later tier/source changes in the same component instance.
  useEffect(() => {
    setImgFailed(false)
  }, [src])
  const label = tierLabel(tier)
  const isThrone = tier === 'LV4_THRONE'
  const showProgress = tier === 'UNRANKED' && typeof gamesNeeded === 'number' && gamesNeeded > 0
  const progressPlayed = typeof gamesNeeded === 'number' ? Math.max(0, 5 - gamesNeeded) : 0

  // BOT: bots are always UNRANKED but show 🤖 instead of "新"/"X/5" — they don't earn tiers.
  if (isBot && size === 'sm') {
    return (
      <span
        className={`rank-badge rank-badge-unranked-sm rank-badge-bot ${className ?? ''}`}
        title="机器人"
        onClick={onClick}
      >
        🤖
      </span>
    )
  }
  if (isBot) {
    return (
      <div
        className={`rank-badge rank-badge-unranked rank-badge-bot rank-badge-${size} ${className ?? ''}`}
        onClick={onClick}
        title="机器人"
      >
        <div className="rank-badge-progress">🤖</div>
      </div>
    )
  }

  // Unranked + sm: render compact progress chip
  if (tier === 'UNRANKED' && size === 'sm') {
    return (
      <span
        className={`rank-badge rank-badge-unranked-sm ${className ?? ''}`}
        title={showProgress ? `挑战中 ${progressPlayed}/5` : '未定段'}
        onClick={onClick}
      >
        {showProgress ? `${progressPlayed}/5` : <span className="rank-badge-new">新</span>}
      </span>
    )
  }

  // Unranked + md/lg: bigger progress card without image. 段位分 still shown, suffixed with (?)
  // because it isn't settled until RANKED_MIN_GAMES games are played.
  if (tier === 'UNRANKED') {
    return (
      <div className={`rank-badge rank-badge-unranked rank-badge-${size} ${className ?? ''}`} onClick={onClick}>
        <div className="rank-badge-progress">{showProgress ? `${progressPlayed}/5` : '未定段'}</div>
        {rating !== undefined && <span className="rank-badge-rating">{rating.toFixed(0)}(?)</span>}
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
        <span className="rank-badge-fallback">{label.slice(0, 1)}</span>
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
      <img src={src} alt={label} className="rank-badge-img" onError={() => setImgFailed(true)} />
      {size !== 'sm' && (
        <span className="rank-badge-meta">
          <span className="rank-badge-name">{label}</span>
          {rating !== undefined && <span className="rank-badge-rating">{rating.toFixed(0)}</span>}
        </span>
      )}
    </span>
  )
}
