import React from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export const TheoryGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog theory-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="modal-title-icon">📖</span>
            <h3>日麻牌效理论速查手册（新手开窍宝典）</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="theory-modal-body">
          {/* SECTION 1: 五块理论 */}
          <div className="theory-section">
            <h4 className="theory-title">1. 五块理论（五ブロック理論）</h4>
            <p className="theory-desc">
              日麻标准和牌型为 <strong>4面子 + 1雀头 = 5个组块</strong>。手牌的效率本质就是管理这 5 块结构：
            </p>
            <div className="theory-cards-row">
              <div className="theory-card card-under">
                <div className="theory-card-badge">不足五块（≤4块）</div>
                <p>手牌搭子不够，必须保留优质中张（456）靠搭，先切客风字牌与19端张。</p>
              </div>
              <div className="theory-card card-exact">
                <div className="theory-card-badge">刚好五块（5块已齐）</div>
                <p>手牌骨架已定型！孤张已无靠搭意义，切除冗余浮牌，锁定五块专注改良推进。</p>
              </div>
              <div className="theory-card card-over">
                <div className="theory-card-badge">六块超额（≥6块）</div>
                <p>搭子过剩导致手牌臃肿！必须比拼搭子质量，果断拆除最弱的一块（如死边张）。</p>
              </div>
            </div>
          </div>

          {/* SECTION 2: 搭子质量天梯 */}
          <div className="theory-section">
            <h4 className="theory-title">2. 搭子质量阶梯（从强到弱）</h4>
            <div className="ladder-table-wrapper">
              <table className="theory-table">
                <thead>
                  <tr>
                    <th>搭子类型</th>
                    <th>典型牌型</th>
                    <th>进张牌数</th>
                    <th>特点与策略</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="highlight-text-green">两面搭子</td>
                    <td>45m / 78p</td>
                    <td>8 张 (两头)</td>
                    <td>最强搭子，无论枚数还是好形率都是首选，尽量保护不拆。</td>
                  </tr>
                  <tr>
                    <td className="highlight-text-blue">两坎复合形</td>
                    <td>246m / 357s</td>
                    <td>8 张 (两坎)</td>
                    <td>占用3张牌，摸任一张均成顺子，进张媲美两面，切莫误拆！</td>
                  </tr>
                  <tr>
                    <td className="highlight-text-blue">中膨形</td>
                    <td>4556p / 3445s</td>
                    <td>极多改良</td>
                    <td>两翼进顺，中间成雀头或暗刻，是极高阶的变化枢纽。</td>
                  </tr>
                  <tr>
                    <td className="highlight-text-yellow">坎张搭子</td>
                    <td>24p / 68s</td>
                    <td>4 张 (中坎)</td>
                    <td>质量中等。关键优势是摸邻牌（如24摸5）可改良为两面。</td>
                  </tr>
                  <tr>
                    <td className="highlight-text-red">边张搭子</td>
                    <td>12m / 89s</td>
                    <td>4 张 (死坎)</td>
                    <td>最劣搭子！只能进3或7，且永远无法改良为两面，超额必先拆。</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: 孤张与字牌处理次序 */}
          <div className="theory-section">
            <h4 className="theory-title">3. 孤张价值链与出牌顺序</h4>
            <div className="arrow-flow-box">
              <span className="flow-step step-bad">客风字牌 (南/西/北)</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step step-bad">役牌孤张 (白/发/中)</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step step-mid">1/9 幺九端牌</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step step-mid">2/8 近端牌</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step step-good">3/7 尖张</span>
              <span className="flow-arrow">➔</span>
              <span className="flow-step step-great">4/5/6 核心中张</span>
            </div>
            <p className="theory-note">
              💡 核心原理：中张（456）摸到周围 5
              种牌均能成搭，两面率极高；端张（19）只能靠出愚形边坎；客风牌完全无法顺子靠搭。
            </p>
          </div>

          {/* SECTION 4: 一向听黄金法则 */}
          <div className="theory-section">
            <h4 className="theory-title">4. 一向听黄金法则：完全一向听与好形率</h4>
            <div className="theory-card card-exact" style={{ marginTop: '8px' }}>
              <div className="theory-card-badge">完全一向听（Perfect 1-Shanten）</div>
              <p>
                构型公式：<strong>2个两面 + 1个雀头 + 1个复合搭（双碰/亚两面）</strong>。进张面通常高达 20~28 张，且
                100% 好形听牌！
              </p>
            </div>
            <div className="theory-card card-under" style={{ marginTop: '8px' }}>
              <div className="theory-card-badge">避开“无雀头一向听”陷阱</div>
              <p>
                如果过早把手中的对子全部拆掉，虽然看似都是顺子搭，但会陷入“没有雀头”的绝境，听牌时被迫变成极难和牌的单骑听牌。
                <strong>宁可少两张进张，也要保护好手中的雀头候补！</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            理解了，返回练习
          </button>
        </div>
      </div>
    </div>
  )
}
