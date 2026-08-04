<template>
  <section class="maritime-panel target-detail">
    <header class="panel-head">
      <h2>目标详情</h2>
      <span v-if="selectedName" class="panel-head__meta">{{ selectedName }}</span>
    </header>

    <div v-if="!hasSelection" class="panel-empty">
      <el-icon><Location /></el-icon>
      <p>未选中目标</p>
      <span>请在海图或目标监控中点击目标</span>
    </div>

    <div v-else-if="detail" class="td-scroll">
      <section class="td-section">
        <h3><el-icon><Document /></el-icon>基本信息</h3>
        <dl class="td-grid">
          <div class="td-field">
            <dt>船名</dt>
            <dd>{{ text(detail.name) }}</dd>
          </div>
          <div class="td-field">
            <dt>MMSI</dt>
            <dd>{{ text(detail.mmsi) }}</dd>
          </div>
          <div class="td-field">
            <dt>呼号</dt>
            <dd>{{ text(detail.callSign) }}</dd>
          </div>
          <div class="td-field">
            <dt>类型</dt>
            <dd>{{ detail.type ? TARGET_TYPE_LABELS[detail.type] : '暂无数据' }}</dd>
          </div>
          <div class="td-field">
            <dt>国籍</dt>
            <dd>{{ text(detail.nationality) }}</dd>
          </div>
          <div class="td-field">
            <dt>尺寸</dt>
            <dd>{{ sizeText }}</dd>
          </div>
          <div class="td-field">
            <dt>吃水</dt>
            <dd>{{ draftText }}</dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Monitor /></el-icon>实时动态</h3>
        <dl class="td-grid">
          <div class="td-field td-field--span2">
            <dt>经纬度</dt>
            <dd>{{ positionText }}</dd>
          </div>
          <div class="td-field">
            <dt>目标状态</dt>
            <dd>
              <span class="td-status" :class="`is-${detail.status}`">
                {{ TARGET_STATUS_LABELS[detail.status] }}
              </span>
            </dd>
          </div>
          <div class="td-field">
            <dt>航速</dt>
            <dd>{{ numberText(detail.speed, ' kn') }}</dd>
          </div>
          <div class="td-field">
            <dt>航向</dt>
            <dd>{{ numberText(detail.course, '°') }}</dd>
          </div>
          <div class="td-field">
            <dt>更新时间</dt>
            <dd>{{ formatTime(detail.lastUpdate) }}</dd>
          </div>
        </dl>
        <div v-if="detail.status !== 'online'" class="td-tip td-tip--warn">
          目标数据已超时，显示最近上报信息
        </div>
      </section>

      <section class="td-section">
        <h3><el-icon><Connection /></el-icon>来源融合</h3>
        <div class="td-sources">
          <div v-for="option in sourceOptions" :key="option.value" class="td-source">
            <span class="td-source__name">{{ option.label }}</span>
            <span v-if="!latestReports[option.value]" class="td-source__empty">无上报</span>
            <template v-else>
              <span class="td-source__quality" :class="`is-${latestReports[option.value]!.quality}`">
                {{ DATA_QUALITY_LABELS[latestReports[option.value]!.quality] }}
              </span>
              <span class="td-source__time">{{ formatTime(latestReports[option.value]!.reportTime) }}</span>
              <span v-if="isStale(latestReports[option.value]!.reportTime)" class="td-source__stale">超时</span>
            </template>
          </div>
        </div>
        <div v-if="detail.sources.length === 0" class="td-tip td-tip--warn">
          该目标暂无有效来源上报，仅保留基本占位信息
        </div>
      </section>

      <section ref="trajectoryRef" class="td-section" :class="{ 'is-emphasized': emphasizeTrajectory }">
        <h3><el-icon><TrendCharts /></el-icon>轨迹概览</h3>
        <div v-if="!hasPosition" class="td-trajectory-empty">
          暂无位置信息
        </div>
        <div v-else-if="targetsStore.track.length < 2" class="td-trajectory-empty">
          轨迹数据不足
        </div>
        <template v-else>
          <div class="td-trajectory-head">
            <span>{{ trajectoryRangeText }}</span>
            <span v-if="detail.status === 'offline'">目标已离线，展示最近轨迹</span>
          </div>
          <div class="td-trajectory-chart">
            <svg :viewBox="trajectoryViewBox" role="img" aria-label="目标最近轨迹折线">
              <polyline
                class="td-trajectory-line"
                :points="trajectoryPoints"
              />
              <circle
                v-for="point in trajectoryKeyDots"
                :key="point.id"
                class="td-trajectory-dot"
                :cx="point.x"
                :cy="point.y"
                :r="point.key ? 3.2 : 1.6"
              >
                <title>{{ keyDotTitle(point) }}</title>
              </circle>
            </svg>
          </div>
          <div class="td-key-points">
            <button
              v-for="point in trajectoryKeyPoints"
              :key="point.id"
              type="button"
              class="td-key-point"
              :title="keyDotTitle(point)"
            >
              <b>{{ point.label }}</b>
              <span>{{ keyPointText(point) }}</span>
            </button>
          </div>
          <div v-if="hasTrackGap" class="td-tip">轨迹存在数据缺失，缺失点位已使用相邻点连线</div>
          <div v-if="targetsStore.errorMessage" class="td-tip">
            轨迹刷新失败，正在使用最近数据
          </div>
        </template>
      </section>

      <section class="td-section">
        <h3><el-icon><Operation /></el-icon>快捷操作</h3>
        <div class="td-actions">
          <button type="button" class="td-action" @click="handleLocate">
            <el-icon><Aim /></el-icon>
            <span>定位</span>
          </button>
          <button
            type="button"
            class="td-action"
            :class="{ 'is-active': tracking }"
            @click="handleFollow"
          >
            <el-icon><Guide /></el-icon>
            <span>{{ tracking ? '跟踪中' : '跟踪' }}</span>
          </button>
          <button type="button" class="td-action" @click="handleShowTrajectory">
            <el-icon><TrendCharts /></el-icon>
            <span>查看轨迹</span>
          </button>
          <button type="button" class="td-action td-action--alarm" @click="handleDispose">
            <el-icon><Bell /></el-icon>
            <span>告警处置</span>
          </button>
        </div>
        <div ref="alarmListRef" class="td-alarms">
          <div v-if="pendingAlarms.length === 0" class="td-alarms__empty">该目标暂无关联告警</div>
          <button
            v-for="alarm in pendingAlarms"
            :key="alarm.id"
            type="button"
            class="td-alarm"
            @click="handleAlarmClick(alarm)"
          >
            <span class="td-alarm__level" :class="`is-${alarm.level}`">
              {{ ALARM_LEVEL_LABELS[alarm.level] }}
            </span>
            <span class="td-alarm__type">{{ ALARM_TYPE_LABELS[alarm.type] }}</span>
            <span class="td-alarm__time">{{ formatTime(alarm.occurredAt) }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="radarDetail" class="td-scroll">
      <section class="td-section">
        <h3><el-icon><Document /></el-icon>基本信息</h3>
        <dl class="td-grid">
          <div class="td-field">
            <dt>名称</dt>
            <dd>{{ text(radarDetail.name) }}</dd>
          </div>
          <div class="td-field">
            <dt>编号</dt>
            <dd>{{ text(radarDetail.id) }}</dd>
          </div>
          <div class="td-field">
            <dt>设备状态</dt>
            <dd>
              <span class="td-status" :class="radarDetail.online ? 'is-online' : 'is-offline'">
                {{ radarDetail.online ? '在线' : '离线' }}
              </span>
            </dd>
          </div>
          <div class="td-field">
            <dt>覆盖范围</dt>
            <dd>{{ numberText(radarDetail.radiusKm, ' km') }}</dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Monitor /></el-icon>实时动态</h3>
        <dl class="td-grid">
          <div class="td-field td-field--span2">
            <dt>经纬度</dt>
            <dd>{{ categoryPositionText(radarDetail.lon, radarDetail.lat) }}</dd>
          </div>
          <div class="td-field">
            <dt>更新时间</dt>
            <dd>{{ formatTime(radarDetail.lastUpdate) }}</dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Operation /></el-icon>快捷操作</h3>
        <div class="td-actions td-actions--single">
          <button type="button" class="td-action" @click="locateMonitorItem(radarDetail)">
            <el-icon><Aim /></el-icon>
            <span>定位</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="eoDetail" class="td-scroll">
      <section class="td-section">
        <h3><el-icon><Document /></el-icon>基本信息</h3>
        <dl class="td-grid">
          <div class="td-field">
            <dt>名称</dt>
            <dd>{{ text(eoDetail.name) }}</dd>
          </div>
          <div class="td-field">
            <dt>编号</dt>
            <dd>{{ text(eoDetail.id) }}</dd>
          </div>
          <div class="td-field">
            <dt>设备状态</dt>
            <dd>
              <span class="td-status" :class="eoDetail.online ? 'is-online' : 'is-offline'">
                {{ eoDetail.online ? '在线' : '离线' }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><VideoCamera /></el-icon>实时画面</h3>
        <div class="td-camera-feed">
          <video class="td-camera-feed__video" muted playsinline></video>
          <span class="td-camera-feed__live"><i></i>LIVE</span>
          <span class="td-camera-feed__name">{{ eoDetail.name }}</span>
          <span class="td-camera-feed__time">{{ formatTime(eoDetail.lastUpdate) }}</span>
        </div>
      </section>

      <section class="td-section">
        <h3><el-icon><Monitor /></el-icon>实时动态</h3>
        <dl class="td-grid">
          <div class="td-field td-field--span2">
            <dt>经纬度</dt>
            <dd>{{ categoryPositionText(eoDetail.lon, eoDetail.lat) }}</dd>
          </div>
          <div class="td-field">
            <dt>方位</dt>
            <dd>{{ numberText(eoDetail.azimuth, '°') }}</dd>
          </div>
          <div class="td-field">
            <dt>俯仰</dt>
            <dd>{{ numberText(eoDetail.pitch, '°') }}</dd>
          </div>
          <div class="td-field">
            <dt>更新时间</dt>
            <dd>{{ formatTime(eoDetail.lastUpdate) }}</dd>
          </div>
          <div class="td-field">
            <dt>关联告警</dt>
            <dd>{{ eoDetail.alarmCount }} 条</dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Operation /></el-icon>快捷操作</h3>
        <div class="td-actions td-actions--single">
          <button type="button" class="td-action" @click="locateMonitorItem(eoDetail)">
            <el-icon><Aim /></el-icon>
            <span>定位</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else-if="zoneDetail" class="td-scroll">
      <section class="td-section">
        <h3><el-icon><Document /></el-icon>基本信息</h3>
        <dl class="td-grid">
          <div class="td-field">
            <dt>名称</dt>
            <dd>{{ text(zoneDetail.name) }}</dd>
          </div>
          <div class="td-field">
            <dt>编号</dt>
            <dd>{{ text(zoneDetail.id) }}</dd>
          </div>
          <div class="td-field">
            <dt>面积</dt>
            <dd>{{ numberText(zoneDetail.areaKm2, ' km²') }}</dd>
          </div>
          <div class="td-field">
            <dt>启用状态</dt>
            <dd>
              <span class="td-status" :class="zoneDetail.enabled ? 'is-online' : 'is-offline'">
                {{ zoneDetail.enabled ? '启用' : '停用' }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Monitor /></el-icon>实时动态</h3>
        <dl class="td-grid">
          <div class="td-field td-field--span2">
            <dt>中心位置</dt>
            <dd>{{ categoryPositionText(zoneDetail.lon, zoneDetail.lat) }}</dd>
          </div>
          <div class="td-field">
            <dt>关联告警</dt>
            <dd>{{ zoneDetail.alarmCount }} 条</dd>
          </div>
          <div class="td-field">
            <dt>更新时间</dt>
            <dd>{{ formatTime(zoneDetail.lastUpdate) }}</dd>
          </div>
        </dl>
      </section>

      <section class="td-section">
        <h3><el-icon><Operation /></el-icon>快捷操作</h3>
        <div class="td-actions td-actions--single">
          <button type="button" class="td-action" @click="locateMonitorItem(zoneDetail)">
            <el-icon><Aim /></el-icon>
            <span>定位</span>
          </button>
        </div>
      </section>
    </div>

    <div v-else class="panel-empty">
      <el-icon><Loading /></el-icon>
      <p>目标数据加载中</p>
      <span>正在获取最近上报信息</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 目标详情面板：基本信息、实时动态、来源融合、轨迹概览与快捷操作。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import {
  Aim,
  Bell,
  Connection,
  Document,
  Guide,
  Loading,
  Location,
  Monitor,
  Operation,
  TrendCharts,
  VideoCamera,
} from '@element-plus/icons-vue'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { useMaritimeAlarmsStore } from '@/stores/maritimeAlarms'
import { EO_DEVICES, FENCE_ZONES } from '@/mock/maritime/monitor'
import { RADAR_STATIONS } from '@/utils/maritimeGeography'
import {
  ALARM_LEVEL_LABELS,
  ALARM_TYPE_LABELS,
  DATA_QUALITY_LABELS,
  TARGET_SOURCE_LABELS,
  TARGET_SOURCE_OPTIONS,
  TARGET_STATUS_LABELS,
  TARGET_TYPE_LABELS,
} from '@/types/maritime'
import type { AlarmEvent, SourceReport, TargetSource, TrackPoint } from '@/types/maritime'
import './target-detail.css'

const CHART_WIDTH = 320
const CHART_HEIGHT = 120
const CHART_PAD = 10
const STALE_MS = 10 * 60 * 1000
const GAP_MS = 10 * 60 * 1000

const targetsStore = useMaritimeTargetsStore()
const mapStore = useMaritimeMapViewStore()
const alarmsStore = useMaritimeAlarmsStore()

const trajectoryRef = ref<HTMLElement | null>(null)
const alarmListRef = ref<HTMLElement | null>(null)
const emphasizeTrajectory = ref(false)

const detail = computed(() => targetsStore.detail)
const radarDetail = computed(() =>
  mapStore.selectedCategory === 'radar'
    ? RADAR_STATIONS.find((item) => item.id === mapStore.selectedCategoryId) ?? null
    : null,
)
const eoDetail = computed(() =>
  mapStore.selectedCategory === 'eo'
    ? EO_DEVICES.find((item) => item.id === mapStore.selectedCategoryId) ?? null
    : null,
)
const zoneDetail = computed(() =>
  mapStore.selectedCategory === 'fence'
    ? FENCE_ZONES.find((item) => item.id === mapStore.selectedCategoryId) ?? null
    : null,
)
const selectedName = computed(
  () =>
    detail.value?.name ||
    radarDetail.value?.name ||
    eoDetail.value?.name ||
    zoneDetail.value?.name ||
    '',
)
const hasSelection = computed(() =>
  Boolean(
    (targetsStore.selectedId && targetsStore.detail) ||
      radarDetail.value ||
      eoDetail.value ||
      zoneDetail.value,
  ),
)
const tracking = computed(() => Boolean(detail.value && mapStore.followId === detail.value.id))

const sourceOptions = TARGET_SOURCE_OPTIONS.map((value) => ({ value, label: TARGET_SOURCE_LABELS[value] }))

const latestReports = computed<Record<TargetSource, SourceReport | undefined>>(() => {
  const result: Record<TargetSource, SourceReport | undefined> = {
    phased: undefined,
    xband1: undefined,
    xband2: undefined,
    ais: undefined,
    framecode: undefined,
  }
  for (const report of targetsStore.sources) {
    const current = result[report.source]
    if (!current || report.reportTime > current.reportTime) result[report.source] = report
  }
  return result
})

const pendingAlarms = computed(() =>
  alarmsStore.alarms.filter((a) => a.targetId === detail.value?.id && a.status === 'pending'),
)

const sizeText = computed(() =>
  detail.value ? `${detail.value.length} × ${detail.value.width} m` : '暂无数据',
)

const draftText = computed(() => (detail.value ? `${detail.value.draft} m` : '暂无数据'))

const positionText = computed(() => {
  const target = detail.value
  if (!target || !Number.isFinite(target.lon) || !Number.isFinite(target.lat)) return '暂无位置信息'
  return `${target.lon.toFixed(4)}°E  ${target.lat.toFixed(4)}°N`
})

const hasPosition = computed(() => {
  const target = detail.value
  return Boolean(target && Number.isFinite(target.lon) && Number.isFinite(target.lat))
})

const trajectoryRangeText = computed(() => {
  const list = targetsStore.track
  if (list.length < 2) return ''
  return `${formatTime(list[0].time)} 至 ${formatTime(list[list.length - 1].time)}`
})

const trajectoryViewBox = computed(() => `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`)

const trajectoryGeometry = computed(() => {
  const list = targetsStore.track
  if (list.length < 2) return null
  const lons = list.map((p) => p.lon)
  const lats = list.map((p) => p.lat)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const lonSpan = Math.max(maxLon - minLon, 1e-6)
  const latSpan = Math.max(maxLat - minLat, 1e-6)
  const innerWidth = CHART_WIDTH - CHART_PAD * 2
  const innerHeight = CHART_HEIGHT - CHART_PAD * 2
  return {
    list,
    toPoint(point: TrackPoint) {
      return {
        x: CHART_PAD + ((point.lon - minLon) / lonSpan) * innerWidth,
        y: CHART_PAD + (1 - (point.lat - minLat) / latSpan) * innerHeight,
      }
    },
  }
})

const trajectoryPoints = computed(() => {
  const geometry = trajectoryGeometry.value
  if (!geometry) return ''
  return geometry.list.map((point) => {
    const p = geometry.toPoint(point)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
})

const trajectoryKeyDots = computed(() => {
  const geometry = trajectoryGeometry.value
  if (!geometry) return []
  const indexes = keyIndexes(geometry.list.length)
  return indexes.map((index, order) => {
    const point = geometry.list[index]
    const p = geometry.toPoint(point)
    return { ...point, ...p, key: order === 0 || order === indexes.length - 1 }
  })
})

const trajectoryKeyPoints = computed(() => {
  const geometry = trajectoryGeometry.value
  if (!geometry) return []
  const indexes = keyIndexes(geometry.list.length)
  return indexes.map((index, order) => ({
    ...geometry.list[index],
    label: order === 0 ? '起点' : order === indexes.length - 1 ? '最新' : '中段',
  }))
})

const hasTrackGap = computed(() => {
  const list = targetsStore.track
  if (list.length < 2) return false
  for (let i = 1; i < list.length; i += 1) {
    if (Date.parse(list[i].time) - Date.parse(list[i - 1].time) > GAP_MS) return true
  }
  return false
})

function keyIndexes(length: number) {
  if (length <= 5) return Array.from({ length }, (_, i) => i)
  const step = Math.ceil((length - 1) / 4)
  const indexes = new Set<number>()
  for (let i = 0; i < length; i += step) indexes.add(i)
  indexes.add(length - 1)
  return Array.from(indexes).sort((a, b) => a - b)
}

function keyDotTitle(point: TrackPoint) {
  return `${formatTime(point.time)} · ${point.lon.toFixed(4)}°E ${point.lat.toFixed(4)}°N · ${point.speed.toFixed(1)}kn ${point.course.toFixed(0)}°`
}

function keyPointText(point: TrackPoint) {
  return `${formatTime(point.time)} ${point.speed.toFixed(1)}kn ${point.course.toFixed(0)}°`
}

function handleLocate() {
  const target = detail.value
  if (!target) return
  mapStore.focusTarget(target)
  if (target.status === 'offline') ElMessage.info('目标暂无最新位置，已定位至最近位置')
}

function handleFollow() {
  const target = detail.value
  if (!target) return
  mapStore.setFollow(mapStore.followId === target.id ? null : target.id)
  mapStore.focusTarget(target)
}

function handleShowTrajectory() {
  trajectoryRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  emphasizeTrajectory.value = true
  window.setTimeout(() => {
    emphasizeTrajectory.value = false
  }, 1600)
}

function handleDispose() {
  if (pendingAlarms.value.length === 0) {
    ElMessage.info('该目标暂无关联告警')
    return
  }
  alarmListRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function handleAlarmClick(alarm: AlarmEvent) {
  alarmsStore.selectAlarm(alarm.id)
  const target = detail.value
  if (target) mapStore.focusTarget(target)
}

function text(value: string | undefined) {
  return value || '暂无数据'
}

function numberText(value: number, suffix: string) {
  return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '暂无数据'
}

function categoryPositionText(lon: number, lat: number) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return '暂无位置信息'
  return `${lon.toFixed(4)}°E  ${lat.toFixed(4)}°N`
}

function locateMonitorItem(item: { lon: number; lat: number }) {
  mapStore.focusPoint({ lon: item.lon, lat: item.lat })
}

function isStale(value: string) {
  return Date.now() - Date.parse(value) > STALE_MS
}

function formatTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>
