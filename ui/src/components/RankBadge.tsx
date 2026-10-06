import React, { useEffect, useState } from 'react'
import { TierKey, tierLabel } from '../types'
import { ladderPointsText, skillRatingText, tierScoreText } from '../utils/format'

interface Props {
  tier?: TierKey | null
  /** sm = list/scoreboard inline, md = card header, lg = profile/detail hero. */
  size?: 'sm' | 'md' | 'lg'
  /** When unranked, show "X/5" progress instead of empty. Pass `gamesNeeded` to enable. */
  gamesNeeded?: number
  /** Optional rating overlay shown beside the image (md/lg only). Unranked ratings render as "XXXX(?)". */
  rating?: number
  /** 段位战 stars (1-3), drawn under the emblem the way 雀魂 does. */
  stars?: number
  /** 段位战 points into the current star; shown instead of {@link rating} when given with {@link starCap}. */
  points?: number
  starCap?: number
  /** 斗战圣佛 Lv.1 and up: drawn under the emblem in place of stars, with {@link points} counted in 豆. */
  douLevel?: number
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
  stars,
  points,
  starCap,
  douLevel,
  userName,
  onClick,
  className,
}) => {
  const [imgFailed, setImgFailed] = useState(false)
  if (!tier) return null
  const isBot = !!userName && userName.toUpperCase() === 'BOT'
  const imageBase = TIER_TO_IMAGE[tier]
  const src = imageBase ? `/rank/tier/${imageBase}${size === 'sm' ? '_sm' : ''}.webp` : null
  // Reset failure state when src changes — otherwise a one-time load failure
  // would stick around for later tier/source changes in the same component instance.
  useEffect(() => {
    setImgFailed(false)
  }, [src])
  const label = tierLabel(tier)
  const isThrone = tier === 'LV4_THRONE'
  const showProgress = tier === 'UNRANKED' && typeof gamesNeeded === 'number' && gamesNeeded > 0
  const progressPlayed = typeof gamesNeeded === 'number' ? Math.max(0, 5 - gamesNeeded) : 0
  const ladder = points !== undefined && starCap ? ladderPointsText(points, starCap) : null
  const scoreText = ladder ?? (rating !== undefined ? rating.toFixed(0) : null)
  const isDou = isThrone && !!douLevel
  const score =
    scoreText && isDou ? (
      <>
        <span className="rank-badge-bean" />
        {scoreText}
      </>
    ) : (
      scoreText
    )
  // Hugs the emblem's lower-left edge; the bottom star lights first. 斗战圣佛 shows its 豆 there instead.
  const starRow = isDou ? (
    <span className="rank-badge-beans">
      <span className="rank-badge-bean" />×{Math.floor(points ?? 0)}
    </span>
  ) : stars && !isThrone ? (
    [1, 2, 3].map((i) => (
      <img
        key={i}
        src={i > stars ? '/rank/icon/star_empty.webp' : '/rank/icon/star.webp'}
        alt=""
        className={`rank-badge-star rank-badge-star-${i}`}
      />
    ))
  ) : null
  const name = isDou ? `${label} Lv.${douLevel}` : label

  // BOT: bots are always UNRANKED but show 🤖 instead of "新"/"X/5" — they don't earn tiers.
  if (isBot && size === 'sm') {
    return (
      <span className={`rank-badge rank-badge-unranked-sm rank-badge-bot ${className ?? ''}`} onClick={onClick}>
        🤖
      </span>
    )
  }
  if (isBot) {
    return (
      <div
        className={`rank-badge rank-badge-unranked rank-badge-bot rank-badge-${size} ${className ?? ''}`}
        onClick={onClick}
      >
        <div>🤖</div>
      </div>
    )
  }

  // Unranked + sm: render compact progress chip
  if (tier === 'UNRANKED' && size === 'sm') {
    return (
      <span className={`rank-badge rank-badge-unranked-sm ${className ?? ''}`} onClick={onClick}>
        {showProgress ? `${progressPlayed}/5` : <span className="rank-badge-new">新</span>}
      </span>
    )
  }

  // Unranked + md/lg: bigger progress card without image. 段位分 still shown, suffixed with (?)
  // because it isn't settled until RANKED_MIN_GAMES games are played.
  if (tier === 'UNRANKED') {
    return (
      <div className={`rank-badge rank-badge-unranked rank-badge-${size} ${className ?? ''}`} onClick={onClick}>
        <div>{showProgress ? `${progressPlayed}/5` : '未定段'}</div>
        {ladder ? (
          <span className="rank-badge-rating">{ladder}(?)</span>
        ) : (
          rating !== undefined && <span className="rank-badge-rating">{skillRatingText(rating, 'UNRANKED')}</span>
        )}
      </div>
    )
  }

  if (!src || imgFailed) {
    // Fallback: show tier label only when image fails to load
    return (
      <span
        className={`rank-badge rank-badge-${size}${isThrone ? ' rank-badge-throne' : ''} ${className ?? ''}`}
        onClick={onClick}
      >
        <span className="rank-badge-emblem">
          <span className="rank-badge-fallback">{label.slice(0, 1)}</span>
          {starRow}
        </span>
        {size !== 'sm' && (
          <span className="rank-badge-meta">
            <span className="rank-badge-name">{name}</span>
            {score && <span className="rank-badge-rating">{score}</span>}
          </span>
        )}
      </span>
    )
  }

  // Ranked: image + (optional throne halo)
  return (
    <span
      className={`rank-badge rank-badge-${size}${isThrone ? ' rank-badge-throne' : ''} ${className ?? ''}`}
      onClick={onClick}
    >
      <span className="rank-badge-emblem">
        <img src={src} alt={label} className="rank-badge-img" onError={() => setImgFailed(true)} />
        {starRow}
      </span>
      {size !== 'sm' && (
        <span className="rank-badge-meta">
          <span className="rank-badge-name">{name}</span>
          {score && <span className="rank-badge-rating">{score}</span>}
        </span>
      )}
    </span>
  )
}

/** 段位分 for a stats row, with the 豆 icon for 斗战圣佛. */
export const TierScore: React.FC<{ row: Parameters<typeof tierScoreText>[0] & { douLevel?: number | null } }> = ({
  row,
}) => (
  <>
    {row.douLevel ? <span className="rank-badge-bean" /> : null}
    {tierScoreText(row)}
  </>
)
