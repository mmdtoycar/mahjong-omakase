import React, { useState } from 'react'
import { Tile, TileSuit } from '../logic/shared/tiles'
import { TileComponent } from './shared/TileComponent'

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

export const FULL_34_TILES_STR = '1m2m3m4m5m6m7m8m9m1p2p3p4p5p6p7p8p9p1s2s3s4s5s6s7s8s9s1z2z3z4z5z6z7z'

let cachedSystemCalibrationBase64: string | null = null

async function getSystemCalibrationBase64(): Promise<string> {
  if (cachedSystemCalibrationBase64) return cachedSystemCalibrationBase64
  try {
    const res = await fetch('/system_mahjong_calibration.jpg')
    if (!res.ok) {
      throw new Error(`Failed to fetch calibration image: ${res.status}`)
    }
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        cachedSystemCalibrationBase64 = reader.result as string
        resolve(cachedSystemCalibrationBase64)
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.error('Failed to load builtin system calibration image:', e)
    return ''
  }
}

// Helper to automatically rotate base64 image on HTML5 Canvas by specified degrees (0, 90, 180, 270)
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

// Helper to safely parse JSON and repair potential trailing truncation
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
    const openQuotes = (repaired.match(/"/g) || []).length
    if (openQuotes % 2 !== 0) {
      repaired += '"'
    }
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

const DEFAULT_KEYS: string[] = []

function getApiKeyPool(): string[] {
  const envKeysStr = (import.meta.env.VITE_GEMINI_API_KEYS as string) || ''
  const envKeySingle = (import.meta.env.VITE_GEMINI_API_KEY as string) || ''

  const pool: string[] = []
  if (envKeysStr) {
    pool.push(
      ...envKeysStr
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
    )
  }
  if (envKeySingle && !pool.includes(envKeySingle)) {
    pool.push(envKeySingle)
  }
  for (const k of DEFAULT_KEYS) {
    if (!pool.includes(k)) pool.push(k)
  }
  return pool
}

let currentKeyIndex = 0

export async function callGeminiApiWithKeyRotation(contents: any[], model: string = 'gemini-3.6-flash'): Promise<any> {
  const keys = getApiKeyPool()
  if (keys.length === 0) {
    throw new Error('未配置任何 Gemini API Key')
  }

  let lastError: any = null

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(currentKeyIndex + attempt) % keys.length]
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      key
    )}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            response_mime_type: 'application/json',
          },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await res.json()

      if (res.ok && !data.error) {
        currentKeyIndex = (currentKeyIndex + attempt + 1) % keys.length
        return data
      }

      const errMsg = data.error?.message || ''
      const status = res.status
      console.warn(`Key attempt ${attempt + 1} failed (${status}):`, errMsg)

      // Only rotate keys for quota/rate-limit errors; propagate other errors immediately.
      if (
        status !== 429 &&
        status !== 503 &&
        !errMsg.toLowerCase().includes('quota') &&
        !errMsg.toLowerCase().includes('resource')
      ) {
        throw new Error(errMsg || `API 请求错误 (${status})`)
      }

      lastError = new Error(errMsg || `API 请求错误 (${status})`)
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        lastError = new Error('请求超时，请检查网络后重试')
        continue
      }
      // Non-quota fetch errors (e.g. network) — try next key
      console.warn(`Network error on key attempt ${attempt + 1}:`, err)
      lastError = err
    }
  }

  throw lastError || new Error('所有 Gemini API Key 额度均已耗尽或服务暂不可用')
}

// Helper to normalize EXIF camera orientation and force landscape mode (long edge horizontal X-axis, short edge vertical Y-axis)
export function normalizeUploadedImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        let w = img.width
        let h = img.height

        // Check if image is vertical (h > w). If so, rotate 90° clockwise to force landscape (width > height, long edge left-to-right)
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

        if (!ctx) return resolve(e.target?.result as string)

        if (isVertical) {
          // Rotate 90° clockwise so portrait image becomes landscape with long edge left-to-right
          ctx.translate(canvas.width / 2, canvas.height / 2)
          ctx.rotate((90 * Math.PI) / 180)
          ctx.drawImage(img, -targetH / 2, -targetW / 2, targetH, targetW)
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH)
        }

        resolve(canvas.toDataURL('image/jpeg', 0.88))
      }
      img.onerror = () => resolve(e.target?.result as string)
      img.src = e.target?.result as string
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
    return new Tile(m[2] as TileSuit, parseInt(m[1], 10))
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
  if (mpszMatches.length > 0) {
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
    if (tiles.length > 0) return tiles
  }

  // 2. Parse individual tokens or Chinese names (e.g. 1万, 2饼, 东)
  const tokens = str.split(/[\s,，、;\n]+/)
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

export const PhotoRecognitionModal: React.FC<PhotoRecognitionModalProps> = ({
  isOpen,
  onClose,
  onApplyHand,
  gameMode,
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecognizedHand | null>(null)

  // Tile Selection Modal for editing misrecognized tiles
  const [editingTileIndex, setEditingTileIndex] = useState<number | null>(null)

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input value so re-selecting the same file triggers onChange again
    e.target.value = ''
    if (file) {
      setSelectedImage(file)
      setError(null)
      setResult(null)
      try {
        const normalizedBase64 = await normalizeUploadedImage(file)
        setImagePreview(normalizedBase64)
      } catch (err) {
        console.error('Failed to normalize photo:', err)
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(file)
      }
    }
  }

  const handleRotateCounterClockwise = async () => {
    if (!imagePreview) return
    try {
      const rotated = await rotateImageBase64(imagePreview, 270)
      setImagePreview(rotated)
    } catch (err) {
      console.error('Failed to rotate image:', err)
    }
  }
  const handleRecognize = async () => {
    if (!selectedImage || !imagePreview) {
      setError('请先选择或拍摄一张麻将手牌图片')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const contents: any[] = []

      // 1. Single Master Calibration Image Context Turn (High Speed & Token-Efficient)
      const systemCalibBase64 = await getSystemCalibrationBase64()

      if (systemCalibBase64) {
        const mimeType = systemCalibBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/jpeg'
        const data = systemCalibBase64.split(',')[1]
        const fullTiles = parseTileList(FULL_34_TILES_STR)

        const promptText = `Master reference calibration photo containing ALL 34 mahjong tile patterns for this physical set:
Row 1: 1m to 9m (1万 to 9万)
Row 2: 1p to 9p (1饼/筒 to 9饼/筒)
Row 3: 1s to 9s (1条/索 to 9条/索)
Row 4: 1z to 7z (东,南,西,北,中,发,白)
Use this master visual legend to identify any tile in this set matching these patterns in any orientation (0° upright, 90° sideways, 180° inverted).`

        const sampleJson = {
          concealed: fullTiles.map((t) => `${t.rank}${t.suit}`),
          melds: [],
          winningTile: null,
          notes: 'Master 34-tile legend stored.',
        }

        contents.push({
          role: 'user',
          parts: [{ text: promptText }, { inline_data: { mime_type: mimeType, data } }],
        })

        contents.push({
          role: 'model',
          parts: [{ text: JSON.stringify(sampleJson) }],
        })
      }

      // 2. Prepare Target Image & Fast Visual Identification Prompt
      const targetMimeType = imagePreview.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/jpeg'
      const targetBase64 = imagePreview.split(',')[1]

      const systemPrompt = `You are a world-class, ultra-fast Mahjong Tile Recognition Expert.
Analyze this mahjong hand image with high precision.

### Strict Spatial Demarcation (左右空间划分与全数量把关):
1. **LEFT SIDE: Standing Concealed Hand (暗牌/立牌)**:
   - ALL upright standing tiles on the LEFT side belong strictly to "concealed".
   - Count EVERY standing tile block one by one.
   - List EVERY tile individually in array "concealed": ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5z", "5z"].
   - DO NOT skip any standing tile on the left! DO NOT use range hyphens like "1-9m"!

2. **RIGHT SIDE: Exposed Melds & Kangs (副露/吃碰杠)**:
   - ALL flat/exposed tiles or sets set aside on the RIGHT side belong strictly to "melds".
   - Note: Exposed melds may be stacked in multiple vertical rows on the right.
   - Chi/Shun (吃/顺): 3 consecutive -> { "type": "shun", "tiles": ["1m","2m","3m"], "isOpen": true }
   - Pon/Ke (碰/刻): 3 identical -> { "type": "ke", "tiles": ["5z","5z","5z"], "isOpen": true }
   - Ming-Gang (明杠): 4 face-up identical -> { "type": "gang", "tiles": ["6p","6p","6p","6p"], "isOpen": true }
   - An-Gang (暗杠): 4 tiles (2 face-UP, 2 face-DOWN backs) -> { "type": "gang", "tiles": ["8s","8s","8s","8s"], "isOpen": false }
   - DO NOT mix right-side exposed melds into the left-side concealed hand!

### Critical Tile Pattern Audit Rules (防错识别自查规则):
1. **5s (五条) vs 4s (四条)**:
   - **5s (五条)**: Has 4 corner bamboo sticks PLUS ONE DISTINCT RED BAMBOO STICK IN THE EXACT CENTER!
   - **4s (四条)**: Has ONLY 4 corner bamboo sticks with EMPTY center space (NO red center stick).
   - **MUST CHECK**: If a bamboo tile has a RED vertical stick in the middle surrounded by 4 green sticks, IT IS ALWAYS 5s ("5s"), NEVER 4s!
2. **Anti-Merge Seams**:
   - **2p vs 4p**: Two adjacent 2-dot tiles = TWO 2p TILES ("2p", "2p"), NEVER one 4p tile!
   - **2s vs 4s**: Two adjacent 2-bamboo tiles = TWO 2s TILES ("2s", "2s"), NEVER one 4s tile!
- Inspect vertical seams between tiles to count individual rectangular blocks accurately.

### Strict English Output Requirement (全英文输出，提升生成速度与稳定性):
- Write ALL JSON keys and values (especially the 'notes' string) STRICTLY in ENGLISH ASCII characters only.
- Example notes: "Left hand 13 standing tiles, Right 1 meld row An-Gang of 8s".
- DO NOT use Chinese characters anywhere in the JSON output!

### Return Format:
Return ONLY valid JSON:
{
  "notes": "Left hand 13 standing tiles, Right 1 meld row An-Gang of 8s",
  "concealed": ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "5z"],
  "melds": [
    { "type": "gang", "tiles": ["8s", "8s", "8s", "8s"], "isOpen": false }
  ],
  "winningTile": "5z",
  "isSelfDraw": false
}`

      contents.push({
        role: 'user',
        parts: [
          { text: systemPrompt },
          {
            inline_data: {
              mime_type: targetMimeType,
              data: targetBase64,
            },
          },
        ],
      })

      const data = await callGeminiApiWithKeyRotation(contents, 'gemini-3.6-flash')

      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!responseText) {
        throw new Error('模型未返回有效内容')
      }

      const jsonOutput = safeParseJSON(responseText)

      const rawConcealed =
        jsonOutput.concealed ||
        jsonOutput.concealedTiles ||
        jsonOutput.hand ||
        jsonOutput.tiles ||
        jsonOutput.concealed_tiles ||
        []

      let concealedTiles = parseTileList(rawConcealed)

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

      let winTile = parseTileString(jsonOutput.winningTile)

      if (winTile) {
        const foundIdx = concealedTiles.findIndex((t) => t.equals(winTile!))
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
      setError(err.message || '识别失败，请检查图片或 API Key')
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

  const handleApply = () => {
    if (result) {
      onApplyHand(result)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card photo-rec-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="photo-rec-title">
            <span className="photo-rec-icon">📷</span>
            <div>
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
          <div className="upload-container">
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
              className="btn btn-accent btn-block btn-lg photo-rec-submit-btn"
              disabled={loading || !selectedImage}
              onClick={handleRecognize}
            >
              {loading ? (
                <span className="loading-spinner-wrap">
                  <span className="spinner"></span> 正在使用 Gemini 3.6 Flash 智能识别中...
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

              <div className="result-actions">
                <button className="btn btn-success btn-lg" onClick={handleApply}>
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
