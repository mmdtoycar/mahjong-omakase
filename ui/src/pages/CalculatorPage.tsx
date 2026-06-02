import React, { useState, useCallback } from 'react'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'
import { WindSelectorRow } from '../components/WindSelectorRow'

type GameMode = 'GUOBIAO' | 'RIICHI'

const CalculatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GameMode>('GUOBIAO')

  // Standalone state for Guobiao
  const [gbIsSelfDraw, setGbIsSelfDraw] = useState(false)
  const [gbQuanfeng, setGbQuanfeng] = useState(1)
  const [gbMenfeng, setGbMenfeng] = useState(1)
  const [gbResetTrigger,  setGbResetTrigger] = useState(0)

  // Standalone state for Riichi
  const [riichiIsSelfDraw, setRiichiIsSelfDraw] = useState(false)
  const [riichiChangfeng, setRiichiChangfeng] = useState(1)
  const [riichiZifeng, setRiichiZifeng] = useState(1)
  const [riichiResetTrigger, setRiichiResetTrigger] = useState(0)

  const handleGbReset = useCallback(() => setGbResetTrigger((p) => p + 1), [])
  const handleRiichiReset = useCallback(() => setRiichiResetTrigger((p) => p + 1), [])

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
              <WindSelectorRow label="圈风" value={gbQuanfeng} onChange={setGbQuanfeng} />
              <WindSelectorRow label="门风" value={gbMenfeng} onChange={setGbMenfeng} />
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
              <WindSelectorRow label="场风" value={riichiChangfeng} onChange={setRiichiChangfeng} />
              <WindSelectorRow label="自风" value={riichiZifeng} onChange={setRiichiZifeng} />
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
