import { onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'

/** 大屏设计稿基准尺寸 */
const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const scale = ref(1)
const isCompact = ref(false)
const fullscreen = ref(false)
let rafId: number | null = null

function updateScale() {
  if (document.visibilityState === 'hidden') return
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    const next = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
    scale.value = next
    isCompact.value = scale.value <= 0.55
  })
}

function syncFullscreen() {
  fullscreen.value = Boolean(document.fullscreenElement)
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    ElMessage.warning('当前环境不支持全屏，请使用浏览器全屏能力')
  }
  syncFullscreen()
  updateScale()
}

function handleFullscreenChange() {
  syncFullscreen()
  updateScale()
}

function removeGlobalListeners() {
  window.removeEventListener('resize', updateScale)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
}

/**
 * 大屏等比缩放与全屏控制：模块级共享状态，只保留一组窗口监听，
 * 每个使用方独立注册/注销，靠 rAF 合并重排，避免热更新时计数错乱。
 */
export function useMaritimeScreen() {
  window.addEventListener('resize', updateScale)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  updateScale()

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScale)
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
  })

  return { scale, isCompact, fullscreen, toggleFullscreen }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    removeGlobalListeners()
  })
}
