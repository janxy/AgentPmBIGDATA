<template>
  <header class="maritime-header-bar">
    <div class="header-time">
      <span class="time-icon">
        <el-icon><Clock /></el-icon>
      </span>
      <span class="time-meta">
        <strong>{{ timeText }}</strong>
        <span>{{ dateText }}</span>
      </span>
    </div>

    <div class="header-brand">
      <div class="brand-title">
        <span class="brand-dot" />
        海上全域感知大屏
      </div>
      <span class="brand-scene">全域态势 · 多源融合</span>
    </div>

    <div class="header-right">
      <span v-if="dataStatus" class="header-message" role="status">{{ dataStatus }}</span>
      <div class="header-actions">
        <el-tooltip content="智能执法" placement="bottom">
          <button type="button" class="header-btn header-btn--law" aria-label="智能执法" @click="emit('open-law-enforce')">
            <el-icon><MagicStick /></el-icon>
            <span>智能执法</span>
          </button>
        </el-tooltip>
        <el-tooltip content="演示数据维护" placement="bottom">
          <button type="button" class="header-btn" aria-label="演示数据维护" @click="emit('open-data-admin')">
            <el-icon><Setting /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="刷新数据" placement="bottom">
          <button
            type="button"
            class="header-btn"
            :class="{ 'header-btn--loading': refreshing }"
            :disabled="refreshing"
            aria-label="刷新数据"
            @click="emit('refresh')"
          >
            <el-icon><RefreshRight /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip :content="fullscreen ? '退出全屏' : '进入全屏'" placement="bottom">
          <button type="button" class="header-btn" :aria-label="fullscreen ? '退出全屏' : '进入全屏'" @click="emit('toggle-fullscreen')">
            <el-icon><FullScreen /></el-icon>
          </button>
        </el-tooltip>
        <button type="button" class="header-btn header-btn--alarm" aria-label="模拟告警效果" @click="emit('simulate-alarm')">
          <el-icon><Warning /></el-icon>
          <span>模拟告警效果</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * 大屏顶部区域：居中平台标题、左侧系统时间与右侧功能入口。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Clock, FullScreen, MagicStick, RefreshRight, Setting, Warning } from '@element-plus/icons-vue'

defineProps<{
  fullscreen: boolean
  refreshing: boolean
  dataStatus: string
}>()

const emit = defineEmits<{
  refresh: []
  'toggle-fullscreen': []
  'open-law-enforce': []
  'open-data-admin': []
  'simulate-alarm': []
}>()

const pad = (n: number) => String(n).padStart(2, '0')
const now = () => new Date()
const timeText = ref('')
const dateText = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const updateClock = () => {
  if (document.visibilityState === 'hidden') return
  const d = now()
  timeText.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  dateText.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

onMounted(() => {
  updateClock()
  timer = setInterval(updateClock, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.maritime-header-bar {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  padding: 0 16px;
  overflow: hidden;
  isolation: isolate;
  color: var(--mar-text);
  background:
    linear-gradient(90deg, rgba(12, 42, 76, 0.55), rgba(8, 26, 48, 0.72), rgba(12, 42, 76, 0.55)),
    var(--mar-panel-strong);
  border: 1px solid var(--mar-line);
  border-radius: 8px;
  box-shadow: 0 0 18px rgba(0, 160, 255, 0.12) inset;
}

.maritime-header-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 18% 40%, rgba(56, 198, 255, 0.16), transparent 55%),
    radial-gradient(ellipse at 82% 45%, rgba(45, 212, 191, 0.12), transparent 55%),
    radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.06), transparent 60%);
  animation: header-bg-breathe 5s ease-in-out infinite;
}

.maritime-header-bar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 26%;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(56, 198, 255, 0.14), transparent);
  transform: translateX(-130%) skewX(-16deg);
  animation: header-scan 6s ease-in-out infinite;
}

@keyframes header-bg-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@keyframes header-scan {
  0% {
    transform: translateX(-130%) skewX(-16deg);
  }
  55%,
  100% {
    transform: translateX(540%) skewX(-16deg);
  }
}

.header-time {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  grid-column: 1;
  justify-self: start;
}

.header-time::after {
  content: '';
  width: 1px;
  height: 34px;
  margin-left: 18px;
  background: linear-gradient(180deg, transparent, var(--mar-line-soft), transparent);
}

.time-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--mar-accent);
  background: rgba(56, 198, 255, 0.08);
  border: 1px solid var(--mar-line-soft);
  border-radius: 8px;
  flex-shrink: 0;
}

.time-icon .el-icon {
  font-size: 20px;
}

.time-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.time-meta strong {
  font-size: 24px;
  font-weight: 700;
  color: var(--mar-text);
  font-family: 'DIN Alternate', 'PingFang SC', sans-serif;
  white-space: nowrap;
}

.time-meta span {
  margin-top: 4px;
  color: var(--mar-text-faint);
  font-size: 12px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.header-brand {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 32px;
  grid-column: 2;
  text-align: center;
}

.header-brand::before,
.header-brand::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 120px;
  height: 1px;
  pointer-events: none;
}

.header-brand::before {
  right: 100%;
  margin-right: 28px;
  background: linear-gradient(90deg, transparent, rgba(56, 198, 255, 0.55));
}

.header-brand::after {
  left: 100%;
  margin-left: 28px;
  background: linear-gradient(90deg, rgba(56, 198, 255, 0.55), transparent);
}

.brand-title {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 4px;
  white-space: nowrap;
  background: linear-gradient(90deg, #f0f9ff 0%, #8ee6ff 25%, #38c6ff 48%, #8ee6ff 72%, #f0f9ff 100%);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: brand-title-flow 6s linear infinite;
}

.brand-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mar-accent);
  box-shadow: 0 0 10px var(--mar-accent), 0 0 22px rgba(56, 198, 255, 0.4);
  flex-shrink: 0;
}

.brand-dot::before,
.brand-dot::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(56, 198, 255, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: brand-ping 2.4s ease-out infinite;
}

.brand-dot::after {
  animation-delay: 1.2s;
}

.brand-title::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 0;
  bottom: -5px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--mar-accent), transparent);
  animation: brand-beam 3s ease-in-out infinite;
}

.brand-scene {
  background: linear-gradient(90deg, #9fc4e6, #e8f6ff, #6fc4ea);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  margin-top: 4px;
  font-size: 13px;
  letter-spacing: 3px;
  white-space: nowrap;
  animation: brand-scene-flow 4s linear infinite;
}

@keyframes brand-title-flow {
  0% {
    background-position: 0% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes brand-scene-flow {
  0% {
    background-position: 0% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes brand-beam {
  0%,
  100% {
    opacity: 0.3;
    transform: scaleX(0.55);
    transform-origin: left center;
  }
  50% {
    opacity: 0.95;
    transform: scaleX(1);
    transform-origin: left center;
  }
}

@keyframes brand-ping {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.85;
  }
  70%,
  100% {
    transform: translate(-50%, -50%) scale(3.2);
    opacity: 0;
  }
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  grid-column: 3;
}

.header-right::before {
  content: '';
  width: 1px;
  height: 34px;
  margin-right: 14px;
  background: linear-gradient(180deg, transparent, var(--mar-line-soft), transparent);
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.header-message {
  min-width: 0;
  max-width: 220px;
  padding: 5px 10px;
  overflow: hidden;
  color: var(--mar-amber);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(245, 184, 75, 0.1);
  border: 1px solid rgba(245, 184, 75, 0.35);
  border-radius: 6px;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--mar-text-dim);
  background: rgba(56, 198, 255, 0.08);
  border: 1px solid var(--mar-line-soft);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.header-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.header-btn--loading .el-icon {
  animation: header-spin 0.9s linear infinite;
}

@keyframes header-spin {
  to {
    transform: rotate(360deg);
  }
}

.header-btn:hover {
  color: var(--mar-text);
  border-color: var(--mar-line);
  transform: translateY(-1px);
}

.header-btn .el-icon {
  font-size: 18px;
}

.header-btn--alarm {
  gap: 6px;
  width: auto;
  padding: 0 12px;
  color: var(--mar-red);
  font-size: 13px;
  white-space: nowrap;
  background: rgba(255, 107, 107, 0.1);
  border-color: rgba(255, 107, 107, 0.4);
}

.header-btn--alarm:hover {
  color: #fff;
  border-color: var(--mar-red);
  background: rgba(255, 107, 107, 0.28);
  box-shadow: 0 0 14px rgba(255, 107, 107, 0.35);
}

.header-btn--alarm .el-icon {
  font-size: 17px;
}

.header-btn--law {
  gap: 6px;
  width: auto;
  padding: 0 12px;
  color: var(--mar-accent);
  font-size: 13px;
  white-space: nowrap;
  background: rgba(56, 198, 255, 0.12);
  border-color: rgba(56, 198, 255, 0.45);
}

.header-btn--law:hover {
  color: #fff;
  border-color: var(--mar-accent);
  background: rgba(56, 198, 255, 0.3);
  box-shadow: 0 0 14px rgba(56, 198, 255, 0.35);
}

.header-btn--law .el-icon {
  font-size: 17px;
}
</style>
