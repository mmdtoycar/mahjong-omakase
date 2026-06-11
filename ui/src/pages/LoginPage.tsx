import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithGoogle } from '../api'

declare global {
  interface Window {
    google: any
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [gisAvailable, setGisAvailable] = useState(true)

  const handleGoogleResponse = useCallback(
    async (response: any) => {
      setError(null)
      setLoading(true)
      try {
        const data = await loginWithGoogle(response.credential)
        localStorage.setItem('mahjong_token', data.token)
        sessionStorage.setItem('mahjong_me', JSON.stringify(data.player))
        window.dispatchEvent(new Event('auth-change'))
        navigate('/home', { replace: true })
      } catch (err: any) {
        setError(err.message || '登录验证失败，请重试')
      } finally {
        setLoading(false)
      }
    },
    [navigate]
  )

  const initGis = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set. Configure it at build time.')
      setGisAvailable(false)
      return
    }

    const runInit = () => {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        const btn = document.getElementById('google-signin-btn')
        if (btn) {
          window.google.accounts.id.renderButton(btn, {
            theme: 'outline',
            size: 'large',
            width: '280',
          })
        }
        window.google.accounts.id.prompt()
        setGisAvailable(true)
      } catch (err) {
        console.warn('Failed to initialize Google GIS SDK.', err)
        setGisAvailable(false)
      }
    }

    // GIS script is loaded async via index.html; poll up to 5s for it to be ready
    // before declaring failure, instead of failing on the first render tick.
    let attempts = 0
    const maxAttempts = 50
    const tick = () => {
      if (window.google?.accounts?.id) {
        runInit()
        return
      }
      if (++attempts >= maxAttempts) {
        setGisAvailable(false)
        return
      }
      window.setTimeout(tick, 100)
    }
    tick()
  }, [handleGoogleResponse])

  useEffect(() => {
    const token = localStorage.getItem('mahjong_token')
    if (token) {
      navigate('/home', { replace: true })
      return
    }
    initGis()
  }, [navigate, initGis])

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo-header.png" alt="Mahjong Omakase" className="login-logo" />
        <h2 className="login-title">Mahjong Omakase</h2>

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: '20px' }}>
            <span className="alert-icon">⚠</span>
            <span className="alert-body">{error}</span>
          </div>
        )}

        {!gisAvailable && (
          <div className="alert alert-warning" role="alert" style={{ marginBottom: '20px' }}>
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">无法加载 Google 登录</div>
              <div style={{ marginBottom: '8px' }}>请检查网络后重试。</div>
              <button
                type="button"
                onClick={initGis}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b',
                  background: '#fff',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            margin: '8px 0 0',
          }}
        >
          <div id="google-signin-btn"></div>
          {loading && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>正在登录中...</p>}
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-light)',
              margin: '4px 0 0',
              letterSpacing: '0.02em',
            }}
          >
            使用 Google 账户一键免密安全登录
          </p>
        </div>
      </div>
    </div>
  )
}
