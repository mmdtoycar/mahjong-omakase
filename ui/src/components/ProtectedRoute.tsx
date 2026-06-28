import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { fetchCurrentUser } from '../api'

interface ProtectedRouteProps {
  children: React.ReactElement
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('mahjong_token')
  const pendingCredential = sessionStorage.getItem('mahjong_google_credential')
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    fetchCurrentUser()
      .then((player) => {
        sessionStorage.setItem('mahjong_me', JSON.stringify(player))
        setAuthenticated(true)
      })
      .catch(() => {
        localStorage.removeItem('mahjong_token')
        sessionStorage.removeItem('mahjong_me')
        setAuthenticated(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="empty-state">
        <p>正在验证身份信息...</p>
      </div>
    )
  }

  // pendingAuth — Google 凭证已暂存但 Player 还没建。只放行 /profile (setup 表单),
  // 其它 protected 路由统一漏斗到 /profile, 而不是 /login.
  if (!token && pendingCredential) {
    return location.pathname === '/profile' ? children : <Navigate to="/profile" replace />
  }

  if (!token || !authenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
