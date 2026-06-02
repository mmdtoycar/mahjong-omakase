import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveGameSnapshot, LivePlayer } from '../types'
import MahjongTile from '../components/MahjongTile'
import { MSG } from '../constants'

export default function LiveGamePage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<LiveGameSnapshot | null>(null)
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null)
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const token = localStorage.getItem('mahjong_token')

  const connectWebSocket = () => {
    if (!token) {
      setErrorMsg('请先登录以进入联机对局')
      navigate('/login')
      return
    }

    setWsStatus('CONNECTING')
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const wsUrl = `${protocol}://${host}/ws-mahjong?token=${token}`

    const ws = new WebSocket(wsUrl)
    socketRef.current = ws

    ws.onopen = () => {
      setWsStatus('CONNECTED')
      setErrorMsg(null)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.error) {
          setErrorMsg(data.error)
          setTimeout(() => setErrorMsg(null), 4000)
        } else {
          setSnapshot(data)
        }
      } catch (err) {
        console.error('Failed to parse socket message:', err)
      }
    }

    ws.onclose = () => {
      setWsStatus('DISCONNECTED')
      // Auto reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket()
      }, 2000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket encountered error:', err)
      ws.close()
    }
  }

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (socketRef.current) {
        socketRef.current.onclose = null // disable reconnect on unmount
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  const sendAction = (action: string, payload: Record<string, any> = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...payload }))
    } else {
      setErrorMsg('网络连接未就绪')
    }
  }

  const handleTileClick = (index: number) => {
    if (selectedTileIndex === index) {
      // Second click: Discard the tile!
      const myPos = snapshot?.myPosition ?? -1
      if (myPos !== snapshot?.activeTurn) {
        setErrorMsg('当前不是您的出牌回合')
        setTimeout(() => setErrorMsg(null), 3000)
        return
      }
      const myPlayer = snapshot?.players.find((p) => p.position === myPos)
      const tile = myPlayer?.hand?.[index]
      if (tile) {
        sendAction('DISCARD', { tile })
        setSelectedTileIndex(null)
      }
    } else {
      setSelectedTileIndex(index)
    }
  }

  const handleDraw = () => {
    sendAction('DRAW')
  }

  const handleReset = () => {
    sendAction('RESET')
    setSelectedTileIndex(null)
  }

  const handleJoinSeat = (pos: number) => {
    sendAction('JOIN', { position: pos })
    setSelectedTileIndex(null)
  }

  if (wsStatus === 'CONNECTING' && !snapshot) {
    return (
      <div className="empty-state">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: 16 }}>正在连接实时麻将对局服务器...</p>
      </div>
    )
  }

  if (wsStatus === 'DISCONNECTED' && !snapshot) {
    return (
      <div className="empty-state">
        <p className="danger-text">与服务器连接断开，正在尝试自动重连...</p>
      </div>
    )
  }

  if (!snapshot) return null

  const myPosition = snapshot.myPosition >= 0 ? snapshot.myPosition : 0

  // Seating perspective rotation: Bottom is always Me (myPosition)
  // Left: (myPosition + 3) % 4, Top: (myPosition + 2) % 4, Right: (myPosition + 1) % 4
  const seatPositions = [
    { label: '南 (自己)', index: myPosition, cssClass: 'seat-bottom' },
    { label: '东 (右家)', index: (myPosition + 1) % 4, cssClass: 'seat-right' },
    { label: '北 (对家)', index: (myPosition + 2) % 4, cssClass: 'seat-top' },
    { label: '西 (左家)', index: (myPosition + 3) % 4, cssClass: 'seat-left' },
  ]

  const getPositionWind = (pos: number) => {
    const winds = ['東', '南', '西', '北']
    return winds[pos] || '?'
  }

  const getPlayerBySeatIndex = (index: number): LivePlayer | undefined => {
    return snapshot.players.find((p) => p.position === index)
  }

  return (
    <div className="live-game-container">
      {errorMsg && <div className="error-banner floating-banner">{errorMsg}</div>}

      <div className="flex-between live-game-controls" style={{ marginBottom: 16 }}>
        <div className="game-status-badge">
          <span className={`status-dot ${wsStatus === 'CONNECTED' ? 'online' : 'offline'}`}></span>
          <span className="status-text">{wsStatus === 'CONNECTED' ? '实时联机中' : '网络重连中'}</span>
          <span className="wall-indicator">🀫 牌山剩余: {snapshot.wallCount} 张</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-small" onClick={handleReset}>
            🔄 重置对局
          </button>
          <button
            className="btn btn-primary btn-small"
            onClick={handleDraw}
            disabled={myPosition !== snapshot.activeTurn}
          >
            🀄 手动摸牌
          </button>
        </div>
      </div>

      {/* 2D Ring Tabletop felt board */}
      <div className="mahjong-table-felt">
        {/* Center Wind/Turn Dashboard Indicator */}
        <div className="mahjong-center-console">
          <div className="console-wind-box">
            <span className="console-wind-current">{getPositionWind(snapshot.activeTurn)}</span>
            <span className="console-wind-sub">轮次</span>
          </div>
          <div className="console-timer">
            <span className="timer-num">15</span>
            <span className="timer-sec">s</span>
          </div>
        </div>

        {/* 4 Seated Players surrounding the table */}
        {seatPositions.map((seat) => {
          const player = getPlayerBySeatIndex(seat.index)
          const isActive = snapshot.activeTurn === seat.index
          const isMe = seat.index === myPosition

          return (
            <div key={seat.index} className={`player-seat ${seat.cssClass} ${isActive ? 'active-turn' : ''}`}>
              {/* Seat Header / Seating capsule */}
              <div className="seat-capsule">
                <span className="seat-wind-badge">{getPositionWind(seat.index)}</span>
                <span className="seat-name">{player?.id ? player.displayName : '等待加入...'}</span>
                {!player?.id && (
                  <button className="seat-join-btn" onClick={() => handleJoinSeat(seat.index)}>
                    入座
                  </button>
                )}
              </div>

              {/* Hand display for each player position */}
              <div className="seat-hand-display">
                {player?.id && (
                  <div className="hand-tiles-row">
                    {isMe && player.hand
                      ? // Render Me (bottom) with actual hand and touch interaction
                        player.hand.map((tile, tIdx) => (
                          <MahjongTile
                            key={tIdx}
                            tile={tile}
                            size="lg"
                            selected={selectedTileIndex === tIdx}
                            onClick={() => handleTileClick(tIdx)}
                          />
                        ))
                      : // Render Others (top/left/right) with face-down cards
                        Array.from({ length: player.handCount }).map((_, tIdx) => (
                          <MahjongTile key={tIdx} tile="" faceDown={true} size={isMe ? 'lg' : 'md'} />
                        ))}
                  </div>
                )}
              </div>

              {/* Player Discard River (牌河) */}
              <div className="seat-discard-river">
                {player?.id && player.discards && player.discards.length > 0 && (
                  <div className="discard-tiles-grid">
                    {player.discards.map((tile, tIdx) => (
                      <MahjongTile key={tIdx} tile={tile} size="sm" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Guide notes */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>🀄 联机麻将自由对局测试指南</h3>
        <p className="page-subtitle" style={{ margin: 0, fontSize: '0.85rem' }}>
          * 这是一个**免打牌规则限制**的自由测试房。您可以随时在此房间与朋友进行联机胡打或自由推倒胡调试。
          <br />
          * **出牌交互**：点击手牌，牌面将向上**浮起**并高亮显示；**再次点击**已浮起的手牌，即可将其打入您的牌河。
          <br />
          * **摸牌与重置**：轮到自己回合时，点击右上角 **“手动摸牌”** 可以摸取 1 张新牌。点击 **“重置对局”**
          可重新洗牌并发牌给所有入座玩家。
          <br />* **视角旋转**：系统会自动进行视角旋转，您自己将**始终位于牌桌底侧**，方便触控出牌。
        </p>
      </div>
    </div>
  )
}
