import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStats, fetchFanDiscoveries, fetchPlayerTier, setupProfile, lookupClaimablePlayer } from '../api'
import { GAME_MODES, GameModeKey, PlayerStats, PlayerTierResponse } from '../types'
import { RankBadge } from '../components/RankBadge'

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

    // 切账号时立即清掉上一个账号的 stale 数据, 避免短暂闪烁错的段位
    setStatsByMode({})
    setDiscoveries([])
    setTier(null)

    // 1. 各模式战绩并行拉取
    GAME_MODES.forEach((mode) => {
      fetchStats(mode.key)
        .then((data) => {
          const myStat = data.find((s: any) => s.playerId === me.id)
          if (myStat) setStatsByMode((prev) => ({ ...prev, [mode.key]: myStat }))
        })
        .catch(console.error)
    })

    // 2. 稀有番种成就(仅国标产生)
    fetchFanDiscoveries()
      .then((data) => {
        const myDiscoveries = data.filter((fd: any) => fd.playerId === me.id)
        setDiscoveries(myDiscoveries)
      })
      .catch(console.error)

    // 3. 段位 (国标 + 立直)
    fetchPlayerTier(me.id)
      .then(setTier)
      .catch((e) => {
        console.error(e)
        setTier(null)
      })
  }, [me])

  if (!me) {
    return (
      <div className="empty-state">
        <p>尚未登录或身份信息已失效</p>
        <button onClick={() => navigate('/login')} className="btn-signup" style={{ marginTop: '20px' }}>
          前往登录
        </button>
      </div>
    )
  }

  const formattedDate = me.createdAt ? new Date(me.createdAt).toLocaleString('zh-CN') : '未知时间'
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

    setSubmitting(true)
    try {
      const claimable = await lookupClaimablePlayer(userName, firstName, lastName)

      const confirmMsg = claimable
        ? `确认绑定老账号「${userName}」吗?\n\n该账号下的历史战绩与积分将合并到您当前的 Google 身份。`
        : `确认使用「${userName}」作为新账号吗?\n\n系统将注册一个全新雀士档案并绑定您的 Google 身份。`

      if (!window.confirm(confirmMsg)) {
        setSubmitting(false)
        return
      }

      let mergedMe: any
      mergedMe = await setupProfile(userName, firstName, lastName)

      sessionStorage.setItem('mahjong_me', JSON.stringify(mergedMe))
      setMe(mergedMe)
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px 20px',
        gap: '24px',
        maxWidth: '550px',
        margin: '0 auto',
      }}
    >
      {/* 1. 个人资料主卡片 */}
      <div className="profile-card profile-card-banner">
        <div
          style={{
            padding: '30px 25px',
            background: 'var(--mj-teal)',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '0.5px' }}>{displayName}</h2>
          {me.merged && (
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
              @{me.userName}
            </p>
          )}
        </div>

        <div style={{ padding: '25px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

      {/* 2. 个人战绩(下拉切换模式) */}
      {(() => {
        const stats = statsByMode[selectedMode]
        const hasStats = stats && stats.gamesPlayed > 0
        return (
          <div className="profile-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                📊 个人战绩
              </h3>
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

            {/* 段位显示: 国标 / 立直 跟随上面 selectedMode 切换 */}
            {tier && (selectedMode === 'GUOBIAO' || selectedMode === 'RIICHI') && (
              <div className="profile-tier-section">
                <RankBadge
                  tier={selectedMode === 'GUOBIAO' ? tier.guobiao.tier : tier.riichi.tier}
                  size="md"
                  rating={
                    (selectedMode === 'GUOBIAO' ? tier.guobiao.tier : tier.riichi.tier) === 'UNRANKED'
                      ? undefined
                      : selectedMode === 'GUOBIAO'
                      ? tier.guobiao.rating
                      : tier.riichi.rating
                  }
                  gamesNeeded={selectedMode === 'GUOBIAO' ? tier.guobiao.gamesNeeded : tier.riichi.gamesNeeded}
                />
              </div>
            )}

            {hasStats ? (
              <div className="profile-stats-grid">
                <div className="profile-stat-card">
                  <div className="profile-stat-value profile-stat-value-teal">{stats.gamesPlayed}</div>
                  <div className="profile-stat-label">总局数</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value profile-stat-value-teal">
                    {stats.wins}{' '}
                    <span className="profile-stat-suffix">
                      ({((stats.wins / stats.gamesPlayed) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="profile-stat-label">胜场 (胜率)</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value profile-stat-value-gold">
                    {stats.totalRP > 0 ? `+${stats.totalRP.toFixed(1)}` : stats.totalRP.toFixed(1)}
                  </div>
                  <div className="profile-stat-label">总积分 (RP)</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value profile-stat-value-gold">
                    {stats.avgScore > 0 ? `+${stats.avgScore.toFixed(0)}` : stats.avgScore.toFixed(0)}
                  </div>
                  <div className="profile-stat-label">场均表现</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value profile-stat-value-teal">{stats.avgRank.toFixed(2)}</div>
                  <div className="profile-stat-label">平均排名</div>
                </div>
              </div>
            ) : (
              <div className="empty-state empty-state-compact">
                <p>本模式暂无对局统计。</p>
              </div>
            )}

            {selectedMode === 'RIICHI' && hasStats && stats.roundsPlayed > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-muted)' }}>
                <h4
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '15px',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  📈 数据统计
                </h4>
                <div className="profile-stats-grid">
                  <div className="profile-stat-card">
                    <div className="profile-stat-value profile-stat-value-teal">
                      {((stats.handWins / stats.roundsPlayed) * 100).toFixed(1)}%
                    </div>
                    <div className="profile-stat-label">和牌率</div>
                  </div>
                  <div className="profile-stat-card">
                    <div className="profile-stat-value profile-stat-value-teal">
                      {((stats.dealIns / stats.roundsPlayed) * 100).toFixed(1)}%
                    </div>
                    <div className="profile-stat-label">放铳率</div>
                  </div>
                  <div className="profile-stat-card">
                    <div className="profile-stat-value profile-stat-value-gold">
                      {stats.handWins > 0 ? Math.round(stats.avgWinPoints).toLocaleString() : '-'}
                    </div>
                    <div className="profile-stat-label">平均打点</div>
                  </div>
                  <div className="profile-stat-card">
                    <div className="profile-stat-value profile-stat-value-gold">
                      {stats.dealIns > 0 ? Math.round(stats.avgDealInPoints).toLocaleString() : '-'}
                    </div>
                    <div className="profile-stat-label">平均铳点</div>
                  </div>
                </div>
              </div>
            )}

            {/* 稀有番种成就只在国标模式下显示(其他模式没有番种系统) */}
            {selectedMode === 'GUOBIAO' && (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-muted)' }}>
                <h4
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '15px',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🏆 稀有番种成就
                </h4>
                {discoveries.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {discoveries.map((fd, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'linear-gradient(135deg, rgba(33, 140, 116, 0.02), rgba(181, 137, 0, 0.02))',
                          border: '1px solid #eef7f4',
                          borderRadius: '10px',
                          padding: '12px 16px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--mj-teal)', fontSize: '15px' }}>
                            🏅 {fd.fanName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                            发现日期: {new Date(fd.discoveredAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className="profile-status-pill profile-status-pill-warning">+{fd.bonusRp || 0} RP</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state empty-state-compact">
                    <p>暂未发现首和稀有番种成就。</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* 4. 完善账号:关联老账号 / 注册新账号 */}
      {!me.merged && (
        <div className="profile-card profile-card-warning">
          <h3
            style={{
              margin: '0 0 10px 0',
              fontSize: '18px',
              color: 'var(--mj-gold)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🎯 完善账号
          </h3>
          <div style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>填写下方信息完成账号绑定。</p>
            <p style={{ margin: 0 }}>
              如果系统已存在匹配的历史账号, 将自动关联并继承战绩, 否则会注册一个全新雀士档案。
            </p>
          </div>

          <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                用户名
              </label>
              <input
                type="text"
                value={setupForm.userName}
                onChange={(e) => setSetupForm({ ...setupForm, userName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-muted)',
                  fontSize: '14px',
                }}
              />
            </div>
            <div className="claim-name-row">
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  名
                </label>
                <input
                  type="text"
                  value={setupForm.firstName}
                  onChange={(e) => setSetupForm({ ...setupForm, firstName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-muted)',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  姓
                </label>
                <input
                  type="text"
                  value={setupForm.lastName}
                  onChange={(e) => setSetupForm({ ...setupForm, lastName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-muted)',
                    fontSize: '14px',
                  }}
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
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: 'var(--mj-gold)',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '处理中...' : '确认提交'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
