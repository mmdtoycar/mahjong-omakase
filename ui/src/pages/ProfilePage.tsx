import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStats, fetchFanDiscoveries, fetchPlayerTier, setupProfile, lookupClaimablePlayer } from '../api'
import { GAME_MODES, GameModeKey, PlayerStats, PlayerTierResponse } from '../types'
import { RankBadge } from '../components/RankBadge'

/** Kept in step with AuthController.MAX_USERNAME_LENGTH — the table layouts depend on it. */
const MAX_USERNAME_LENGTH = 12

export default function ProfilePage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(() => {
    const rawMe = sessionStorage.getItem('mahjong_me')
    return rawMe ? JSON.parse(rawMe) : null
  })

  const [statsByMode, setStatsByMode] = useState<Partial<Record<GameModeKey, PlayerStats>>>({})
  const [discoveries, setDiscoveries] = useState<any[]>([])
  const [selectedMode, setSelectedMode] = useState<GameModeKey>(GAME_MODES[0].key)
  const [tier, setTier] = useState<PlayerTierResponse | null>(null)

  // 账号设置(关联老账号 / 注册新账号)
  const [setupForm, setSetupForm] = useState({ userName: '', firstName: '', lastName: '' })
  const [setupError, setSetupError] = useState('')
  const [setupSuccess, setSetupSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 异步获取数据
  useEffect(() => {
    if (!me) return
    // pendingAuth 状态下 me 是从 Google profile 拼出来的占位对象, 没 id, 不能调任何
    // 用 me.id 的接口 (会 NPE 或 401), 等用户在本页提交 setup-profile 走完之后再拉数据
    if (me.pendingAuth || !me.id) return

    // 切账号时立即清掉上一个账号的 stale 数据, 避免短暂闪烁错的段位
    setStatsByMode({})
    setDiscoveries([])
    setTier(null)

    // 2. 番种成就(仅国标产生)
    fetchFanDiscoveries()
      .then((data) => {
        const myDiscoveries = data.filter((fd: any) => fd.playerId === me.id)
        setDiscoveries(myDiscoveries)
      })
      .catch(console.error)

    // 3. 段位 (国标 / 立直 / 东北)
    fetchPlayerTier(me.id)
      .then(setTier)
      .catch((e) => {
        console.error(e)
        setTier(null)
      })
  }, [me])

  // 个人战绩按需拉取: 只拉当前选中模式的, 切模式时再拉. 避免开页就触发 3 次重的 stats 请求.
  useEffect(() => {
    if (!me) return
    if (me.pendingAuth || !me.id) return
    if (statsByMode[selectedMode]) return
    fetchStats(selectedMode)
      .then((data) => {
        const myStat = data.find((s: any) => s.playerId === me.id)
        if (myStat) setStatsByMode((prev) => ({ ...prev, [selectedMode]: myStat }))
      })
      .catch(console.error)
  }, [me, selectedMode, statsByMode])

  if (!me) {
    return (
      <div className="empty-state">
        <p>尚未登录或身份信息已失效</p>
        <button onClick={() => navigate('/login')} className="btn-signup">
          前往登录
        </button>
      </div>
    )
  }

  const formattedDate = me.createdAt
    ? new Date(me.createdAt).toLocaleString('zh-CN', { timeZone: 'America/Los_Angeles' })
    : '未知时间'
  const displayName = me.firstName ? `${me.firstName} ${me.lastName}`.trim() : me.userName

  // 提交账号设置:先查后端有没有匹配的老账号,再用对应文案确认
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupError('')
    setSetupSuccess('')

    const userName = setupForm.userName.trim()
    const firstName = setupForm.firstName.trim()
    const lastName = setupForm.lastName.trim()

    if (!userName || !firstName || !lastName) {
      setSetupError('请填写所有必填字段')
      return
    }
    // The server enforces this too; checking here saves a round trip and says which field is wrong.
    if (userName.length > MAX_USERNAME_LENGTH) {
      setSetupError(`用户名最长 ${MAX_USERNAME_LENGTH} 个字符`)
      return
    }

    setSubmitting(true)
    try {
      const credential = sessionStorage.getItem('mahjong_google_credential')
      if (!credential) {
        setSetupError('Google 凭证已失效, 请重新登录')
        setSubmitting(false)
        return
      }

      const claimable = await lookupClaimablePlayer(userName, firstName, lastName)

      const confirmMsg = claimable
        ? `确认绑定老账号「${userName}」吗?\n\n该账号下的历史战绩将合并到您当前的 Google 身份。`
        : `确认使用「${userName}」作为新账号吗?\n\n系统将注册一个全新雀士档案并绑定您的 Google 身份。`

      if (!window.confirm(confirmMsg)) {
        setSubmitting(false)
        return
      }

      const result = await setupProfile(credential, userName, firstName, lastName)

      localStorage.setItem('mahjong_token', result.token)
      sessionStorage.setItem('mahjong_me', JSON.stringify(result.player))
      sessionStorage.removeItem('mahjong_google_credential')
      setMe(result.player)
      setSetupSuccess(claimable ? '绑定成功!历史战绩已同步继承。' : '注册成功!您的雀士档案已创建。')
      setSetupForm({ userName: '', firstName: '', lastName: '' })
      window.dispatchEvent(new Event('auth-change'))
    } catch (err: any) {
      setSetupError(err.message || '提交失败,请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="profile-page">
      {/* 1. 个人资料主卡片 */}
      <div className="profile-card profile-card-banner">
        <div className="profile-banner">
          <h2>{displayName}</h2>
          {me.merged && <p className="profile-banner-handle">@{me.userName}</p>}
        </div>

        <div className="profile-card-body">
          <div className="profile-info-list">
            <div className="profile-info-row">
              <span className="profile-info-label">绑定邮箱</span>
              <span className="profile-info-value">{me.email || '未绑定'}</span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-label">注册时间</span>
              <span className="profile-info-value">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 个人战绩(下拉切换模式) — 占位 me 时整块不渲染, 避免显示空 card */}
      {!me.pendingAuth &&
        me.id &&
        (() => {
          const stats = statsByMode[selectedMode]
          const hasStats = stats && stats.gamesPlayed > 0
          return (
            <div className="profile-card">
              <div className="profile-section-head">
                <h3>📊 个人战绩</h3>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as GameModeKey)}
                  className="select-inline"
                >
                  {GAME_MODES.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 段位显示: 跟随上面 selectedMode 切换 */}
              {tier && (
                <div className="profile-tier-section">
                  {(() => {
                    const info =
                      selectedMode === 'GUOBIAO' ? tier.guobiao : selectedMode === 'RIICHI' ? tier.riichi : tier.dongbei
                    return <RankBadge tier={info.tier} size="lg" rating={info.rating} gamesNeeded={info.gamesNeeded} />
                  })()}
                </div>
              )}

              {hasStats ? (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{stats.gamesPlayed}</div>
                    <div className="stat-label">总局数</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{stats.avgRank.toFixed(2)}</div>
                    <div className="stat-label">平均排名</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">
                      {stats.wins}
                      <span className="stat-value-pct">({((stats.wins / stats.gamesPlayed) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="stat-label">胜场</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state empty-state-compact">
                  <p>本模式暂无对局统计。</p>
                </div>
              )}

              {/* 番种成就只在国标模式下显示(其他模式没有番种系统) */}
              {selectedMode === 'GUOBIAO' && (
                <div className="profile-achievements">
                  <h4>🏆 番种成就</h4>
                  {discoveries.length > 0 ? (
                    <div className="profile-achievement-list">
                      {discoveries.map((fd, i) => (
                        <div key={i} className="profile-achievement-item">
                          <div>
                            <div className="profile-achievement-name">🏅 {fd.fanName}</div>
                            <div className="profile-achievement-date">
                              发现日期:{' '}
                              {new Date(fd.discoveredAt).toLocaleDateString([], { timeZone: 'America/Los_Angeles' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state empty-state-compact">
                      <p>暂未发现首和番种成就。</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

      {/* 4. 完善账号:关联老账号 / 注册新账号 */}
      {!me.merged && (
        <div className="profile-card profile-card-warning profile-claim-card">
          <h3>🎯 完善账号</h3>
          <div className="profile-claim-hint">
            <p>填写下方信息完成账号绑定。</p>
            <p>如果系统已存在匹配的历史账号, 将自动关联并继承战绩, 否则会注册一个全新雀士档案。</p>
          </div>

          <form onSubmit={handleSetupSubmit} className="profile-claim-form">
            <div>
              <label className="profile-field-label">用户名</label>
              <input
                type="text"
                className="profile-field-input"
                value={setupForm.userName}
                onChange={(e) => setSetupForm({ ...setupForm, userName: e.target.value })}
              />
            </div>
            <div className="claim-name-row">
              <div className="claim-name-col">
                <label className="profile-field-label">名</label>
                <input
                  type="text"
                  className="profile-field-input"
                  value={setupForm.firstName}
                  onChange={(e) => setSetupForm({ ...setupForm, firstName: e.target.value })}
                />
              </div>
              <div className="claim-name-col">
                <label className="profile-field-label">姓</label>
                <input
                  type="text"
                  className="profile-field-input"
                  value={setupForm.lastName}
                  onChange={(e) => setSetupForm({ ...setupForm, lastName: e.target.value })}
                />
              </div>
            </div>
            {setupError && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">⚠</span>
                <span className="alert-body">{setupError}</span>
              </div>
            )}
            {setupSuccess && (
              <div className="alert alert-success" role="status">
                <span className="alert-icon">🎉</span>
                <span className="alert-body">{setupSuccess}</span>
              </div>
            )}
            <button type="submit" className="profile-claim-submit" disabled={submitting}>
              {submitting ? '处理中...' : '确认提交'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
