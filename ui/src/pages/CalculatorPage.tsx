import React, { useState, useCallback } from 'react'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'

type GameMode = 'GUOBIAO' | 'RIICHI'

const CalculatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GameMode>('GUOBIAO')

  // Standalone state for Guobiao
  const [gbIsSelfDraw, setGbIsSelfDraw] = useState(false)
  const [gbQuanfeng, setGbQuanfeng] = useState(1)
  const [gbMenfeng, setGbMenfeng] = useState(1)
  const [gbResetTrigger, setGbResetTrigger] = useState(0)

  // Standalone state for Riichi
  const [riichiIsSelfDraw, setRiichiIsSelfDraw] = useState(false)
  const [riichiChangfeng, setRiichiChangfeng] = useState(1)
  const [riichiZifeng, setRiichiZifeng] = useState(1)
  const [riichiResetTrigger, setRiichiResetTrigger] = useState(0)

  // Reset callbacks
  const handleGbReset = useCallback(() => {
    setGbResetTrigger((prev) => prev + 1)
  }, [])

  const handleRiichiReset = useCallback(() => {
    setRiichiResetTrigger((prev) => prev + 1)
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

  // Dummy callback since direct output is rendered internally by the components
  const handleSelectScore = () => {}

  return (
    <div className="container calc-page-wrapper" style={{ maxWidth: '800px', margin: '0 auto', padding: '12px' }}>
      {/* Premium Compact Styles */}
      <style>{`
        .compact-toggle-btn {
          padding: 4px 10px;
          font-size: 0.82rem;
          font-weight: 700;
          border: 1px solid var(--border);
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .compact-toggle-btn.active {
          background: var(--primary);
          color: #fff;
          border-color: var(--primary);
        }
        .configs-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          align-items: center;
          background: var(--bg-muted);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        @media (max-width: 768px) {
          .calc-page-wrapper {
            padding: 4px !important;
          }
          .tab-btn {
            font-size: 0.95rem !important;
            padding: 8px 14px !important;
            margin: 0 2px !important;
          }
          .configs-row {
            gap: 8px !important;
            padding: 6px 10px !important;
            margin-bottom: 8px !important;
          }
          .compact-toggle-btn {
            padding: 3px 6px !important;
            font-size: 0.78rem !important;
            border-radius: 4px !important;
          }
          .configs-row-section {
            gap: 4px !important;
          }
          .card {
            padding: 10px !important;
          }
        }
      `}</style>

      {/* Mode Tabs */}
      <div
        className="tabs"
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 12,
          borderBottom: '2px solid var(--border)',
          paddingBottom: 2,
        }}
      >
        <button
          className={`tab-btn ${activeTab === 'GUOBIAO' ? 'active' : ''}`}
          onClick={() => setActiveTab('GUOBIAO')}
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            padding: '10px 24px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'GUOBIAO' ? '4px solid var(--primary)' : '4px solid transparent',
            color: activeTab === 'GUOBIAO' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            margin: '0 4px',
          }}
        >
          国标算番器
        </button>
        <button
          className={`tab-btn ${activeTab === 'RIICHI' ? 'active' : ''}`}
          onClick={() => setActiveTab('RIICHI')}
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            padding: '10px 24px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'RIICHI' ? '4px solid var(--primary)' : '4px solid transparent',
            color: activeTab === 'RIICHI' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
            margin: '0 4px',
          }}
        >
          立直算番器
        </button>
      </div>

      {/* Main Container Card */}
      <div
        className="card"
        style={{
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
        }}
      >
        {activeTab === 'GUOBIAO' ? (
          <div>
            {/* Super Compact Configurations Row */}
            <div className="configs-row">
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="config-row-label">和牌:</span>
                <button
                  className={`compact-toggle-btn ${!gbIsSelfDraw ? 'active' : ''}`}
                  onClick={() => setGbIsSelfDraw(false)}
                >
                  点炮
                </button>
                <button
                  className={`compact-toggle-btn ${gbIsSelfDraw ? 'active' : ''}`}
                  onClick={() => setGbIsSelfDraw(true)}
                >
                  自摸
                </button>
              </div>
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="config-row-label">圈风:</span>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`compact-toggle-btn ${gbQuanfeng === w ? 'active' : ''}`}
                    onClick={() => setGbQuanfeng(w)}
                  >
                    {getWindName(w)}
                  </button>
                ))}
              </div>
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="config-row-label">门风:</span>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`compact-toggle-btn ${gbMenfeng === w ? 'active' : ''}`}
                    onClick={() => setGbMenfeng(w)}
                  >
                    {getWindName(w)}
                  </button>
                ))}
              </div>
              <button
                className="compact-toggle-btn"
                style={{ marginLeft: 'auto', background: 'var(--bg-muted)', color: 'var(--text-muted)', borderColor: 'var(--border-muted)' }}
                onClick={handleGbReset}
              >
                清空
              </button>
            </div>

            {/* In-game Core Calculator Component */}
            <GuobiaoCalculator
              key={`gb-calc-${gbResetTrigger}`}
              onSelectScore={handleSelectScore}
              initialOptions={{
                quanfeng: gbQuanfeng,
                menfeng: gbMenfeng,
              }}
              resetTrigger={gbResetTrigger}
              isSelfDraw={gbIsSelfDraw}
              onIsSelfDrawChange={setGbIsSelfDraw}
            />
          </div>
        ) : (
          <div>
            {/* Super Compact Configurations Row */}
            <div className="configs-row">
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="config-row-label">和牌:</span>
                <button
                  className={`compact-toggle-btn ${!riichiIsSelfDraw ? 'active' : ''}`}
                  onClick={() => setRiichiIsSelfDraw(false)}
                >
                  荣和
                </button>
                <button
                  className={`compact-toggle-btn ${riichiIsSelfDraw ? 'active' : ''}`}
                  onClick={() => setRiichiIsSelfDraw(true)}
                >
                  自摸
                </button>
              </div>
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="config-row-label">场风:</span>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`compact-toggle-btn ${riichiChangfeng === w ? 'active' : ''}`}
                    onClick={() => setRiichiChangfeng(w)}
                  >
                    {getWindName(w)}
                  </button>
                ))}
              </div>
              <div className="configs-row-section" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="config-row-label">自风:</span>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`compact-toggle-btn ${riichiZifeng === w ? 'active' : ''}`}
                    onClick={() => setRiichiZifeng(w)}
                  >
                    {getWindName(w)}
                  </button>
                ))}
              </div>
              <button
                className="compact-toggle-btn"
                style={{ marginLeft: 'auto', background: 'var(--bg-muted)', color: 'var(--text-muted)', borderColor: 'var(--border-muted)' }}
                onClick={handleRiichiReset}
              >
                清空
              </button>
            </div>

            {/* In-game Core Calculator Component */}
            <RiichiCalculator
              key={`riichi-calc-${riichiResetTrigger}`}
              onSelectScore={handleSelectScore}
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
        )}
      </div>
    </div>
  )
}

export default CalculatorPage
