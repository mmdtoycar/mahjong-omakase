import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const navigate = useNavigate()
  const rawMe = sessionStorage.getItem('mahjong_me')
  const me = rawMe ? JSON.parse(rawMe) : null

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        className="profile-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          width: '100%',
          maxWidth: '500px',
          overflow: 'hidden',
          border: '1px solid #eaeaea',
        }}
      >
        {/* 卡片头部彩色装饰栏 */}
        <div style={{ height: '80px', background: 'linear-gradient(135deg, #1d976c, #93f9b9)' }}></div>

        {/* 个人头像区 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-50px' }}>
          {me.pictureUrl ? (
            <img
              src={me.pictureUrl}
              alt={displayName}
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                border: '4px solid #ffffff',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: '#eee',
                border: '4px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
              }}
            >
              👤
            </div>
          )}
          <h2 style={{ margin: '15px 0 5px 0', fontSize: '22px', color: '#1a1a1a' }}>{displayName}</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>@{me.userName}</p>
        </div>

        {/* 详细资料展示列表 */}
        <div style={{ padding: '30px 25px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <span style={{ fontSize: '14px', color: '#888' }}>绑定邮箱 (Google Email)</span>
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
              <span style={{ fontSize: '14px', color: '#888' }}>系统唯一用户名 (Username)</span>
              <span style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>{me.userName}</span>
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingBottom: '12px',
              }}
            >
              <span style={{ fontSize: '14px', color: '#888' }}>系统临时 Access Token</span>
              <span
                style={{
                  fontSize: '12px',
                  color: '#0f730c',
                  background: '#f0f9f0',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  border: '1px solid #d4ecd4',
                }}
              >
                {me.token || '无会话Token'}
              </span>
            </div>
          </div>

          {/* 返回按钮 */}
          <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
            <button
              onClick={() => navigate('/home')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                background: '#ffffff',
                color: '#333',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
