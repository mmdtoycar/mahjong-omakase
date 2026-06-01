import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchCurrentUser } from '../api'

interface ProtectedRouteProps {
  children: React.ReactElement
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('mahjong_token')
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

  if (!token || !authenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}
