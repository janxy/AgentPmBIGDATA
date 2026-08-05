<template>
  <div class="maritime-viewport">
    <div
      class="maritime-stage"
      :class="{ 'maritime-stage--compact': isCompact }"
      :style="{ transform: `translate(-50%, -50%) scale(${scale})` }"
    >
      <div class="maritime-grid">
        <MaritimeHeader
          class="maritime-header"
          :total="totalTargets"
          :source-counts="sourceCounts"
          :alarm-count="alarmPendingCount"
          :fullscreen="fullscreen"
          :refreshing="refreshing"
          :data-status="dataStatus"
          @refresh="handleRefresh"
          @toggle-fullscreen="toggleFullscreen"
          @open-law-enforce="uiStore.setLawEnforceOpen(true)"
          @open-data-admin="uiStore.setDataAdminOpen(true)"
          @simulate-alarm="handleSimulateAlarm"
        />

        <TargetMonitorPanel class="maritime-left" />

        <div class="maritime-map-wrap">
          <MaritimeMap />
          <ViewToolbar class="maritime-toolbar" />
        </div>

        <TargetDetailPanel class="maritime-right" />
        <AlarmScrollBar class="maritime-alarm" />
        <DataAdminPanel v-if="uiStore.dataAdminOpen" />
        <LawEnforcePanel v-if="uiStore.lawEnforceOpen" />
      </div>
    </div>
    <div
      v-if="alarmFlashCount > 0"
      :key="alarmFlashCount"
      class="maritime-alarm-flash"
      aria-hidden="true"
      @animationend="alarmFlashCount = 0"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 海上全域感知大屏入口：以 1920×1080 等比缩放的独立全屏页面组织
 * 顶部状态区、目标监控、地图态势、目标详情、告警滚动与视图工具区域。
 */
import MaritimeHeader from './components/MaritimeHeader.vue'
import TargetMonitorPanel from './components/TargetMonitorPanel.vue'
import MaritimeMap from './components/MaritimeMap.vue'
import ViewToolbar from './components/ViewToolbar.vue'
import TargetDetailPanel from './components/TargetDetailPanel.vue'
import AlarmScrollBar from './components/AlarmScrollBar.vue'
import DataAdminPanel from './components/DataAdminPanel.vue'
import LawEnforcePanel from './components/LawEnforcePanel.vue'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'
import { onBeforeUnmount, onMounted, computed, ref } from 'vue'
import { subscribeMaritimeUpdates } from '@/api/maritime'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { useMaritimeAlarmsStore } from '@/stores/maritimeAlarms'
import { useMaritimeUiStore } from '@/stores/maritimeUi'

const { scale, isCompact, fullscreen, toggleFullscreen } = useMaritimeScreen()
const uiStore = useMaritimeUiStore()
const targetsStore = useMaritimeTargetsStore()
const alarmsStore = useMaritimeAlarmsStore()

const totalTargets = computed(() => targetsStore.targets.length)
const sourceCounts = computed(() => targetsStore.sourceCounts)
const alarmPendingCount = computed(() => alarmsStore.pendingCount)
const refreshing = computed(() => targetsStore.refreshing || alarmsStore.refreshing)
const dataStatus = computed(() => targetsStore.errorMessage || alarmsStore.errorMessage)
const alarmFlashCount = ref(0)

const handleSimulateAlarm = () => {
  alarmFlashCount.value += 1
}

const handleRefresh = async () => {
  await Promise.all([targetsStore.refresh(), alarmsStore.refresh()])
}

let unsubscribe: (() => void) | null = null

onMounted(() => {
  void targetsStore.loadInitial()
  void alarmsStore.loadInitial()
  unsubscribe = subscribeMaritimeUpdates(() => {
    void targetsStore.refresh()
    void alarmsStore.refresh()
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})
</script>

<style scoped>
.maritime-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #020a14;
  --mar-bg: #040d19;
  --mar-panel: rgba(8, 22, 40, 0.9);
  --mar-panel-strong: rgba(10, 28, 50, 0.95);
  --mar-line: rgba(64, 157, 255, 0.28);
  --mar-line-soft: rgba(64, 157, 255, 0.14);
  --mar-text: #e8f3ff;
  --mar-text-dim: #8fb0d0;
  --mar-text-faint: #5f7f9f;
  --mar-accent: #38c6ff;
  --mar-accent-2: #2dd4bf;
  --mar-amber: #f5b84b;
  --mar-red: #ff6b6b;
  --mar-green: #35e0a8;
}

.maritime-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1920px;
  height: 1080px;
  transform-origin: center center;
}

.maritime-grid {
  position: relative;
  display: grid;
  width: 1920px;
  height: 1080px;
  padding: 12px 14px 14px;
  gap: 12px;
  grid-template-columns: 304px minmax(0, 1fr) 356px;
  grid-template-rows: 76px minmax(0, 1fr) 118px;
  grid-template-areas:
    'header header header'
    'left map right'
    'alarm alarm alarm';
}

.maritime-header {
  grid-area: header;
}

.maritime-left {
  grid-area: left;
}

.maritime-map-wrap {
  position: relative;
  grid-area: map;
  min-width: 0;
  min-height: 0;
}

.maritime-right {
  grid-area: right;
}

.maritime-alarm {
  grid-area: alarm;
}

.maritime-toolbar {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 30;
}

/* 最小尺寸时收起右侧详情面板，保证地图主区域可见 */
.maritime-stage--compact .maritime-grid {
  grid-template-columns: 304px minmax(0, 1fr);
  grid-template-areas:
    'header header'
    'left map'
    'alarm alarm';
}

.maritime-stage--compact .maritime-right {
  display: none;
}

@media (max-width: 1400px) {
  .maritime-grid {
    grid-template-columns: 272px minmax(0, 1fr) 320px;
  }
}

@media (max-width: 1400px) {
  .maritime-stage--compact .maritime-grid {
    grid-template-columns: 272px minmax(0, 1fr);
  }
}

.maritime-alarm-flash {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(255, 42, 42, 0.72), rgba(255, 0, 0, 0.4));
  mix-blend-mode: screen;
  animation: maritime-alarm-flash 1.2s ease-out both;
}

@keyframes maritime-alarm-flash {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 0.78;
  }
  26% {
    opacity: 0.12;
  }
  42% {
    opacity: 0.62;
  }
  56% {
    opacity: 0.08;
  }
  78% {
    opacity: 0.36;
  }
  100% {
    opacity: 0;
  }
}
</style>
