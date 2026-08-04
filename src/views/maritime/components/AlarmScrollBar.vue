<template>
  <section class="alarm-bar">
    <header class="alarm-bar__head">
      <el-icon><Bell /></el-icon>
      <div class="alarm-bar__title">
        <h2>告警事件</h2>
        <span>待处置 {{ alarmsStore.pendingCount }}</span>
      </div>
    </header>

    <div class="alarm-bar__body">
      <div v-if="alarmsStore.loading && alarmsStore.alarms.length === 0" class="alarm-bar__empty">
        告警数据加载中
      </div>
      <div v-else-if="alarmsStore.errorMessage" class="alarm-bar__empty alarm-bar__empty--error">
        {{ alarmsStore.errorMessage }}
      </div>
      <div v-else-if="recentAlarms.length === 0" class="alarm-bar__empty">
        暂无告警数据
      </div>
      <div v-else class="alarm-ticker">
        <div class="alarm-ticker__viewport">
          <div class="alarm-ticker__track">
            <button
              v-for="(alarm, index) in recentAlarms"
              :key="`${alarm.id}-${index}`"
              type="button"
              class="alarm-ticker__item"
              :class="[`is-${alarm.level}`, { 'is-new': isFresh(alarm) }]"
              @click="handleOpenAlarm(alarm)"
            >
              <i class="alarm-ticker__dot" />
              <span class="alarm-ticker__type">{{ ALARM_TYPE_LABELS[alarm.type] }}</span>
              <strong>{{ alarm.targetName }}</strong>
              <time>{{ shortTime(alarm.occurredAt) }}</time>
            </button>
          </div>
        </div>
        <span v-if="!hasFreshAlarm" class="alarm-bar__quiet">暂无新增告警</span>
      </div>
    </div>

    <div class="alarm-bar__actions">
      <span class="alarm-bar__meta">最近 16 条</span>
      <button type="button" class="alarm-bar__more" @click="uiStore.setAlarmListOpen(true)">
        <el-icon><List /></el-icon>
        <span>查看全部</span>
      </button>
    </div>

    <Teleport to="body">
      <AlarmListDialog v-if="uiStore.alarmListOpen" />
    </Teleport>
  </section>
</template>

<script setup lang="ts">
/**
 * 底部告警两行流：最新 16 条告警两行排布、地图定位与告警详情入口。
 */
import { computed } from 'vue'
import { Bell, List } from '@element-plus/icons-vue'
import AlarmListDialog from './AlarmListDialog.vue'
import { useMaritimeAlarmsStore } from '@/stores/maritimeAlarms'
import { useMaritimeUiStore } from '@/stores/maritimeUi'
import { useAlarmLocate } from '@/composables/useAlarmLocate'
import { ALARM_TYPE_LABELS } from '@/types/maritime'
import type { AlarmEvent } from '@/types/maritime'

const FRESH_MS = 60 * 1000

const alarmsStore = useMaritimeAlarmsStore()
const uiStore = useMaritimeUiStore()
const { locateAlarm } = useAlarmLocate()
const recentAlarms = computed(() => alarmsStore.recentAlarms)
const hasFreshAlarm = computed(() => recentAlarms.value.some((alarm) => isFresh(alarm)))

function isFresh(alarm: AlarmEvent) {
  return Date.now() - Date.parse(alarm.occurredAt) < FRESH_MS
}

function handleOpenAlarm(alarm: AlarmEvent) {
  alarmsStore.selectAlarm(alarm.id)
  locateAlarm(alarm, false)
  uiStore.setAlarmListOpen(true)
}

function shortTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>

<style scoped>
.alarm-bar {
  display: flex;
  align-items: stretch;
  min-width: 0;
  min-height: 0;
  color: var(--mar-text);
  background: var(--mar-panel);
  border: 1px solid var(--mar-line);
  border-radius: 8px;
  overflow: hidden;
}

.alarm-bar__head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 150px;
  padding: 0 16px;
  flex-shrink: 0;
  color: var(--mar-accent);
  background: linear-gradient(90deg, rgba(56, 198, 255, 0.1), transparent);
  border-right: 1px solid var(--mar-line-soft);
}

.alarm-bar__head > .el-icon {
  font-size: 20px;
}

.alarm-bar__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.alarm-bar__title span {
  display: block;
  margin-top: 3px;
  color: var(--mar-amber);
  font-size: 12px;
}

.alarm-bar__body {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding: 0 12px;
}

.alarm-bar__empty {
  padding-left: 6px;
  color: var(--mar-text-faint);
  font-size: 13px;
}

.alarm-bar__empty--error {
  color: var(--mar-amber);
}

.alarm-ticker {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.alarm-ticker__viewport {
  overflow-x: hidden;
  overflow-y: hidden;
  flex: 1;
  min-width: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(64, 157, 255, 0.35) transparent;
}

.alarm-ticker__track {
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(2, 40px);
  gap: 8px 10px;
  width: 100%;
}

.alarm-ticker__item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 8px;
  min-width: 0;
  color: var(--mar-text-dim);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  background: rgba(13, 34, 58, 0.6);
  border: 1px solid var(--mar-line-soft);
  border-radius: 6px;
}

.alarm-ticker__item:hover {
  color: var(--mar-text);
  border-color: var(--mar-line);
  background: rgba(56, 198, 255, 0.12);
}

.alarm-ticker__item.is-urgent {
  background: rgba(255, 107, 107, 0.16);
  border-color: rgba(255, 107, 107, 0.45);
}

.alarm-ticker__item.is-important {
  background: rgba(245, 184, 75, 0.14);
  border-color: rgba(245, 184, 75, 0.42);
}

.alarm-ticker__item.is-normal {
  background: rgba(53, 224, 168, 0.12);
  border-color: rgba(53, 224, 168, 0.4);
}

.alarm-ticker__item.is-new {
  animation: alarm-flash 1.6s ease-in-out 2;
}

.alarm-ticker__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--mar-green);
  flex-shrink: 0;
}

.alarm-ticker__item.is-urgent .alarm-ticker__dot {
  background: var(--mar-red);
  box-shadow: 0 0 8px var(--mar-red);
}

.alarm-ticker__item.is-important .alarm-ticker__dot {
  background: var(--mar-amber);
  box-shadow: 0 0 8px var(--mar-amber);
}

.alarm-ticker__type {
  color: var(--mar-text-faint);
}

.alarm-ticker__item strong {
  min-width: 0;
  color: var(--mar-text);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alarm-ticker__item time {
  color: var(--mar-text-faint);
  font-size: 11px;
  flex-shrink: 0;
}

.alarm-bar__quiet {
  position: absolute;
  right: 12px;
  bottom: 8px;
  padding: 3px 8px;
  color: var(--mar-text-faint);
  font-size: 11px;
  background: rgba(4, 13, 25, 0.82);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
  pointer-events: none;
}

.alarm-bar__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 148px;
  padding: 0 12px;
  flex-shrink: 0;
  border-left: 1px solid var(--mar-line-soft);
}

.alarm-bar__meta {
  color: var(--mar-text-faint);
  font-size: 11px;
}

.alarm-bar__more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  color: var(--mar-text-dim);
  font-size: 12px;
  cursor: pointer;
  background: rgba(18, 44, 74, 0.8);
  border: 1px solid var(--mar-line);
  border-radius: 6px;
}

.alarm-bar__more:hover {
  color: var(--mar-text);
  border-color: var(--mar-accent);
  background: rgba(56, 198, 255, 0.14);
}

@keyframes alarm-flash {
  0%,
  100% {
    border-color: var(--mar-line-soft);
  }
  50% {
    border-color: var(--mar-accent);
    box-shadow: 0 0 12px rgba(56, 198, 255, 0.35);
  }
}
</style>
