import { useEffect, useState } from 'react'
import { fetchActiveSeasons } from '../api'
import { Season, getSeasonLabel } from '../types'
import { parseError } from '../utils/format'

export interface ActiveSeasonsResult {
  seasons: Season[]
  loading: boolean
  error: string
}

/**
 * Fetches the active seasons list once on mount and labels each entry.
 * Used by Stats / FanTable / Dashboard pages — they all do the same fetch
 * with identical mounted-flag protection.
 */
export function useActiveSeasons(): ActiveSeasonsResult {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetchActiveSeasons()
      .then((data) => {
        if (!mounted) return
        const list = data
          .map((s) => ({
            year: s.year,
            month: s.month,
            label: getSeasonLabel(s.year, s.month),
          }))
          .sort((a, b) => b.year - a.year || b.month - a.month)
        setSeasons(list)
      })
      .catch((e: unknown) => {
        if (!mounted) return
        setError(parseError(e))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { seasons, loading, error }
}
