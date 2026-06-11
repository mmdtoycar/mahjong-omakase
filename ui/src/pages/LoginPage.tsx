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
      return () => {}
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
    let cancelled = false
    let timeoutId: number | null = null
    let attempts = 0
    const maxAttempts = 50
    const tick = () => {
      if (cancelled) return
      if (window.google?.accounts?.id) {
        runInit()
        return
      }
      if (++attempts >= maxAttempts) {
        setGisAvailable(false)
        return
      }
      timeoutId = window.setTimeout(tick, 100)
    }
    tick()

    // Cleanup: stop polling and ignore any in-flight setTimeout if the component unmounts
    // (or the effect re-runs) before the SDK is ready.
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [handleGoogleResponse])

  useEffect(() => {
    const token = localStorage.getItem('mahjong_token')
    if (token) {
      navigate('/home', { replace: true })
      return
    }
    return initGis()
  }, [navigate, initGis])

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo-header.png" alt="Mahjong Omakase" className="login-logo" />
        <h2 className="login-title">Mahjong Omakase</h2>

        {error && (
          <div className="alert alert-error login-alert-spaced" role="alert">
            <span className="alert-icon">⚠</span>
            <span className="alert-body">{error}</span>
          </div>
        )}

        {!gisAvailable && (
          <div className="alert alert-warning login-alert-spaced" role="alert">
            <span className="alert-icon">⚠</span>
            <div className="alert-body">
              <div className="alert-title">无法加载 Google 登录</div>
              <div style={{ marginBottom: '8px' }}>请检查网络后重试。</div>
              <button type="button" onClick={initGis} className="alert-retry-btn">
                重试
              </button>
            </div>
          </div>
        )}

        <div className="login-signin-area">
          <div id="google-signin-btn"></div>
          {loading && <p className="login-loading-text">正在登录中...</p>}
          <p className="login-helper-text">使用 Google 账户一键免密安全登录</p>
        </div>
      </div>
    </div>
  )
}
