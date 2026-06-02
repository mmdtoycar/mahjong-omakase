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
    <div className="container calc-page-wrapper">
      <div className="tabs">
        <button
          className={`calc-mode-tab-btn ${activeTab === 'GUOBIAO' ? 'active' : ''}`}
          onClick={() => setActiveTab('GUOBIAO')}
        >
          国标算番器
        </button>
        <button
          className={`calc-mode-tab-btn ${activeTab === 'RIICHI' ? 'active' : ''}`}
          onClick={() => setActiveTab('RIICHI')}
        >
          立直算番器
        </button>
      </div>

      <div className="card calc-card">
        {activeTab === 'GUOBIAO' ? (
          <div>
            <div className="configs-row">
              <div className="configs-row-section" style={{ gap: 6 }}>
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
              <div className="configs-row-section" style={{ gap: 4 }}>
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
              <div className="configs-row-section" style={{ gap: 4 }}>
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
              <button className="compact-toggle-btn compact-toggle-btn-reset" onClick={handleGbReset}>
                清空
              </button>
            </div>

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
            <div className="configs-row">
              <div className="configs-row-section" style={{ gap: 6 }}>
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
              <div className="configs-row-section" style={{ gap: 4 }}>
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
              <div className="configs-row-section" style={{ gap: 4 }}>
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
              <button className="compact-toggle-btn compact-toggle-btn-reset" onClick={handleRiichiReset}>
                清空
              </button>
            </div>

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
