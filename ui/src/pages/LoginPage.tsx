import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithGoogle } from '../api'

declare global {
  interface Window {
    google: any
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mockEmail, setMockEmail] = useState('dietpepsi@gmail.com')

  useEffect(() => {
    const token = localStorage.getItem('mahjong_token')
    if (token) {
      navigate('/home', { replace: true })
      return
    }

    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: '471645797225-qtqf1nlv8l807tblfhpa9d36p5q456l3.apps.googleusercontent.com',
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        window.google.accounts.id.renderButton(document.getElementById('google-signin-btn'), {
          theme: 'outline',
          size: 'large',
          width: '280',
        })

        window.google.accounts.id.prompt()
      }
    } catch (err) {
      console.warn('Failed to initialize Google GIS SDK.', err)
    }
  }, [navigate])

  const handleGoogleResponse = async (response: any) => {
    setError(null)
    setLoading(true)
    try {
      const data = await loginWithGoogle(response.credential)
      localStorage.setItem('mahjong_token', data.token)
      sessionStorage.setItem('mahjong_me', JSON.stringify(data.player))
      navigate('/home', { replace: true })
    } catch (err: any) {
      setError(err.message || '登录验证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleMockLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mockEmail.includes('@') || !mockEmail.endsWith('.com')) {
      setError('请输入有效的电子邮箱')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const data = await loginWithGoogle(`dev_${mockEmail.trim()}`)
      localStorage.setItem('mahjong_token', data.token)
      sessionStorage.setItem('mahjong_me', JSON.stringify(data.player))
      navigate('/home', { replace: true })
    } catch (err: any) {
      setError(err.message || '模拟登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="login-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        className="login-card"
        style={{
          background: '#ffffff',
          padding: '40px 30px',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          border: '1px solid #eaeaea',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '10px' }}>🀄</div>
        <h2 style={{ margin: '0 0 10px 0', color: '#1a1a1a', fontSize: '24px' }}>Mahjong Omakase</h2>
        <p style={{ margin: '0 0 30px 0', color: '#666', fontSize: '14px' }}>熟人专属的多人联机麻将记分及对战平台</p>

        {error && (
          <div
            style={{
              background: '#ffebeb',
              color: '#d32f2f',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            margin: '20px 0',
          }}
        >
          <div id="google-signin-btn"></div>
          <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>推荐使用 Google 账户一键免密安全登录</p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '30px 0',
            color: '#ccc',
          }}
        >
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #eee' }} />
          <span style={{ padding: '0 15px', fontSize: '12px', color: '#999' }}>或 离线调试模式</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #eee' }} />
        </div>

        <form onSubmit={handleMockLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '15px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#666',
                fontWeight: 600,
                marginBottom: '6px',
              }}
            >
              本地调试邮箱 (自动注册/绑定已有账号)
            </label>
            <input
              type="email"
              value={mockEmail}
              onChange={(e) => setMockEmail(e.target.value)}
              placeholder="例如 dietpepsi@gmail.com"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: '#0f730c',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 12px rgba(15,115,12,0.2)',
            }}
          >
            {loading ? '正在登录...' : '离线一键登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
