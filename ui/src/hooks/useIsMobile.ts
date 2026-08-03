import { useEffect, useState } from 'react'
import { MOBILE_BREAKPOINT } from '../utils/fontSize'

const QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`

/**
 * 订阅式的移动端断点判断. 直接读 window.innerWidth 不会触发 React 重渲染, 所以旋转屏幕或缩放窗口
 * 跨过断点后, 内联算出来的字号会一直停在旧值 —— 用 matchMedia 的 change 事件把它变成状态.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    // 挂载时同步一次: 首次 render 到 effect 执行之间视口可能已经变了.
    setIsMobile(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
