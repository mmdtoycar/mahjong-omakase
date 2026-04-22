import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPlayer, checkUserName } from '../api'

export default function SignUpPage() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [userNameAvailable, setUserNameAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [checkError, setCheckError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const trimmed = userName.trim()
    if (!trimmed) {
      setUserNameAvailable(null)
      setCheckError('')
      setChecking(false)
      return
    }
    let cancelled = false
    setChecking(true)
    setCheckError('')
    const timer = setTimeout(async () => {
      try {
        const available = await checkUserName(trimmed)
        if (cancelled) return
        setUserNameAvailable(available)
        setCheckError('')
      } catch {
        if (cancelled) return
        setUserNameAvailable(null)
        setCheckError('用户名检查失败，请重试')
      } finally {
        if (!cancelled) setChecking(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [userName])

  const canSubmit = userName.trim() && firstName.trim() && lastName.trim() && userNameAvailable === true && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await createPlayer(userName.trim(), firstName.trim(), lastName.trim())
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败')
      setSubmitting(false)
    }
  }

  return (
    <div className="signup-container">
      <div className="card signup-card">
        <p className="signup-title">Join Leo's friends' mahjong games!</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="选择一个唯一的用户名"
              maxLength={16}
              autoFocus
            />
            {userName.trim() && (
              <span className={`field-hint ${userNameAvailable === true ? 'hint-success' : userNameAvailable === false ? 'hint-error' : ''}`}>
                {checking ? '检查中...' : userNameAvailable === true ? '可用' : userNameAvailable === false ? '已被占用' : ''}
              </span>
            )}
            {checkError && <span className="field-hint hint-error">{checkError}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>名</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="名"
              />
            </div>
            <div className="form-group">
              <label>姓</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="姓"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary signup-btn"
            disabled={!canSubmit}
          >
            {submitting ? '注册中...' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
