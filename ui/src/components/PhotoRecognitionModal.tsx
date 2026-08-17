import React, { useEffect, useState } from 'react'
import { Tile, TileSuit } from '../logic/shared/tiles'
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
  /** Fires the instant recognition returns something to fill in — there is no review step to wait for. */
  onApplyHand: (hand: RecognizedHand) => void
  /** Fires after every recognize attempt, success or miss, so a retaken photo's sample is tracked too. */
  onSample?: (sampleId: string | null) => void
  /** Purely so the reader's own log can say which session a request was for. */
  sessionId?: number
}

// Rotates a base64 image on an HTML5 Canvas by 0/90/180/270 degrees.
function rotateImageBase64(base64: string, degrees: number): Promise<string> {
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

/** Formats the server accepts, which are also the formats Gemini reads. */
const SUPPORTED_IMAGE_TYPES = ['jpeg', 'png', 'webp', 'heic', 'heif'] as const

// Case-insensitive on purpose: a data URL may arrive as `data:IMAGE/HEIC;base64,...`.
const IMAGE_DATA_URL = new RegExp(`^data:image/(${SUPPORTED_IMAGE_TYPES.join('|')});base64,(.+)$`, 'i')

/**
 * Splits a data URL into the MIME type the server expects and the bare base64 payload.
 *
 * One parser does both jobs so validation and extraction can never disagree — previously the guard
 * accepted any `image/*` (avif included, which the server rejects) while the extractor matched
 * `data:image` case-sensitively, so an uppercase `data:IMAGE/HEIC` was silently relabelled as JPEG.
 *
 * <p>Also rejects iOS Safari's `"data:,"`, which is what toDataURL returns past the canvas limit
 * instead of throwing.
 */
export function parseImageDataUrl(dataUrl: string | null | undefined): { mimeType: string; base64: string } | null {
  if (typeof dataUrl !== 'string') return null
  const m = dataUrl.match(IMAGE_DATA_URL)
  if (!m) return null
  return { mimeType: `image/${m[1].toLowerCase()}`, base64: m[2] }
}

export function isUsableImageDataUrl(dataUrl: string | null | undefined): dataUrl is string {
  return parseImageDataUrl(dataUrl) !== null
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(blob)
  })
}

// Downscales to at most 2048px and forces landscape (long edge on the X axis). Resolves null when the
// browser could not decode the image at all, which is how HEIC behaves everywhere except Safari.
//
// EXIF orientation is not applied here because it does not need to be: browsers apply it when drawing an
// <img> to a canvas (`image-orientation: from-image` is the default).
//
// Portrait photos are rotated 90° clockwise, which is a guess about which way the phone was held; the ↺
// button in the modal is there for when it was the other way.
function normalizeDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
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

      // Decoded, but nothing can be done with it. Hand back what came in rather than null: null means
      // "the browser cannot read this format", and that is not what happened.
      if (!ctx) return resolve(dataUrl)

      if (isVertical) {
        // Rotate 90° clockwise so portrait image becomes landscape with long edge left-to-right
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate((90 * Math.PI) / 180)
        ctx.drawImage(img, -targetH / 2, -targetW / 2, targetH, targetW)
      } else {
        ctx.drawImage(img, 0, 0, targetW, targetH)
      }

      const jpeg = canvas.toDataURL('image/jpeg', 0.88)
      resolve(isUsableImageDataUrl(jpeg) ? jpeg : dataUrl)
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

// HEIC, which is what an iPhone camera produces. Safari decodes it natively; Chrome and Firefox do not,
// so without this a photo taken on a phone and uploaded from a desktop reaches the server untouched —
// meaning none of the normalisation above ran, and in particular the ↺ rotate button silently did
// nothing, because that goes through a canvas too.
//
// Imported dynamically: it carries libheif compiled to WASM, well over a megabyte, and it is only ever
// needed on the browsers that cannot do this themselves. Nobody pays for it by loading the page.
async function heicToJpegDataUrl(file: Blob): Promise<string | null> {
  try {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    return await readAsDataUrl(Array.isArray(converted) ? converted[0] : converted)
  } catch {
    // A non-HEIC file the browser also could not decode, or a HEIC variant libheif rejects. The caller
    // falls back to sending the original, which is what happened before this existed.
    return null
  }
}

/**
 * The upload, normalised: at most 2048px, landscape, JPEG.
 *
 * Native decoding first, so Safari — which reads HEIC itself — never loads the WASM decoder, and every
 * ordinary JPEG takes the same path it always did. Only when the browser cannot decode the file at all
 * is heic2any pulled in.
 *
 * Sending the original untouched remains the last resort. It still works, because the server can decode
 * HEIC too, but it is strictly worse: no downscale, no forced landscape, and the rotate button has
 * nothing to act on.
 */
async function normalizeUploadedImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file)

  const normalized = await normalizeDataUrl(original)
  if (normalized) return normalized

  const asJpeg = await heicToJpegDataUrl(file)
  if (asJpeg) {
    const fromJpeg = await normalizeDataUrl(asJpeg)
    if (fromJpeg) return fromJpeg
  }
  return original
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
 * Parses the `winHand` string the two calculators emit — concealed tiles (sorted, each exactly 2
 * characters), then `^` and the winning tile, then zero or more melds in `[...]` (open) or `(...)`
 * (closed) — into the tile-array shape the recognisers themselves answer in.
 *
 * This is what actually gets confirmed as training data now: applying a recognition result is no
 * longer the last word on what a hand turns out to be, submitting the round is, and `winHand` is
 * what the calculator has settled on by then, corrections included. The grammar is exactly what
 * {@link ../components/MahjongHand.tsx} already walks to render the same string as tile images.
 */
export function winHandToLabel(hand: string): {
  concealed: string[]
  melds: { isOpen: boolean; tiles: string[] }[]
  winningTile: string | null
} {
  const concealed: string[] = []
  const melds: { isOpen: boolean; tiles: string[] }[] = []
  let winningTile: string | null = null
  let group: string[] = []
  let isOpen = true
  let inMeld = false

  let i = 0
  while (i < hand.length) {
    const ch = hand[i]
    if (ch === '[' || ch === '(') {
      isOpen = ch === '['
      inMeld = true
      group = []
      i++
    } else if (ch === ']' || ch === ')') {
      melds.push({ isOpen, tiles: group })
      inMeld = false
      i++
    } else if (ch === '^') {
      winningTile = hand.substring(i + 1, i + 3)
      // The recognisers' own answers carry the winning tile as the last concealed tile too (see
      // handleRecognize below) — matched here so a label reads the same shape as a model's answer.
      concealed.push(winningTile)
      i += 3
    } else {
      const tile = hand.substring(i, i + 2)
      if (inMeld) group.push(tile)
      else concealed.push(tile)
      i += 2
    }
  }
  return { concealed, melds, winningTile }
}

export const PhotoRecognitionModal: React.FC<PhotoRecognitionModalProps> = ({
  isOpen,
  onClose,
  onApplyHand,
  onSample,
  sessionId,
}) => {
  // The normalized upload, kept pristine so rotation never compounds JPEG loss.
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  // A local miss with a message to show, not a caught exception — the hand comes back empty and
  // there is nothing to apply, but the user still needs to know why before they type it by hand.
  const [warning, setWarning] = useState<string | null>(null)
  // HEIC decodes on iOS but not in desktop Chrome, and the fallback keeps the original file
  // so recognition still works — show that rather than a broken-image icon.
  const [previewFailed, setPreviewFailed] = useState(false)

  // Both callers keep this mounted and only toggle isOpen, so without this a reopen would
  // still show the previous photo.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen)
    if (!isOpen) {
      setSourceImage(null)
      setRotation(0)
      setImagePreview(null)
      setError(null)
      setWarning(null)
      setPreviewFailed(false)
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
      setWarning(null)
      setRotation(0)
      setPreviewFailed(false)
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

  /**
   * Local only — there is no button for Gemini any more. Whatever comes back, right or wrong, is
   * applied straight into the calculator with no review step: this project's priority right now is
   * bringing the local model up, and every recognised photo is training signal either way. Getting
   * it wrong costs a correction in the calculator, which was always the fallback anyway; a modal
   * the user has to read, edit and then click through cost more and answered to nobody.
   */
  const handleRecognize = async () => {
    if (!imagePreview) {
      setError('请先选择或拍摄一张麻将手牌图片')
      return
    }

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      // The prompt, the 34-tile calibration legend and the API key all live on the server.
      const parsed = parseImageDataUrl(imagePreview)
      if (!parsed) {
        throw new Error('图片格式不支持或处理失败，请重新拍摄或换一张照片')
      }
      const { mimeType, base64 } = parsed
      if (base64.length > 8_000_000) {
        throw new Error('图片过大，请用较低分辨率重拍，或关闭 iPhone 的 ProRAW / 48MP')
      }
      const {
        rawJson: responseText,
        warning: miss,
        sampleId,
      } = await recognizeHandPhoto(base64, mimeType, 'local', sessionId)
      onSample?.(sampleId ?? null)

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

      // A miss comes back as a well-formed but empty hand (see HandRecognitionService) — nothing to
      // apply, so surface the reason instead and leave the calculator to be filled in by hand.
      if (miss) {
        setWarning(miss)
        return
      }

      onApplyHand({
        concealed: concealedTiles,
        melds,
        winningTile: winTile,
        isSelfDraw: Boolean(jsonOutput.isSelfDraw),
        notes: jsonOutput.notes,
      })
      onClose()
    } catch (err: any) {
      console.error('Photo recognition error:', err)
      setError(err.message || '识别失败，请重试')
    } finally {
      setLoading(false)
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
              <p className="photo-rec-subtitle">识别完成后直接填入算番器，错了就在算番器里改</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="photo-rec-body">
          {imagePreview && (
            <div className="photo-rec-controls-bar">
              <button
                type="button"
                className="icon-control-btn"
                onClick={handleRotateCounterClockwise}
                title="逆时针旋转 90°"
                disabled={loading}
              >
                ↺
              </button>
              <label className="icon-control-btn" title="重新选择图片">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="visually-hidden"
                  disabled={loading}
                />
                🔄
              </label>
            </div>
          )}

          <div>
            {!imagePreview ? (
              <>
                <label className="upload-dropzone">
                  {/* No capture attribute: it would force the camera and hide the photo library,
                      contradicting the label below. */}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="visually-hidden" />
                  <div className="dropzone-content">
                    <div className="upload-icon">📸</div>
                    <p className="upload-main-text">点击选择照片 或 拍照</p>
                    <p className="upload-sub-text">支持桌面或手机拍摄的麻将手牌</p>
                  </div>
                </label>
                {/* Only what changes the result, and each of these is something the pipeline relies
                    on. Left/right is how the prompt splits the hand into concealed and melds. Two
                    tiles turned over is what makes a 杠 concealed, which keeps 门前清 and so changes
                    the score. The rightmost standing tile is the winning tile: the prompt requires
                    that order to be preserved and both calculators score from the last element. */}
                <ul className="photo-rec-tips">
                  <li>立牌在左、副露在右，中间留空；和牌张放立牌最右边</li>
                  <li>暗杠扣两张，明杠全朝上</li>
                  <li>从正上方拍，只拍手牌，别带进弃牌和牌墙</li>
                </ul>
              </>
            ) : (
              <div className="image-preview-wrapper">
                {previewFailed ? (
                  <p className="upload-sub-text">此格式无法在当前浏览器预览，但可以正常识别</p>
                ) : (
                  <img
                    src={imagePreview}
                    alt="Hand preview"
                    className="uploaded-img-preview"
                    onError={() => setPreviewFailed(true)}
                  />
                )}
              </div>
            )}
          </div>

          {error && <div className="photo-rec-error">⚠️ {error}</div>}
          {warning && <div className="photo-rec-warning">ℹ️ {warning}</div>}

          <button
            className="btn btn-accent photo-rec-submit-btn"
            disabled={loading || !imagePreview}
            onClick={handleRecognize}
          >
            {loading ? (
              <span className="loading-spinner-wrap">
                <span className="spinner"></span> 正在识别中...
              </span>
            ) : (
              '✨ 开始识别'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
