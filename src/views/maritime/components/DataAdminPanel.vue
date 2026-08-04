<template>
  <Teleport to="body">
    <div class="data-admin-mask" @click.self="close">
      <section class="data-admin" :style="panelStyle" aria-label="演示数据维护">
        <header class="data-admin__head">
          <div class="data-admin__title">
            <el-icon><Setting /></el-icon>
            <div>
              <h2>演示数据维护</h2>
              <span>管理员调试面板</span>
            </div>
          </div>
          <button type="button" class="data-admin__close" aria-label="关闭数据维护面板" @click="close">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <div class="data-admin__body">
          <div v-if="!status" class="data-admin__loading">数据状态加载中</div>
          <template v-else>
            <div class="data-admin__status">
              <div class="data-admin__status-item">
                <span>模拟运行</span>
                <b :class="{ 'is-off': !status.running }">{{ status.running ? '运行中' : '已停止' }}</b>
              </div>
              <div class="data-admin__status-item">
                <span>周期更新</span>
                <b :class="{ 'is-off': status.paused }">{{ status.paused ? '已暂停' : '正常' }}</b>
              </div>
              <div class="data-admin__status-item">
                <span>异常注入</span>
                <b :class="{ 'is-danger': status.simError }">{{ status.simError ? '已注入' : '正常' }}</b>
              </div>
              <div class="data-admin__status-item">
                <span>更新时间</span>
                <b class="is-time">{{ updatedText }}</b>
              </div>
            </div>

            <div class="data-admin__counts">
              <div v-for="item in countItems" :key="item.label" class="data-admin__count">
                <b>{{ item.value }}</b>
                <span>{{ item.label }}</span>
              </div>
            </div>

            <p v-if="status.lastError" class="data-admin__error" role="status">
              {{ status.lastError }}
            </p>

            <div class="data-admin__actions">
              <button type="button" class="data-admin__btn" :disabled="refreshing" @click="handleRefresh">
                <el-icon><RefreshRight /></el-icon>
                <span>刷新数据</span>
              </button>
              <button type="button" class="data-admin__btn" :disabled="busy" @click="handlePause">
                <el-icon><VideoPause /></el-icon>
                <span>{{ status.paused ? '恢复更新' : '暂停更新' }}</span>
              </button>
              <button
                type="button"
                class="data-admin__btn data-admin__btn--danger"
                :disabled="busy"
                @click="handleError"
              >
                <el-icon><Warning /></el-icon>
                <span>{{ status.simError ? '清除异常' : '注入异常' }}</span>
              </button>
            </div>
          </template>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 演示数据维护面板：数据刷新、暂停恢复、异常注入与运行状态查看。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { Close, RefreshRight, Setting, VideoPause, Warning } from '@element-plus/icons-vue'
import {
  getMaritimeStatus,
  injectMaritimeError,
  pauseMaritimeData,
  refreshMaritimeData,
} from '@/api/maritime'
import { useMaritimeUiStore } from '@/stores/maritimeUi'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'
import type { MaritimeStatus } from '@/types/maritime'

const STATUS_POLL_MS = 5000

const uiStore = useMaritimeUiStore()
const { scale } = useMaritimeScreen()
const status = ref<MaritimeStatus | null>(null)
const refreshing = ref(false)
const busy = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const panelStyle = computed(() => ({ transform: `translate(-50%, -50%) scale(${scale.value})` }))

const countItems = computed(() => {
  const current = status.value
  return [
    { label: '融合目标', value: current?.targetCount ?? 0 },
    { label: '来源上报', value: current?.sourceCount ?? 0 },
    { label: '轨迹点数', value: current?.trackCount ?? 0 },
    { label: '告警事件', value: current?.alarmCount ?? 0 },
  ]
})

const updatedText = computed(() => {
  const value = status.value?.updatedAt
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})

async function loadStatus() {
  try {
    status.value = await getMaritimeStatus()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '数据状态获取失败')
  }
}

async function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await refreshMaritimeData()
    ElMessage.success('演示数据已刷新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '数据刷新失败，正在使用最近数据')
  } finally {
    refreshing.value = false
    await loadStatus()
  }
}

async function handlePause() {
  if (busy.value || !status.value) return
  busy.value = true
  try {
    status.value = await pauseMaritimeData(!status.value.paused)
    ElMessage.success(status.value.paused ? '演示数据已暂停更新' : '演示数据已恢复更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态更新失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

async function handleError() {
  if (busy.value || !status.value) return
  busy.value = true
  try {
    status.value = await injectMaritimeError(!status.value.simError)
    ElMessage.success(status.value.simError ? '演示异常已注入' : '演示异常已清除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '异常状态更新失败，请稍后重试')
  } finally {
    busy.value = false
  }
}

function close() {
  uiStore.setDataAdminOpen(false)
}

onMounted(() => {
  void loadStatus()
  timer = setInterval(() => void loadStatus(), STATUS_POLL_MS)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.data-admin-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 10, 20, 0.66);
  --mar-panel: rgba(8, 22, 40, 0.97);
  --mar-line: rgba(64, 157, 255, 0.28);
  --mar-line-soft: rgba(64, 157, 255, 0.14);
  --mar-text: #e8f3ff;
  --mar-text-dim: #8fb0d0;
  --mar-text-faint: #5f7f9f;
  --mar-accent: #38c6ff;
  --mar-amber: #f5b84b;
  --mar-red: #ff6b6b;
  --mar-green: #35e0a8;
}

.data-admin {
  position: fixed;
  top: 50%;
  left: 50%;
  width: 560px;
  overflow: hidden;
  color: var(--mar-text);
  background: var(--mar-panel);
  border: 1px solid var(--mar-line);
  border-radius: 10px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}

.data-admin__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 58px;
  padding: 0 18px 0 20px;
  background: linear-gradient(90deg, rgba(56, 198, 255, 0.14), transparent 68%);
  border-bottom: 1px solid var(--mar-line-soft);
}

.data-admin__title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--mar-accent);
}

.data-admin__title .el-icon {
  font-size: 20px;
}

.data-admin__title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.data-admin__title span {
  display: block;
  margin-top: 2px;
  color: var(--mar-text-faint);
  font-size: 12px;
}

.data-admin__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--mar-text-dim);
  background: transparent;
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
  cursor: pointer;
}

.data-admin__close:hover {
  color: var(--mar-text);
  border-color: var(--mar-line);
}

.data-admin__body {
  padding: 16px 18px 18px;
}

.data-admin__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  color: var(--mar-text-faint);
  font-size: 13px;
}

.data-admin__status {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.data-admin__status-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(13, 34, 58, 0.55);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.data-admin__status-item span {
  color: var(--mar-text-faint);
  font-size: 11px;
}

.data-admin__status-item b {
  color: var(--mar-green);
  font-size: 14px;
  font-weight: 600;
}

.data-admin__status-item b.is-off {
  color: var(--mar-text-dim);
}

.data-admin__status-item b.is-danger {
  color: var(--mar-red);
}

.data-admin__status-item b.is-time {
  color: var(--mar-accent);
  font-size: 12px;
}

.data-admin__counts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.data-admin__count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  background: rgba(4, 16, 30, 0.72);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.data-admin__count b {
  color: var(--mar-accent);
  font-size: 20px;
  font-weight: 700;
  font-family: 'DIN Alternate', 'PingFang SC', sans-serif;
}

.data-admin__count span {
  color: var(--mar-text-dim);
  font-size: 11px;
}

.data-admin__error {
  margin: 10px 0 0;
  padding: 8px 10px;
  color: var(--mar-amber);
  font-size: 12px;
  background: rgba(245, 184, 75, 0.08);
  border-left: 2px solid var(--mar-amber);
}

.data-admin__actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.data-admin__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  height: 36px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.6);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.data-admin__btn:hover:not(:disabled) {
  color: var(--mar-text);
  border-color: var(--mar-line);
  background: rgba(56, 198, 255, 0.1);
}

.data-admin__btn--danger:hover:not(:disabled) {
  color: var(--mar-red);
  border-color: rgba(255, 107, 107, 0.6);
  background: rgba(255, 107, 107, 0.1);
}

.data-admin__btn:disabled {
  color: var(--mar-text-faint);
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
