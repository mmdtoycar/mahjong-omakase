import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchStats, fetchFanDiscoveries, claimPlayer } from '../api'

export default function ProfilePage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<any>(() => {
    const rawMe = sessionStorage.getItem('mahjong_me')
    return rawMe ? JSON.parse(rawMe) : null
  })

  const [stats, setStats] = useState<any | null>(null)
  const [discoveries, setDiscoveries] = useState<any[]>([])

  // 账号认领表单状态
  const [claimForm, setClaimForm] = useState({ userName: '', firstName: '', lastName: '' })
  const [claimError, setClaimError] = useState('')
  const [claimSuccess, setClaimSuccess] = useState('')
  const [claiming, setClaiming] = useState(false)

  // 异步获取数据
  useEffect(() => {
    if (!me) return

    // 1. 获取玩家个人战绩
    fetchStats()
      .then((data) => {
        const myStat = data.find((s: any) => s.playerId === me.id)
        if (myStat) setStats(myStat)
      })
      .catch(console.error)

    // 2. 获取玩家个人番型成就
    fetchFanDiscoveries()
      .then((data) => {
        const myDiscoveries = data.filter((fd: any) => fd.playerId === me.id)
        setDiscoveries(myDiscoveries)
      })
      .catch(console.error)
  }, [me])

  if (!me) {
    return (
      <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
        <p>尚未登录或身份信息已失效</p>
        <button onClick={() => navigate('/login')} className="btn-signup" style={{ marginTop: '20px' }}>
          前往登录
        </button>
      </div>
    )
  }

  const formattedDate = me.createdAt ? new Date(me.createdAt).toLocaleString('zh-CN') : '未知时间'
  const displayName = me.firstName ? `${me.firstName} ${me.lastName}`.trim() : me.userName

  // 提交老账号认领
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClaimError('')
    setClaimSuccess('')

    if (!claimForm.userName.trim() || !claimForm.firstName.trim() || !claimForm.lastName.trim()) {
      setClaimError('请填写老账号的所有必填字段')
      return
    }

    setClaiming(true)
    try {
      const mergedMe = await claimPlayer(
        claimForm.userName.trim(),
        claimForm.firstName.trim(),
        claimForm.lastName.trim()
      )
      // 更新本地会话
      sessionStorage.setItem('mahjong_me', JSON.stringify(mergedMe))
      setMe(mergedMe)
      setClaimSuccess('账号合并认领成功！您的战绩积分已完美同步继承。')
      setClaimForm({ userName: '', firstName: '', lastName: '' })

      // 通知 App 状态同步更新（右上角名字等信息）
      window.dispatchEvent(new Event('auth-change'))
    } catch (err: any) {
      setClaimError(err.message || '认领失败，请核对信息是否正确且未被占用')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px 20px',
        fontFamily: 'system-ui, sans-serif',
        gap: '24px',
        maxWidth: '550px',
        margin: '0 auto',
      }}
    >
      {/* 1. 个人资料主卡片 */}
      <div
        className="profile-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #eaeaea',
        }}
      >
        <div
          style={{
            padding: '30px 25px',
            background: '#218c74',
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '0.5px' }}>{displayName}</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
            @{me.userName}
          </p>
        </div>

        <div style={{ padding: '25px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <span style={{ fontSize: '14px', color: '#888' }}>绑定邮箱</span>
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>{me.email || '未绑定'}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <span style={{ fontSize: '14px', color: '#888' }}>注册时间</span>
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>{formattedDate}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: '#888' }}>老账号合并状态</span>
              <span
                style={{
                  fontSize: '13px',
                  color: me.merged ? '#218c74' : '#b58900',
                  fontWeight: 600,
                  background: me.merged ? 'rgba(33, 140, 116, 0.08)' : 'rgba(181, 137, 0, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {me.merged ? '已关联老账号' : '尚未关联老账号'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 个人战绩展示 */}
      <div
        className="profile-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          width: '100%',
          padding: '25px',
          border: '1px solid #eaeaea',
        }}
      >
        <h3
          style={{
            margin: '0 0 20px 0',
            fontSize: '18px',
            color: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          📊 个人战绩
        </h3>
        {stats && stats.gamesPlayed > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div
              style={{
                background: '#fcfcfc',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#218c74' }}>{stats.gamesPlayed}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>总局数</div>
            </div>
            <div
              style={{
                background: '#fcfcfc',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#218c74' }}>
                {stats.wins}{' '}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#666' }}>
                  ({((stats.wins / stats.gamesPlayed) * 100).toFixed(0)}%)
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>胜场 (胜率)</div>
            </div>
            <div
              style={{
                background: '#fcfcfc',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b58900' }}>
                {stats.totalRP > 0 ? `+${stats.totalRP.toFixed(1)}` : stats.totalRP.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>总积分 (RP)</div>
            </div>
            <div
              style={{
                background: '#fcfcfc',
                border: '1px solid #f0f0f0',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b58900' }}>
                {stats.avgScore > 0 ? `+${stats.avgScore.toFixed(0)}` : stats.avgScore.toFixed(0)}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>场均表现</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '14px' }}>
            新晋雀士，暂无本赛季对局统计数据。
          </div>
        )}
      </div>

      {/* 3. 个人番型成就展示 */}
      <div
        className="profile-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          width: '100%',
          padding: '25px',
          border: '1px solid #eaeaea',
        }}
      >
        <h3
          style={{
            margin: '0 0 20px 0',
            fontSize: '18px',
            color: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🏆 稀有番种成就
        </h3>
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
                  <div style={{ fontWeight: 700, color: '#218c74', fontSize: '15px' }}>🏅 {fd.fanName}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                    发现日期: {new Date(fd.discoveredAt).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#b58900',
                    background: 'rgba(181, 137, 0, 0.08)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
                  +{fd.bonusRp || 0} RP
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '14px' }}>
            暂未发现首和稀有番种成就。
          </div>
        )}
      </div>

      {/* 4. 认领关联老账号 */}
      {!me.merged && (
        <div
          className="profile-card"
          style={{
            background: 'rgba(181, 137, 0, 0.02)',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            width: '100%',
            padding: '25px',
            border: '1px dashed #d4a017',
          }}
        >
          <h3
            style={{
              margin: '0 0 10px 0',
              fontSize: '18px',
              color: '#b58900',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🔗 关联并合并老账号
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
            如有历史未绑定账号，在此输入信息即可一键合并（仅限一次且不可逆）。
          </p>

          <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', color: '#555', fontWeight: 600, marginBottom: '6px' }}
              >
                用户名
              </label>
              <input
                type="text"
                value={claimForm.userName}
                onChange={(e) => setClaimForm({ ...claimForm, userName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{ display: 'block', fontSize: '12px', color: '#555', fontWeight: 600, marginBottom: '6px' }}
                >
                  名
                </label>
                <input
                  type="text"
                  value={claimForm.firstName}
                  onChange={(e) => setClaimForm({ ...claimForm, firstName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{ display: 'block', fontSize: '12px', color: '#555', fontWeight: 600, marginBottom: '6px' }}
                >
                  姓
                </label>
                <input
                  type="text"
                  value={claimForm.lastName}
                  onChange={(e) => setClaimForm({ ...claimForm, lastName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
            {claimError && <p style={{ margin: 0, fontSize: '13px', color: '#d32f2f' }}>⚠️ {claimError}</p>}
            {claimSuccess && <p style={{ margin: 0, fontSize: '13px', color: '#218c74' }}>🎉 {claimSuccess}</p>}
            <button
              type="submit"
              disabled={claiming}
              style={{
                background: '#b58900',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: claiming ? 'not-allowed' : 'pointer',
              }}
            >
              {claiming ? '处理中...' : '提交认领'}
            </button>
          </form>
        </div>
      )}

      {/* 5. 全局操作返回按钮 */}
      <button
        onClick={() => navigate('/home')}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #ccc',
          background: '#ffffff',
          color: '#333',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#f9f9f9'
          e.currentTarget.style.borderColor = '#999'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#ffffff'
          e.currentTarget.style.borderColor = '#ccc'
        }}
      >
        返回首页
      </button>
    </div>
  )
}
