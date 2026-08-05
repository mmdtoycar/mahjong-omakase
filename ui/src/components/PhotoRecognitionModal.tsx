import React, { useEffect, useState } from 'react'
import { Tile, TileSuit } from '../logic/shared/tiles'
import { TileComponent } from './shared/TileComponent'
import { recognizeHandPhoto } from '../api'

export interface RecognizedHand {
  concealed: Tile[]
  melds: { type: string; tiles: Tile[]; isOpen: boolean }[]
  winningTile: Tile | null
  isSelfDraw: boolean
  notes?: string
}

interface PhotoRecognitionModalProps {
  isOpen: boolean
  onClose: () => void
  onApplyHand: (hand: RecognizedHand) => void
  gameMode: 'GUOBIAO' | 'RIICHI'
}

// Rotates a base64 image on an HTML5 Canvas by 0/90/180/270 degrees.
export function rotateImageBase64(base64: string, degrees: number): Promise<string> {
  if (degrees === 0) return Promise.resolve(base64)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(base64)

      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height
        canvas.height = img.width
      } else {
        canvas.width = img.width
        canvas.height = img.height
      }

      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((degrees * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)

      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(base64)
    img.src = base64
  })
}

// Parses model JSON, making a best-effort repair of output truncated mid-token.
export function safeParseJSON(str: string): any {
  let clean = str.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  try {
    return JSON.parse(clean)
  } catch (err) {
    console.warn('Initial JSON parse failed, attempting repair:', err)
    let repaired = clean

    // An unpaired quote means the output stopped inside a string. Drop that partial
    // token rather than closing it, so we never invent a tile that was never read.
    if ((repaired.match(/"/g) || []).length % 2 !== 0) {
      repaired = repaired.slice(0, repaired.lastIndexOf('"'))
    }
    // Truncation almost always leaves a dangling separator or a key with no value;
    // balancing brackets on top of those still yields invalid JSON.
    repaired = repaired
      .replace(/[\s,]+$/, '')
      .replace(/,?\s*"[^"]*"\s*:\s*$/, '')
      .replace(/[\s,]+$/, '')

    const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length
    for (let i = 0; i < openBrackets; i++) repaired += ']'
    const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length
    for (let i = 0; i < openBraces; i++) repaired += '}'

    try {
      return JSON.parse(repaired)
    } catch {
      throw err
    }
  }
}

/** iOS Safari 的 toDataURL 在超出画布上限时不抛错, 而是返回 "data:," 这种空串。 */
export function isUsableImageDataUrl(dataUrl: string | null | undefined): dataUrl is string {
  return typeof dataUrl === 'string' && /^data:image\/[a-z+]+;base64,.+/i.test(dataUrl)
}

// Downscales an upload to at most 2048px and forces landscape (long edge on the X axis).
// EXIF orientation is not decoded here — browsers already apply it when drawing an <img>
// to a canvas (`image-orientation: from-image` is the default).
// Portrait photos are rotated 90° clockwise, which is a guess: the ↺ button in the modal
// is there for when the camera was held the other way.
export function normalizeUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const original = e.target?.result as string
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        const w = img.width
        const h = img.height

        const isVertical = h > w

        let targetW = isVertical ? h : w
        let targetH = isVertical ? w : h

        const maxDim = 2048
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW)
            targetW = maxDim
          } else {
            targetW = Math.round((targetW * maxDim) / targetH)
            targetH = maxDim
          }
        }

        canvas.width = targetW
        canvas.height = targetH

        if (!ctx) return resolve(original)

        if (isVertical) {
          // Rotate 90° clockwise so portrait image becomes landscape with long edge left-to-right
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate((90 * Math.PI) / 180)
          ctx.drawImage(img, -targetH / 2, -targetW / 2, targetH, targetW)
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH)
        }

        const jpeg = canvas.toDataURL('image/jpeg', 0.88)
        resolve(isUsableImageDataUrl(jpeg) ? jpeg : original)
      }
      img.onerror = () => resolve(original)
      img.src = original
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

export function parseTileString(s: string): Tile | null {
  if (typeof s !== 'string' || !s) return null
  const clean = s.trim().toLowerCase()
  const m = clean.match(/^([1-9])([mpsz])$/)
  if (m) {
    const suit = m[2] as TileSuit
    const rank = parseInt(m[1], 10)
    // Honors stop at 7 — "8z"/"9z" would build a tile with no face.
    if (rank > (suit === 'z' ? 7 : 9)) return null
    return new Tile(suit, rank)
  }

  const charMap: Record<string, Tile> = {
    一万: new Tile('m', 1),
    '1万': new Tile('m', 1),
    二万: new Tile('m', 2),
    '2万': new Tile('m', 2),
    三万: new Tile('m', 3),
    '3万': new Tile('m', 3),
    四万: new Tile('m', 4),
    '4万': new Tile('m', 4),
    五万: new Tile('m', 5),
    '5万': new Tile('m', 5),
    六万: new Tile('m', 6),
    '6万': new Tile('m', 6),
    七万: new Tile('m', 7),
    '7万': new Tile('m', 7),
    八万: new Tile('m', 8),
    '8万': new Tile('m', 8),
    九万: new Tile('m', 9),
    '9万': new Tile('m', 9),

    一饼: new Tile('p', 1),
    '1饼': new Tile('p', 1),
    '1筒': new Tile('p', 1),
    二饼: new Tile('p', 2),
    '2饼': new Tile('p', 2),
    '2筒': new Tile('p', 2),
    三饼: new Tile('p', 3),
    '3饼': new Tile('p', 3),
    '3筒': new Tile('p', 3),
    四饼: new Tile('p', 4),
    '4饼': new Tile('p', 4),
    '4筒': new Tile('p', 4),
    五饼: new Tile('p', 5),
    '5饼': new Tile('p', 5),
    '5筒': new Tile('p', 5),
    六饼: new Tile('p', 6),
    '6饼': new Tile('p', 6),
    '6筒': new Tile('p', 6),
    七饼: new Tile('p', 7),
    '7饼': new Tile('p', 7),
    '7筒': new Tile('p', 7),
    八饼: new Tile('p', 8),
    '8饼': new Tile('p', 8),
    '8筒': new Tile('p', 8),
    九饼: new Tile('p', 9),
    '9饼': new Tile('p', 9),
    '9筒': new Tile('p', 9),

    一条: new Tile('s', 1),
    '1条': new Tile('s', 1),
    '1索': new Tile('s', 1),
    二条: new Tile('s', 2),
    '2条': new Tile('s', 2),
    '2索': new Tile('s', 2),
    三条: new Tile('s', 3),
    '3条': new Tile('s', 3),
    '3索': new Tile('s', 3),
    四条: new Tile('s', 4),
    '4条': new Tile('s', 4),
    '4索': new Tile('s', 4),
    五条: new Tile('s', 5),
    '5条': new Tile('s', 5),
    '5索': new Tile('s', 5),
    六条: new Tile('s', 6),
    '6条': new Tile('s', 6),
    '6索': new Tile('s', 6),
    七条: new Tile('s', 7),
    '7条': new Tile('s', 7),
    '7索': new Tile('s', 7),
    八条: new Tile('s', 8),
    '8条': new Tile('s', 8),
    '8索': new Tile('s', 8),
    九条: new Tile('s', 9),
    '9条': new Tile('s', 9),
    '9索': new Tile('s', 9),

    东: new Tile('z', 1),
    东风: new Tile('z', 1),
    南: new Tile('z', 2),
    南风: new Tile('z', 2),
    西: new Tile('z', 3),
    西风: new Tile('z', 3),
    北: new Tile('z', 4),
    北风: new Tile('z', 4),
    中: new Tile('z', 5),
    红中: new Tile('z', 5),
    发: new Tile('z', 6),
    發: new Tile('z', 6),
    发财: new Tile('z', 6),
    白: new Tile('z', 7),
    白板: new Tile('z', 7),
  }
  return charMap[clean] || null
}

export function parseTileList(input: any): Tile[] {
  const result: Tile[] = []
  if (!input) return result

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        const t = parseTileString(item)
        if (t) {
          result.push(t)
        } else {
          result.push(...parseTileStringSequence(item))
        }
      } else if (typeof item === 'object' && item !== null) {
        const validSuits: TileSuit[] = ['m', 'p', 's', 'z']
        if (
          typeof item.rank === 'number' &&
          typeof item.suit === 'string' &&
          validSuits.includes(item.suit as TileSuit) &&
          item.rank >= 1 &&
          item.rank <= (item.suit === 'z' ? 7 : 9)
        ) {
          result.push(new Tile(item.suit as TileSuit, item.rank))
        }
      }
    }
  } else if (typeof input === 'string') {
    result.push(...parseTileStringSequence(input))
  }
  return result
}

export function parseTileStringSequence(str: string): Tile[] {
  const tiles: Tile[] = []
  if (!str) return tiles

  // Expand range hyphen notation like "1-9m" -> "123456789m"
  str = str.replace(/([1-9])\s*-\s*([1-9])\s*([mpsz])/gi, (_, start, end, suit) => {
    let res = ''
    const s = parseInt(start, 10)
    const e = parseInt(end, 10)
    for (let i = s; i <= e; i++) res += `${i}`
    return res + suit
  })

  // Expand Chinese range like "1万-9万" or "1-9万"
  str = str.replace(
    /([一二三四五六七八九1-9])\s*-\s*([一二三四五六七八九1-9])\s*([万萬饼筒条索])/g,
    (_, start, end, suit) => {
      const s = '一二三四五六七八九'.includes(start) ? '一二三四五六七八九'.indexOf(start) + 1 : parseInt(start, 10)
      const e = '一二三四五六七八九'.includes(end) ? '一二三四五六七八九'.indexOf(end) + 1 : parseInt(end, 10)
      let res = ''
      for (let i = s; i <= e; i++) res += `${i}${suit} `
      return res
    }
  )

  // 1. Match standard notation 123m 456p 789s 11155z
  const mpszMatches = Array.from(str.matchAll(/([1-9]+)([mpsz])/gi))
  for (const match of mpszMatches) {
    const digits = match[1]
    const suit = match[2].toLowerCase() as TileSuit
    for (const d of digits) {
      const rank = parseInt(d, 10)
      if (rank >= 1 && rank <= (suit === 'z' ? 7 : 9)) {
        tiles.push(new Tile(suit, rank))
      }
    }
  }

  // Strip what step 1 consumed, then keep going: a mixed string like "123m 东南" must not
  // lose its Chinese tiles just because the ASCII notation matched first.
  const remainder = mpszMatches.length > 0 ? str.replace(/([1-9]+)([mpsz])/gi, ' ') : str

  // 2. Parse individual tokens or Chinese names (e.g. 1万, 2饼, 东)
  const tokens = remainder.split(/[\s,，、;\n]+/)
  for (const tok of tokens) {
    if (!tok.trim()) continue
    const t = parseTileString(tok)
    if (t) {
      tiles.push(t)
    } else {
      const cnMatches = Array.from(tok.matchAll(/([一二三四五六七八九1-9])\s*([万萬饼筒条索])/g))
      for (const m of cnMatches) {
        const numStr = m[1]
        const suitStr = m[2]
        const rank = '一二三四五六七八九'.includes(numStr)
          ? '一二三四五六七八九'.indexOf(numStr) + 1
          : parseInt(numStr, 10)
        let suit: TileSuit = 'm'
        if ('饼筒'.includes(suitStr)) suit = 'p'
        if ('条索'.includes(suitStr)) suit = 's'
        if (rank >= 1 && rank <= 9) {
          tiles.push(new Tile(suit, rank))
        }
      }

      const honorMap: Record<string, number> = {
        东: 1,
        東: 1,
        南: 2,
        西: 3,
        北: 4,
        中: 5,
        发: 6,
        發: 6,
        白: 7,
      }
      for (const char of tok) {
        if (honorMap[char]) {
          tiles.push(new Tile('z', honorMap[char]))
        }
      }
    }
  }

  return tiles
}

/**
 * Sanity-checks a recognized hand before it can be pushed into a calculator.
 *
 * A gang shows 4 physical tiles but occupies 3 slots, so hand size is counted that way.
 * `blocking` problems are ones no real hand can have, and the model does occasionally
 * produce them (e.g. echoing the whole 34-tile legend back as the hand).
 */
export function checkRecognizedHand(hand: RecognizedHand): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []
  const warnings: string[] = []

  const meldSlots = hand.melds.reduce((sum, m) => sum + (m.tiles.length === 4 ? 3 : m.tiles.length), 0)
  const size = hand.concealed.length + meldSlots

  // Both calculators score a meld as exactly 3 slots, so a 2- or 5-tile meld silently
  // shifts the hand size and produces a set no rule set can form.
  const badMelds = hand.melds.filter((m) => m.tiles.length !== 3 && m.tiles.length !== 4)
  if (badMelds.length > 0) {
    blocking.push(`有 ${badMelds.length} 组副露张数不是 3 或 4 张，请修正后再填入`)
  }

  const counts = new Map<string, number>()
  for (const t of [...hand.concealed, ...hand.melds.flatMap((m) => m.tiles)]) {
    const key = `${t.rank}${t.suit}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const over = [...counts.entries()].filter(([, n]) => n > 4).map(([key]) => key)
  if (over.length > 0) {
    blocking.push(`${over.join('、')} 出现超过 4 张，请修正后再填入`)
  }

  if (size === 0) {
    blocking.push('没有识别出任何牌，请换一张更清晰的照片重试')
  } else if (size > 14) {
    blocking.push(`共识别出 ${size} 张牌（含副露），超过一手牌上限，请删掉多余的牌`)
  } else if (size < 13) {
    warnings.push(`只识别出 ${size} 张牌，可能有遗漏，建议补齐后再填入`)
  }

  return { blocking, warnings }
}

export const PhotoRecognitionModal: React.FC<PhotoRecognitionModalProps> = ({
  isOpen,
  onClose,
  onApplyHand,
  gameMode,
}) => {
  // The normalized upload, kept pristine so rotation never compounds JPEG loss.
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecognizedHand | null>(null)

  // Tile Selection Modal for editing misrecognized tiles
  const [editingTileIndex, setEditingTileIndex] = useState<number | null>(null)

  // Both callers keep this mounted and only toggle isOpen, so without this a reopen would
  // still show the previous photo and result.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (!isOpen) {
      setSourceImage(null)
      setRotation(0)
      setImagePreview(null)
      setError(null)
      setResult(null)
      setEditingTileIndex(null)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input value so re-selecting the same file triggers onChange again
    e.target.value = ''
    if (file) {
      setError(null)
      setResult(null)
      setRotation(0)
      try {
        const normalizedBase64 = await normalizeUploadedImage(file)
        setSourceImage(normalizedBase64)
        setImagePreview(normalizedBase64)
      } catch (err) {
        console.error('Failed to normalize photo:', err)
        const reader = new FileReader()
        reader.onloadend = () => {
          setSourceImage(reader.result as string)
          setImagePreview(reader.result as string)
        }
        // Normalization already failed to get here; a second silent failure would leave
        // the dropzone looking simply broken.
        reader.onerror = () => {
          console.error('Failed to read photo:', reader.error)
          setError('读取图片失败，请重新选择或换一张照片')
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleRotateCounterClockwise = async () => {
    if (!sourceImage) return
    // Always re-render from the pristine normalized upload: rotating the previous preview
    // would stack a fresh JPEG re-encode on every press.
    const nextRotation = (rotation + 270) % 360
    try {
      const rotated = await rotateImageBase64(sourceImage, nextRotation)
      setRotation(nextRotation)
      setImagePreview(rotated)
    } catch (err) {
      console.error('Failed to rotate image:', err)
    }
  }

  const handleRecognize = async () => {
    if (!imagePreview) {
      setError('请先选择或拍摄一张麻将手牌图片')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // The prompt, the 34-tile calibration legend and the API key all live on the server.
      if (!isUsableImageDataUrl(imagePreview)) {
        throw new Error('图片处理失败，请重新拍摄或换一张照片')
      }
      const mimeType = imagePreview.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/jpeg'
      const base64 = imagePreview.slice(imagePreview.indexOf(',') + 1)
      if (base64.length > 8_000_000) {
        throw new Error('图片过大，请用较低分辨率重拍，或关闭 iPhone 的 ProRAW / 48MP')
      }
      const responseText = await recognizeHandPhoto(base64, mimeType)

      const jsonOutput = safeParseJSON(responseText)

      const rawConcealed =
        jsonOutput.concealed ||
        jsonOutput.concealedTiles ||
        jsonOutput.hand ||
        jsonOutput.tiles ||
        jsonOutput.concealed_tiles ||
        []

      const concealedTiles = parseTileList(rawConcealed)

      const melds: { type: string; tiles: Tile[]; isOpen: boolean }[] = []

      if (Array.isArray(jsonOutput.melds)) {
        for (const m of jsonOutput.melds) {
          const mTiles = parseTileList(m.tiles)
          if (mTiles.length > 0) {
            melds.push({
              type: m.type || 'shun',
              tiles: mTiles,
              isOpen: m.isOpen !== false,
            })
          }
        }
      }

      const winTile = parseTileString(jsonOutput.winningTile)

      if (winTile) {
        const foundIdx = concealedTiles.findIndex((t) => t.equals(winTile))
        if (foundIdx !== -1) {
          concealedTiles.splice(foundIdx, 1)
        }
        concealedTiles.push(winTile)
      }

      setResult({
        concealed: concealedTiles,
        melds,
        winningTile: winTile,
        isSelfDraw: Boolean(jsonOutput.isSelfDraw),
        notes: jsonOutput.notes,
      })
    } catch (err: any) {
      console.error('Photo recognition error:', err)
      setError(err.message || '识别失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // Quick Tile Modification in Result
  const handleRemoveTile = (index: number) => {
    if (!result) return
    const updatedConcealed = [...result.concealed]
    updatedConcealed.splice(index, 1)
    setResult({ ...result, concealed: updatedConcealed })
  }

  const handleReplaceTile = (index: number, newTile: Tile) => {
    if (!result) return
    const updatedConcealed = [...result.concealed]
    updatedConcealed[index] = newTile
    setResult({ ...result, concealed: updatedConcealed })
    setEditingTileIndex(null)
  }

  const handleAddTile = (newTile: Tile) => {
    if (!result) return
    setResult({ ...result, concealed: [...result.concealed, newTile] })
    setEditingTileIndex(null)
  }

  const issues = result ? checkRecognizedHand(result) : null

  const handleApply = () => {
    if (result && issues && issues.blocking.length === 0) {
      onApplyHand(result)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card photo-rec-modal"
        role="dialog"
        aria-modal="true"
        aria-label="拍照识别手牌"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="photo-rec-title">
            <span className="photo-rec-icon">📷</span>
            <div>
              <h3>拍照识别</h3>
              <p className="photo-rec-subtitle">高精度 AI 自动识别手牌与副露</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body photo-rec-body">
          {/* Top Control Bar (Rotate & Reselect) - Shown ONLY before submission (!result) */}
          {imagePreview && !result && (
            <div className="photo-rec-controls-bar">
              <button
                type="button"
                className="icon-control-btn"
                onClick={handleRotateCounterClockwise}
                title="逆时针旋转 90°"
              >
                ↺
              </button>
              <label className="icon-control-btn" title="重新选择图片">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                🔄
              </label>
            </div>
          )}

          {/* Main Upload Area */}
          <div>
            {!imagePreview ? (
              <label className="upload-dropzone">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-content">
                  <div className="upload-icon">📸</div>
                  <p className="upload-main-text">点击选择照片 或 拍照</p>
                  <p className="upload-sub-text">支持桌面或手机拍摄的麻将手牌</p>
                </div>
              </label>
            ) : (
              <div className="image-preview-wrapper">
                <img src={imagePreview} alt="Hand preview" className="uploaded-img-preview" />
              </div>
            )}
          </div>

          {error && <div className="photo-rec-error">⚠️ {error}</div>}

          {/* Action button */}
          {!result && (
            <button
              className="btn btn-accent photo-rec-submit-btn"
              disabled={loading || !imagePreview}
              onClick={handleRecognize}
            >
              {loading ? (
                <span className="loading-spinner-wrap">
                  <span className="spinner"></span> AI 正在识别中...
                </span>
              ) : (
                '✨ 开始 AI 拍照识别'
              )}
            </button>
          )}

          {/* Recognition Result Display */}
          {result && (
            <div className="recognition-result-card">
              <div className="result-header-row">
                <h4>🎯 识别结果 (点击修改)</h4>
                <button className="btn-text-link" onClick={() => setResult(null)} title="重新识别/重新拍照">
                  📸
                </button>
              </div>

              <div className="result-section">
                <span className="result-label">立牌/手牌 ({result.concealed.length}张):</span>
                <div className="result-tiles-row">
                  {result.concealed.map((t, idx) => (
                    <div key={idx} className="tile-edit-wrapper" onClick={() => setEditingTileIndex(idx)}>
                      <TileComponent
                        tile={t}
                        size="small"
                        isWinning={idx === result.concealed.length - 1 && result.concealed.length % 3 === 2}
                      />
                      <button
                        className="tile-del-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveTile(idx)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button className="tile-add-btn" title="补一张牌" onClick={() => setEditingTileIndex(-1)}>
                    +
                  </button>
                </div>
              </div>

              {/* Tile Selector Drawer for direct editing */}
              {editingTileIndex !== null && (
                <div className="tile-picker-box">
                  <div className="tile-picker-header">
                    <span>{editingTileIndex >= 0 ? `修正第 ${editingTileIndex + 1} 张牌:` : '添加牌:'}</span>
                    <button className="btn-close-sm" onClick={() => setEditingTileIndex(null)}>
                      ✕
                    </button>
                  </div>
                  <div className="tile-picker-grid">
                    {Tile.all.map((t, i) => (
                      <TileComponent
                        key={i}
                        tile={t}
                        size="small"
                        onClick={() =>
                          editingTileIndex >= 0 ? handleReplaceTile(editingTileIndex, t) : handleAddTile(t)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {result.melds.length > 0 && (
                <div className="result-section">
                  <span className="result-label">吃碰杠/副露 ({result.melds.length}组):</span>
                  <div className="result-melds-row">
                    {result.melds.map((m, mIdx) => (
                      <div key={mIdx} className="result-meld-group">
                        <span className="meld-type-tag">
                          {m.type === 'shun' || m.type === 'shunzi'
                            ? '顺'
                            : m.type === 'ke' || m.type === 'kezi'
                            ? '刻'
                            : '杠'}
                        </span>
                        {m.tiles.map((t, tIdx) => (
                          <TileComponent key={tIdx} tile={t} size="small" />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {issues &&
                [...issues.blocking, ...issues.warnings].map((msg, i) => (
                  <div key={i} className="photo-rec-error">
                    ⚠️ {msg}
                  </div>
                ))}

              <div className="result-actions">
                <button
                  className="btn btn-success"
                  disabled={!issues || issues.blocking.length > 0}
                  onClick={handleApply}
                >
                  ✅ 一键填入{gameMode === 'GUOBIAO' ? '国标' : '立直'}算番器
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
