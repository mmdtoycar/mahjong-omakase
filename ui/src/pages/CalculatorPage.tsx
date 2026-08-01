import React, { useState, useCallback } from 'react'
import { GuobiaoCalculator } from '../components/GuobiaoCalculator'
import { RiichiCalculator } from '../components/RiichiCalculator'
import { WindSelectorRow } from '../components/WindSelectorRow'
import { PhotoRecognitionModal, RecognizedHand } from '../components/PhotoRecognitionModal'
import { Tile } from '../logic/shared/tiles'
import { Meld as GuobiaoMeld } from '../logic/guobiao/types'
import { Meld as RiichiMeld } from '../logic/riichi/types'

type GameMode = 'GUOBIAO' | 'RIICHI'

const CalculatorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GameMode>('GUOBIAO')
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false)

  // Standalone state for Guobiao
  const [gbIsSelfDraw, setGbIsSelfDraw] = useState(false)
  const [gbQuanfeng, setGbQuanfeng] = useState(1)
  const [gbMenfeng, setGbMenfeng] = useState(1)
  const [gbResetTrigger, setGbResetTrigger] = useState(0)
  const [gbImportedHand, setGbImportedHand] = useState<{
    concealed: Tile[]
    melds: GuobiaoMeld[]
    isSelfDraw?: boolean
    trigger: number
  } | null>(null)

  // Standalone state for Riichi
  const [riichiIsSelfDraw, setRiichiIsSelfDraw] = useState(false)
  const [riichiChangfeng, setRiichiChangfeng] = useState(1)
  const [riichiZifeng, setRiichiZifeng] = useState(1)
  const [riichiResetTrigger, setRiichiResetTrigger] = useState(0)
  const [riichiImportedHand, setRiichiImportedHand] = useState<{
    concealed: Tile[]
    melds: RiichiMeld[]
    isSelfDraw?: boolean
    trigger: number
  } | null>(null)

  const handleGbReset = useCallback(() => {
    setGbIsSelfDraw(false)
    setGbQuanfeng(1)
    setGbMenfeng(1)
    setGbResetTrigger((p) => p + 1)
    setGbImportedHand(null)
  }, [])

  const handleRiichiReset = useCallback(() => {
    setRiichiIsSelfDraw(false)
    setRiichiChangfeng(1)
    setRiichiZifeng(1)
    setRiichiResetTrigger((p) => p + 1)
    setRiichiImportedHand(null)
  }, [])

  // Handle applying hand from Photo Recognition modal
  const handleApplyRecognizedHand = (hand: RecognizedHand) => {
    if (activeTab === 'GUOBIAO') {
      const gbMelds: GuobiaoMeld[] = hand.melds.map((m) => {
        let type: 'shun' | 'ke' | 'gang' = 'shun'
        const lower = m.type.toLowerCase()
        if (lower.includes('ke') || lower.includes('pon') || lower.includes('peng')) {
          type = 'ke'
        } else if (lower.includes('gang') || lower.includes('kan')) {
          type = 'gang'
        }
        return {
          type,
          tiles: m.tiles,
          isOpen: m.isOpen,
        }
      })
      if (hand.isSelfDraw !== undefined) {
        setGbIsSelfDraw(hand.isSelfDraw)
      }
      setGbImportedHand({
        concealed: hand.concealed,
        melds: gbMelds,
        isSelfDraw: hand.isSelfDraw,
        trigger: Date.now(),
      })
    } else {
      const rMelds: RiichiMeld[] = hand.melds.map((m) => {
        let type: 'shunzi' | 'kezi' | 'gangzi' = 'shunzi'
        const lower = m.type.toLowerCase()
        if (lower.includes('ke') || lower.includes('pon') || lower.includes('peng')) {
          type = 'kezi'
        } else if (lower.includes('gang') || lower.includes('kan')) {
          type = 'gangzi'
        }
        return {
          type,
          tiles: m.tiles,
          isOpen: m.isOpen,
        }
      })
      if (hand.isSelfDraw !== undefined) {
        setRiichiIsSelfDraw(hand.isSelfDraw)
      }
      setRiichiImportedHand({
        concealed: hand.concealed,
        melds: rMelds,
        isSelfDraw: hand.isSelfDraw,
        trigger: Date.now(),
      })
    }
  }

  // Dummy callback since direct output is rendered internally by the components
  const handleSelectScore = () => {}

  return (
    <div className="container calc-page-wrapper">
      <div className="calc-header-bar">
        <div className="tabs calc-tabs">
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

        <button className="btn-photo-rec" onClick={() => setIsPhotoModalOpen(true)}>
          <span className="btn-photo-rec-icon">📷</span>
          <span>拍照识别</span>
          <span className="btn-photo-rec-badge">AI 识别</span>
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
              importedHand={gbImportedHand}
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
              importedHand={riichiImportedHand}
            />
          </div>
        )}
      </div>

      {/* Photo Recognition Modal */}
      <PhotoRecognitionModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onApplyHand={handleApplyRecognizedHand}
        gameMode={activeTab}
      />
    </div>
  )
}

export default CalculatorPage
