<template>
  <div class="alarm-dialog-mask" @click.self="closeDialog">
    <section class="alarm-dialog" :style="dialogStyle" aria-label="告警列表与详情">
      <header class="alarm-dialog__head">
        <div class="alarm-dialog__title">
          <el-icon><Bell /></el-icon>
          <div>
            <h2>告警事件</h2>
            <span>共 {{ alarmsStore.filteredAlarms.length }} 条 · 待处置 {{ alarmsStore.pendingCount }}</span>
          </div>
        </div>
        <button type="button" class="alarm-dialog__close" aria-label="关闭告警弹层" @click="closeDialog">
          <el-icon><Close /></el-icon>
        </button>
      </header>

      <div class="alarm-dialog__body">
        <aside class="alarm-list">
          <div class="alarm-filter">
            <span class="alarm-filter__label">等级筛选</span>
            <div class="alarm-filter__chips">
              <button
                type="button"
                class="alarm-filter__chip"
                :class="{ 'is-active': alarmsStore.levelFilter.length === 0 }"
                @click="alarmsStore.setLevelFilter([])"
              >
                全部
              </button>
              <button
                v-for="level in ALARM_LEVEL_OPTIONS"
                :key="level"
                type="button"
                class="alarm-filter__chip"
                :class="{
                  'is-active': alarmsStore.levelFilter.includes(level),
                  [`is-${level}`]: true,
                }"
                @click="toggleLevel(level)"
              >
                {{ ALARM_LEVEL_LABELS[level] }}
              </button>
            </div>
          </div>

          <div v-if="alarmsStore.loading && alarmsStore.alarms.length === 0" class="alarm-list__empty">
            告警数据加载中
          </div>
          <div v-else-if="alarmsStore.errorMessage" class="alarm-list__empty alarm-list__empty--error">
            {{ alarmsStore.errorMessage }}
          </div>
          <div v-else-if="alarmsStore.filteredAlarms.length === 0" class="alarm-list__empty">
            暂无符合条件的告警
          </div>
          <div v-else class="alarm-list__scroll">
            <button
              v-for="alarm in alarmsStore.filteredAlarms"
              :key="alarm.id"
              type="button"
              class="alarm-row"
              :class="{
                'is-active': alarm.id === alarmsStore.selectedAlarmId,
                [`is-${alarm.level}`]: true,
              }"
              @click="selectRow(alarm)"
            >
              <i class="alarm-row__dot" />
              <span class="alarm-row__main">
                <strong>{{ ALARM_TYPE_LABELS[alarm.type] }}</strong>
                <span>{{ alarm.targetName }}</span>
              </span>
              <span class="alarm-row__meta">
                <em>{{ DISPOSE_STATUS_LABELS[alarm.status] }}</em>
                <time>{{ formatTime(alarm.occurredAt) }}</time>
              </span>
            </button>
          </div>
        </aside>

        <section class="alarm-detail">
          <div v-if="!selectedAlarm" class="alarm-detail__empty">
            <el-icon><Bell /></el-icon>
            <p>请选择告警查看详情</p>
          </div>
          <template v-else>
            <header class="alarm-detail__head">
              <span class="alarm-detail__level" :class="`is-${selectedAlarm.level}`">
                {{ ALARM_LEVEL_LABELS[selectedAlarm.level] }}
              </span>
              <h3>{{ ALARM_TYPE_LABELS[selectedAlarm.type] }}</h3>
              <span class="alarm-detail__status" :class="`is-${selectedAlarm.status}`">
                {{ DISPOSE_STATUS_LABELS[selectedAlarm.status] }}
              </span>
            </header>

            <dl class="alarm-detail__grid">
              <div>
                <dt>目标名称</dt>
                <dd>{{ selectedAlarm.targetName }}</dd>
              </div>
              <div>
                <dt>MMSI</dt>
                <dd>{{ selectedAlarm.targetMmsi || '-' }}</dd>
              </div>
              <div>
                <dt>发生时间</dt>
                <dd>{{ formatTime(selectedAlarm.occurredAt) }}</dd>
              </div>
              <div>
                <dt>告警位置</dt>
                <dd>{{ positionText(selectedAlarm) }}</dd>
              </div>
            </dl>
            <p class="alarm-detail__desc">{{ selectedAlarm.description }}</p>

            <div class="alarm-detail__actions">
              <button type="button" class="alarm-action alarm-action--primary" @click="handleLocate">
                <el-icon><Aim /></el-icon>
                <span>定位目标</span>
              </button>
              <button
                v-if="relatedTarget"
                type="button"
                class="alarm-action"
                @click="handleOpenTarget"
              >
                <el-icon><User /></el-icon>
                <span>查看目标详情</span>
              </button>
              <button
                v-if="selectedAlarm.status === 'pending'"
                type="button"
                class="alarm-action alarm-action--dispose"
                @click="handleStartDispose"
              >
                <el-icon><Check /></el-icon>
                <span>发起处置</span>
              </button>
              <button
                v-else-if="selectedAlarm.status === 'processing'"
                type="button"
                class="alarm-action alarm-action--dispose"
                @click="handleCompleteDispose"
              >
                <el-icon><CircleCheck /></el-icon>
                <span>标记完成</span>
              </button>
              <button
                v-else-if="selectedAlarm.status === 'done'"
                type="button"
                class="alarm-action alarm-action--dispose"
                @click="handleReviewDispose"
              >
                <el-icon><CircleCheck /></el-icon>
                <span>复核处置</span>
              </button>
              <span v-else class="alarm-detail__reviewed">已复核，不可再次发起处置</span>
            </div>

            <p v-if="targetsLoading" class="alarm-detail__tip">
              目标数据加载中，稍后可查看目标详情
            </p>
            <p v-else-if="!relatedTarget" class="alarm-detail__tip">
              关联目标不存在，仅可查看告警信息
            </p>
          </template>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 告警列表与详情弹层：等级筛选、处置流转与地图定位联动。
 */
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { Aim, Bell, Check, CircleCheck, Close, User } from '@element-plus/icons-vue'
import { useMaritimeAlarmsStore } from '@/stores/maritimeAlarms'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { useMaritimeUiStore } from '@/stores/maritimeUi'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'
import { useAlarmLocate } from '@/composables/useAlarmLocate'
import {
  ALARM_LEVEL_LABELS,
  ALARM_LEVEL_OPTIONS,
  ALARM_TYPE_LABELS,
  DISPOSE_STATUS_LABELS,
} from '@/types/maritime'
import type { AlarmEvent, AlarmLevel } from '@/types/maritime'
import './alarm-list-dialog.css'

const alarmsStore = useMaritimeAlarmsStore()
const targetsStore = useMaritimeTargetsStore()
const uiStore = useMaritimeUiStore()
const { locateAlarm } = useAlarmLocate()
const { scale } = useMaritimeScreen()

const selectedAlarm = computed(() =>
  alarmsStore.alarms.find((alarm) => alarm.id === alarmsStore.selectedAlarmId) ?? null,
)
const relatedTarget = computed(() =>
  selectedAlarm.value
    ? targetsStore.targets.find((target) => target.id === selectedAlarm.value?.targetId) ?? null
    : null,
)
const targetsLoading = computed(() => !targetsStore.loaded)
const dialogStyle = computed(() => ({ transform: `translate(-50%, -50%) scale(${scale.value})` }))

onMounted(() => {
  if (!alarmsStore.selectedAlarmId && alarmsStore.filteredAlarms.length > 0) {
    alarmsStore.selectAlarm(alarmsStore.filteredAlarms[0].id)
  }
})

function toggleLevel(level: AlarmLevel) {
  const current = alarmsStore.levelFilter
  alarmsStore.setLevelFilter(
    current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
  )
  const filteredIds = new Set(alarmsStore.filteredAlarms.map((alarm) => alarm.id))
  if (alarmsStore.selectedAlarmId && !filteredIds.has(alarmsStore.selectedAlarmId)) {
    alarmsStore.clearSelection()
  }
}

function selectRow(alarm: AlarmEvent) {
  alarmsStore.selectAlarm(alarm.id)
}

function handleLocate() {
  if (selectedAlarm.value) locateAlarm(selectedAlarm.value, false)
}

function handleOpenTarget() {
  const target = relatedTarget.value
  if (!target) return
  targetsStore.selectTarget(target.id)
  closeDialog()
}

async function handleStartDispose() {
  if (!selectedAlarm.value) return
  const success = await alarmsStore.startDispose(selectedAlarm.value.id)
  if (success) ElMessage.success('处置已发起')
}

async function handleCompleteDispose() {
  if (!selectedAlarm.value) return
  const success = await alarmsStore.completeDispose(selectedAlarm.value.id)
  if (success) ElMessage.success('处置已完成')
}

async function handleReviewDispose() {
  if (!selectedAlarm.value) return
  const success = await alarmsStore.reviewDispose(selectedAlarm.value.id)
  if (success) ElMessage.success('处置已复核')
}

function closeDialog() {
  uiStore.setAlarmListOpen(false)
  alarmsStore.setLevelFilter([])
  alarmsStore.clearSelection()
}

function positionText(alarm: AlarmEvent) {
  if (!Number.isFinite(alarm.lon) || !Number.isFinite(alarm.lat)) return '位置缺失'
  const lonHemi = alarm.lon >= 0 ? 'E' : 'W'
  const latHemi = alarm.lat >= 0 ? 'N' : 'S'
  return `${Math.abs(alarm.lon).toFixed(4)}°${lonHemi}  ${Math.abs(alarm.lat).toFixed(4)}°${latHemi}`
}

function formatTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>
