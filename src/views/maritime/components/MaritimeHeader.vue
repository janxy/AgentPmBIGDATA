<template>
  <header class="maritime-header-bar">
    <div class="header-brand">
      <div class="brand-title">
        <span class="brand-dot" />
        海上全域感知大屏
      </div>
      <span class="brand-scene">全域态势 · 多源融合</span>
    </div>

    <div class="header-status">
      <div class="status-item">
        <b>{{ total }}</b>
        <span>目标总数</span>
      </div>
      <div class="status-item">
        <b>{{ sourceCounts.phased }}</b>
        <span>相控阵</span>
      </div>
      <div class="status-item">
        <b>{{ sourceCounts.xband1 }}</b>
        <span>X波段1</span>
      </div>
      <div class="status-item">
        <b>{{ sourceCounts.xband2 }}</b>
        <span>X波段2</span>
      </div>
      <div class="status-item">
        <b>{{ sourceCounts.ais }}</b>
        <span>AIS</span>
      </div>
      <div class="status-item">
        <b>{{ sourceCounts.framecode }}</b>
        <span>帧码</span>
      </div>
      <div class="status-item status-item--alarm">
        <b>{{ alarmCount }}</b>
        <span>待处置告警</span>
      </div>
    </div>

    <div class="header-time">
      <strong>{{ timeText }}</strong>
      <span>{{ dateText }}</span>
    </div>

    <span v-if="dataStatus" class="header-message" role="status">{{ dataStatus }}</span>

    <div class="header-actions">
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
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * 大屏顶部区域：平台标题、场景标签、状态摘要、系统时间与全屏/刷新入口。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { FullScreen, RefreshRight, Setting } from '@element-plus/icons-vue'

defineProps<{
  total: number
  sourceCounts: { phased: number; xband1: number; xband2: number; ais: number; framecode: number }
  alarmCount: number
  fullscreen: boolean
  refreshing: boolean
  dataStatus: string
}>()

const emit = defineEmits<{
  refresh: []
  'toggle-fullscreen': []
  'open-data-admin': []
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
  grid-template-columns: 430px minmax(0, 1fr) 260px minmax(0, 240px) 104px;
  align-items: center;
  padding: 0 18px 0 24px;
  color: var(--mar-text);
  background:
    linear-gradient(90deg, rgba(12, 42, 76, 0.55), rgba(8, 26, 48, 0.72), rgba(12, 42, 76, 0.55)),
    var(--mar-panel-strong);
  border: 1px solid var(--mar-line);
  border-radius: 8px;
  box-shadow: 0 0 18px rgba(0, 160, 255, 0.12) inset;
}

.header-brand {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
  white-space: nowrap;
}

.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mar-accent);
  box-shadow: 0 0 10px var(--mar-accent);
}

.brand-scene {
  color: var(--mar-text-dim);
  font-size: 13px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.header-status {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 76px;
  padding: 4px 8px;
  border-left: 1px solid var(--mar-line-soft);
}

.status-item b {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: var(--mar-accent);
  font-family: 'DIN Alternate', 'PingFang SC', sans-serif;
}

.status-item--alarm b {
  color: var(--mar-amber);
}

.status-item span {
  margin-top: 5px;
  color: var(--mar-text-dim);
  font-size: 12px;
  white-space: nowrap;
}

.header-time {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}

.header-time strong {
  font-size: 24px;
  font-weight: 700;
  color: var(--mar-text);
  font-family: 'DIN Alternate', 'PingFang SC', sans-serif;
}

.header-time span {
  margin-top: 2px;
  color: var(--mar-text-faint);
  font-size: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.header-message {
  min-width: 0;
  max-width: 240px;
  padding: 5px 10px;
  overflow: hidden;
  color: var(--mar-amber);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(245, 184, 75, 0.1);
  border: 1px solid rgba(245, 184, 75, 0.35);
  border-radius: 6px;
  justify-self: end;
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
</style>
