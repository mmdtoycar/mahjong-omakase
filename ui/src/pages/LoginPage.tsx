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
  const handleGoogleResponse = async (response: any) => {
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
  }

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
      </div>
    </div>
  )
}
