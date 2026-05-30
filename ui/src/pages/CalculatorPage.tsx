import React, { useState, useCallback } from 'react'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'
import { MahjongHand } from '../components/MahjongHand'

type GameMode = 'GUOBIAO' | 'RIICHI'

interface ScoreResult {
  score: number | null
  hand?: string
  fanDetails?: string
  fanCount?: number
  tsumoDetail?: { dealer: number; nonDealer: number } | null
}

const CalculatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GameMode>('GUOBIAO')

  // Standalone state for Guobiao
  const [gbIsSelfDraw, setGbIsSelfDraw] = useState(false)
  const [gbQuanfeng, setGbQuanfeng] = useState(1)
  const [gbMenfeng, setGbMenfeng] = useState(1)
  const [gbResetTrigger, setGbResetTrigger] = useState(0)
  const [gbResult, setGbResult] = useState<ScoreResult | null>(null)

  // Standalone state for Riichi
  const [riichiIsSelfDraw, setRiichiIsSelfDraw] = useState(false)
  const [riichiChangfeng, setRiichiChangfeng] = useState(1)
  const [riichiZifeng, setRiichiZifeng] = useState(1)
  const [riichiResetTrigger, setRiichiResetTrigger] = useState(0)
  const [riichiResult, setRiichiResult] = useState<ScoreResult | null>(null)
  const [riichiError, setRiichiError] = useState<string | null>(null)

  // Reset callbacks
  const handleGbReset = useCallback(() => {
    setGbResetTrigger((prev) => prev + 1)
    setGbResult(null)
  }, [])

  const handleRiichiReset = useCallback(() => {
    setRiichiResetTrigger((prev) => prev + 1)
    setRiichiResult(null)
    setRiichiError(null)
  }, [])

  const getWindName = (val: number) => {
    switch (val) {
      case 1:
        return '东'
      case 2:
        return '南'
      case 3:
        return '西'
      case 4:
        return '北'
      default:
        return '东'
    }
  }

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      <div className="page-header" style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--primary) 0%, #2980b9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}
        >
          专业麻将算番器
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          无需创建房间，即可随时模拟与测试手牌番数，是锤炼和牌判断力的绝佳利器。
        </p>
      </div>

      {/* Mode Tabs */}
      <div
        className="tabs"
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '32px',
          borderBottom: '2px solid var(--border)',
          paddingBottom: '2px',
        }}
      >
        <button
          className={`tab-btn ${activeTab === 'GUOBIAO' ? 'active' : ''}`}
          onClick={() => setActiveTab('GUOBIAO')}
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            padding: '12px 32px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'GUOBIAO' ? '4px solid var(--primary)' : '4px solid transparent',
            color: activeTab === 'GUOBIAO' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            margin: '0 8px',
          }}
        >
          🇨🇳 国标麻将算番器
        </button>
        <button
          className={`tab-btn ${activeTab === 'RIICHI' ? 'active' : ''}`}
          onClick={() => setActiveTab('RIICHI')}
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            padding: '12px 32px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'RIICHI' ? '4px solid var(--primary)' : '4px solid transparent',
            color: activeTab === 'RIICHI' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            margin: '0 8px',
          }}
        >
          🇯🇵 日本麻将算番器
        </button>
      </div>

      {/* Main Panel Split */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
          gap: '32px',
          alignItems: 'start',
        }}
        className="calc-split-container"
      >
        {/* Left Column: Interactive Calculator UI */}
        <div
          className="card"
          style={{ padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', borderRadius: '16px' }}
        >
          {activeTab === 'GUOBIAO' ? (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.8rem' }}>🀄</span> 国标规则设置
                </h2>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleGbReset}
                  style={{ borderRadius: '8px', padding: '6px 16px', fontWeight: 'bold' }}
                >
                  🧹 清空手牌
                </button>
              </div>

              {/* Hand configurations */}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    和牌方式
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn ${!gbIsSelfDraw ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setGbIsSelfDraw(false)}
                      style={{ flex: 1, padding: '8px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                      点炮
                    </button>
                    <button
                      type="button"
                      className={`btn ${gbIsSelfDraw ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setGbIsSelfDraw(true)}
                      style={{ flex: 1, padding: '8px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                      自摸
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    本局圈风
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`btn ${gbQuanfeng === w ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setGbQuanfeng(w)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          minWidth: '32px',
                        }}
                      >
                        {getWindName(w)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    玩家门风
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`btn ${gbMenfeng === w ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setGbMenfeng(w)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          minWidth: '32px',
                        }}
                      >
                        {getWindName(w)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shared Calculator */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <GuobiaoCalculator
                  key={`gb-calc-${gbResetTrigger}`}
                  onSelectScore={(score, hand, fanDetails, fanCount) => {
                    setGbResult({ score, hand, fanDetails, fanCount })
                  }}
                  initialOptions={{
                    quanfeng: gbQuanfeng,
                    menfeng: gbMenfeng,
                  }}
                  resetTrigger={gbResetTrigger}
                  isSelfDraw={gbIsSelfDraw}
                  onIsSelfDrawChange={setGbIsSelfDraw}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.8rem' }}>🎌</span> 日麻规则设置
                </h2>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleRiichiReset}
                  style={{ borderRadius: '8px', padding: '6px 16px', fontWeight: 'bold' }}
                >
                  🧹 清空手牌
                </button>
              </div>

              {/* Hand configurations */}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    和牌方式
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn ${!riichiIsSelfDraw ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRiichiIsSelfDraw(false)}
                      style={{ flex: 1, padding: '8px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                      荣和
                    </button>
                    <button
                      type="button"
                      className={`btn ${riichiIsSelfDraw ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setRiichiIsSelfDraw(true)}
                      style={{ flex: 1, padding: '8px', fontSize: '0.9rem', borderRadius: '8px' }}
                    >
                      自摸
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    本局场风
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`btn ${riichiChangfeng === w ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRiichiChangfeng(w)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          minWidth: '32px',
                        }}
                      >
                        {getWindName(w)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      display: 'block',
                    }}
                  >
                    玩家自风
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`btn ${riichiZifeng === w ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setRiichiZifeng(w)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          minWidth: '32px',
                        }}
                      >
                        {getWindName(w)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shared Calculator */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <RiichiCalculator
                  key={`riichi-calc-${riichiResetTrigger}`}
                  onSelectScore={(score, hand, fanDetails, fanCount, tsumoDetail) => {
                    setRiichiResult({ score, hand, fanDetails, fanCount, tsumoDetail })
                  }}
                  onError={setRiichiError}
                  initialOptions={{
                    changfeng: riichiChangfeng,
                    zifeng: riichiZifeng,
                  }}
                  resetTrigger={riichiResetTrigger}
                  isSelfDraw={riichiIsSelfDraw}
                  onIsSelfDrawChange={setRiichiIsSelfDraw}
                  playerCount={4}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Dynamic Hand & Breakdown Output */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Hand Result Display */}
          <div
            className="card"
            style={{ padding: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', borderRadius: '16px' }}
          >
            <h3 style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              📊 实时测算结果
            </h3>

            {activeTab === 'GUOBIAO' ? (
              gbResult && gbResult.hand ? (
                <div>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      和牌手牌展示
                    </label>
                    <div
                      style={{
                        background: 'var(--bg-muted)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <MahjongHand hand={gbResult.hand} />
                    </div>
                  </div>

                  <div style={{ margin: '20px 0' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background:
                          'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(39, 174, 96, 0.05) 100%)',
                        border: '1px solid rgba(46, 204, 113, 0.2)',
                        padding: '16px',
                        borderRadius: '12px',
                      }}
                    >
                      <div>
                        <span
                          style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}
                        >
                          总计番数
                        </span>
                        <strong style={{ fontSize: '1.8rem', color: '#27ae60', fontWeight: 800 }}>
                          {gbResult.score} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>番</span>
                        </strong>
                      </div>
                      <div
                        className="badge badge-success"
                        style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
                      >
                        {gbIsSelfDraw ? '自摸胡牌' : '点炮和牌'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        display: 'block',
                        marginBottom: '8px',
                      }}
                    >
                      番种拆解 breakdown
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {gbResult.fanDetails ? (
                        gbResult.fanDetails.split(',').map((tag, idx) => (
                          <span
                            key={idx}
                            className="pattern-tag"
                            style={{
                              background: '#fff',
                              border: '1.5px solid var(--border)',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              color: 'var(--text)',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            }}
                          >
                            {tag.trim()}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>无符合的番种数据</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>🀄</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>手牌张数不足 14 张</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                    请在左侧点击麻将牌组成你的胡牌组合，即可在此处查看精准的番数解析。
                  </p>
                </div>
              )
            ) : // Riichi Section
            riichiResult && riichiResult.hand ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    和牌手牌展示
                  </label>
                  <div
                    style={{
                      background: 'var(--bg-muted)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <MahjongHand hand={riichiResult.hand} />
                  </div>
                </div>

                <div style={{ margin: '20px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.15) 0%, rgba(41, 128, 185, 0.05) 100%)',
                      border: '1px solid rgba(52, 152, 219, 0.2)',
                      padding: '16px',
                      borderRadius: '12px',
                    }}
                  >
                    <div>
                      <span
                        style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}
                      >
                        和了得点
                      </span>
                      <strong style={{ fontSize: '1.8rem', color: '#2980b9', fontWeight: 800 }}>
                        {riichiResult.score} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>点</span>
                      </strong>
                      <span
                        style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}
                      >
                        累计：{riichiResult.fanCount} 番
                      </span>
                    </div>
                    <div
                      className="badge badge-primary"
                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      {riichiIsSelfDraw ? '自摸' : '荣和'}
                    </div>
                  </div>

                  {/* Tsumo split explanation */}
                  {riichiIsSelfDraw && riichiResult.tsumoDetail && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '0.85rem',
                        padding: '8px 12px',
                        background: 'var(--bg-muted)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      👉 <strong>得点支付明细：</strong>
                      {riichiZifeng === 1 ? (
                        <span>闲家各付 {riichiResult.tsumoDetail.nonDealer} 点</span>
                      ) : (
                        <span>
                          庄家付 {riichiResult.tsumoDetail.dealer} 点，闲家各付 {riichiResult.tsumoDetail.nonDealer} 点
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: '8px',
                    }}
                  >
                    役名拆解 breakdown
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {riichiResult.fanDetails ? (
                      riichiResult.fanDetails.split(',').map((tag, idx) => (
                        <span
                          key={idx}
                          className="pattern-tag"
                          style={{
                            background: '#fff',
                            border: '1.5px solid var(--border)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            color: 'var(--text)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                          }}
                        >
                          {tag.trim()}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>无和牌役名</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>🎌</span>
                <p style={{ margin: 0, fontWeight: 600 }}>{riichiError || '手牌张数不足 14 张'}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                  {riichiError
                    ? '你的手牌虽然组成 14 张但无法和牌。请调整组合，必须至少拥有一种“起和役”！'
                    : '请在左侧点击麻将牌组成你的胡牌组合，即可在此处查看精准的番数与点数解析。'}
                </p>
              </div>
            )}
          </div>

          {/* Educational Quick Reference Card */}
          <div
            className="card"
            style={{
              padding: '20px',
              borderRadius: '16px',
              background: 'var(--bg-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 700 }}>💡 算番测试指南</h4>
            <ul
              style={{
                paddingLeft: '16px',
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              <li>
                <strong>自摸与点炮</strong>：和牌方式会直接影响“不求人”或“门前清”等番种的有效判定。
              </li>
              <li>
                <strong>风位设定</strong>：更改圈风和门风，可以测试自己是否记住了对应的圈风刻（2番）与门风刻（2番）。
              </li>
              <li>
                <strong>起和限制</strong>：国标麻将规则最低需要 <strong>8 番</strong> 方可起和；日本麻将必须至少包含{' '}
                <strong>1 役</strong>（且无役不能和牌）。
              </li>
              <li>
                <strong>实时逻辑一致性</strong>
                ：本算番器与对局记分板使用完全相同的核心计算引擎，保证所有判定结果在当前及未来的所有版本中
                <strong>永久一致</strong>。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CalculatorPage
