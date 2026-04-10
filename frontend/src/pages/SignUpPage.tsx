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
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!userName.trim()) {
      setUserNameAvailable(null)
      return
    }
    setChecking(true)
    const timer = setTimeout(async () => {
      const available = await checkUserName(userName.trim())
      setUserNameAvailable(available)
      setChecking(false)
    }, 400)
    return () => clearTimeout(timer)
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
      setError(err instanceof Error ? err.message : 'Registration failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="signup-container">
      <div className="card signup-card">
        <h2>Sign Up</h2>
        <p className="signup-subtitle">Register to join mahjong games with your friends.</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="Choose a unique username"
              autoFocus
            />
            {userName.trim() && (
              <span className={`field-hint ${userNameAvailable === true ? 'hint-success' : userNameAvailable === false ? 'hint-error' : ''}`}>
                {checking ? 'Checking...' : userNameAvailable === true ? 'Available' : userNameAvailable === false ? 'Already taken' : ''}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary signup-btn"
            disabled={!canSubmit}
          >
            {submitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  )
}
