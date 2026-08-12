<template>
  <section class="maritime-panel target-monitor">
    <header class="panel-head">
      <h2>目标监控</h2>
      <span class="panel-head__meta">共 {{ panelTotal }} 个</span>
    </header>

    <nav class="tm-tabs" aria-label="监控目标分类">
      <button
        v-for="tab in monitorTabs"
        :key="tab.value"
        type="button"
        class="tm-tab"
        :class="{ 'is-active': activeTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        <span>{{ tab.label }}</span>
        <em>{{ tabCounts[tab.value] }}</em>
      </button>
    </nav>

    <div class="tm-filter">
      <div v-if="activeTab === 'vessel'" class="tm-filter__group">
        <span class="tm-filter__label">来源</span>
        <div class="tm-filter__chips">
          <button
            v-for="option in sourceOptions"
            :key="option.value"
            type="button"
            class="tm-chip"
            :class="{ 'is-active': targetsStore.filter.sources.includes(option.value) }"
            @click="toggleSource(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div v-if="activeTab === 'vessel'" class="tm-filter__group">
        <span class="tm-filter__label">类型</span>
        <div class="tm-filter__chips">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            class="tm-chip"
            :class="{ 'is-active': targetsStore.filter.types.includes(option.value) }"
            @click="toggleType(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div class="tm-filter__keyword">
        <el-icon class="tm-filter__search"><Search /></el-icon>
        <input
          v-if="activeTab === 'vessel'"
          v-model="keyword"
          class="tm-filter__input"
          type="text"
          placeholder="名称 / MMSI / 编号"
          aria-label="目标关键词"
        />
        <input
          v-else-if="activeTab === 'radar'"
          v-model="radarKeyword"
          class="tm-filter__input"
          type="text"
          placeholder="名称 / 编号"
          aria-label="雷达目标关键词"
        />
        <input
          v-else-if="activeTab === 'eo'"
          v-model="eoKeyword"
          class="tm-filter__input"
          type="text"
          placeholder="名称 / 编号"
          aria-label="光电设备关键词"
        />
        <input
          v-else
          v-model="fenceKeyword"
          class="tm-filter__input"
          type="text"
          placeholder="名称 / 编号"
          aria-label="区域关键词"
        />
        <button
          v-if="hasActiveFilter"
          type="button"
          class="tm-filter__clear"
          aria-label="清空筛选"
          @click="clearFilter"
        >
          清空
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'vessel'" class="tm-stats" aria-label="筛选统计">
      <div class="tm-stat">
        <b>{{ targetsStore.filteredTotal }}</b>
        <span>目标</span>
      </div>
      <div class="tm-stat">
        <b>{{ filteredSourceCounts.phased }}</b>
        <span>相控阵</span>
      </div>
      <div class="tm-stat">
        <b>{{ filteredSourceCounts.xband1 }}</b>
        <span>X波段1</span>
      </div>
      <div class="tm-stat">
        <b>{{ filteredSourceCounts.xband2 }}</b>
        <span>X波段2</span>
      </div>
      <div class="tm-stat">
        <b>{{ filteredSourceCounts.ais }}</b>
        <span>AIS</span>
      </div>
      <div class="tm-stat">
        <b>{{ filteredSourceCounts.framecode }}</b>
        <span>帧码</span>
      </div>
      <div class="tm-stat tm-stat--alarm">
        <b>{{ targetsStore.filteredAlarmCount }}</b>
        <span>待处置</span>
      </div>
    </div>
    <div v-else-if="activeTab === 'radar'" class="tm-stats" aria-label="雷达目标统计">
      <div v-for="stat in radarStats" :key="stat.label" class="tm-stat">
        <b>{{ stat.value }}</b>
        <span>{{ stat.label }}</span>
      </div>
    </div>
    <div v-else-if="activeTab === 'eo'" class="tm-stats" aria-label="光电设备统计">
      <div v-for="stat in eoStats" :key="stat.label" class="tm-stat">
        <b>{{ stat.value }}</b>
        <span>{{ stat.label }}</span>
      </div>
    </div>
    <div v-else class="tm-stats" aria-label="区域统计">
      <div v-for="stat in fenceStats" :key="stat.label" class="tm-stat">
        <b>{{ stat.value }}</b>
        <span>{{ stat.label }}</span>
      </div>
    </div>

    <div class="tm-list">
      <div v-if="activeTab === 'vessel' && targetsStore.loading && !targetsStore.loaded" class="tm-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>海图数据加载中</span>
      </div>
      <div v-else-if="panelTotal === 0" class="tm-empty">
        <el-icon><Ship /></el-icon>
        <span>{{ emptyText }}</span>
      </div>
      <template v-else>
        <template v-if="activeTab === 'vessel'">
          <button
            v-for="target in targetsStore.pagedTargets"
            :key="target.id"
            type="button"
            class="tm-row"
            :class="{ 'is-selected': target.id === targetsStore.selectedId }"
            @click="handleRowClick(target)"
          >
            <span class="tm-row__top">
              <strong class="tm-row__name">{{ target.name || '-' }}</strong>
              <span class="tm-row__mmsi">{{ target.mmsi || '-' }}</span>
              <span class="tm-row__time">{{ formatTime(target.lastUpdate) }}</span>
            </span>
            <span class="tm-row__bottom">
              <span class="tm-row__nav">{{ target.speed.toFixed(1) }} kn · {{ target.course.toFixed(1) }}°</span>
              <span class="tm-row__sources">
                <i v-if="target.sources.length === 0" class="tm-row__source tm-row__source--none">
                  无来源
                </i>
                <i
                  v-for="source in target.sources"
                  :key="source"
                  class="tm-row__source"
                  :class="`is-${source}`"
                >
                  {{ TARGET_SOURCE_LABELS[source] }}
                </i>
              </span>
            </span>
          </button>
        </template>
        <template v-else-if="activeTab === 'radar'">
          <button
            v-for="station in pagedRadarStations"
            :key="station.id"
            type="button"
            class="tm-row"
            :class="{ 'is-selected': mapStore.selectedCategoryId === station.id }"
            @click="handleCategoryClick('radar', station.id)"
          >
            <span class="tm-row__top">
              <strong class="tm-row__name">{{ station.name }}</strong>
              <span class="tm-row__mmsi">{{ station.id }}</span>
              <span class="tm-row__time">{{ formatTime(station.lastUpdate) }}</span>
            </span>
            <span class="tm-row__bottom">
              <span class="tm-row__nav">覆盖 {{ station.radiusKm.toFixed(0) }} km</span>
              <span class="tm-row__sources">
                <i class="tm-row__source" :class="station.online ? 'is-device-online' : 'is-device-offline'">
                  {{ station.online ? '在线' : '离线' }}
                </i>
              </span>
            </span>
          </button>
        </template>
        <template v-else-if="activeTab === 'eo'">
          <button
            v-for="device in pagedEoDevices"
            :key="device.id"
            type="button"
            class="tm-row"
            :class="{ 'is-selected': mapStore.selectedCategoryId === device.id }"
            @click="handleCategoryClick('eo', device.id)"
          >
            <span class="tm-row__top">
              <strong class="tm-row__name">{{ device.name }}</strong>
              <span class="tm-row__mmsi">{{ device.id }}</span>
              <span class="tm-row__time">{{ formatTime(device.lastUpdate) }}</span>
            </span>
            <span class="tm-row__bottom">
              <span class="tm-row__nav">方位 {{ device.azimuth }}° · 俯仰 {{ device.pitch }}°</span>
              <span class="tm-row__sources">
                <i class="tm-row__source" :class="device.online ? 'is-device-online' : 'is-device-offline'">
                  {{ device.online ? '在线' : '离线' }}
                </i>
                <i v-if="device.alarmCount > 0" class="tm-row__source is-device-alarm">
                  告警 {{ device.alarmCount }}
                </i>
              </span>
            </span>
          </button>
        </template>
        <template v-else>
          <button
            v-for="zone in pagedFenceZones"
            :key="zone.id"
            type="button"
            class="tm-row"
            :class="{ 'is-selected': mapStore.selectedCategoryId === zone.id }"
            @click="handleCategoryClick('fence', zone.id)"
          >
            <span class="tm-row__top">
              <strong class="tm-row__name">{{ zone.name }}</strong>
              <span class="tm-row__mmsi">{{ zone.id }}</span>
              <span class="tm-row__time">{{ formatTime(zone.lastUpdate) }}</span>
            </span>
            <span class="tm-row__bottom">
              <span class="tm-row__nav">面积 {{ zone.areaKm2 }} km²</span>
              <span class="tm-row__sources">
                <i class="tm-row__source" :class="zone.enabled ? 'is-device-online' : 'is-device-offline'">
                  {{ zone.enabled ? '启用' : '停用' }}
                </i>
                <i class="tm-row__source is-device-alarm">
                  {{ ALARM_LEVEL_LABELS[zone.alarmLevel] }}
                </i>
                <i v-if="zone.alarmCount > 0" class="tm-row__source is-device-alarm">
                  告警 {{ zone.alarmCount }}
                </i>
              </span>
            </span>
          </button>
        </template>
      </template>
    </div>

    <div class="tm-pager">
      <label class="tm-pager__size">
        每页
        <select :value="currentPageSize" aria-label="每页数量" @change="handlePageSizeChange">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
        条
      </label>
      <span class="tm-pager__info">{{ currentPage }} / {{ currentPageTotal }}</span>
      <div class="tm-pager__btns">
        <button
          type="button"
          class="tm-pager__btn"
          :disabled="currentPage <= 1"
          aria-label="上一页"
          @click="changePage(currentPage - 1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="tm-pager__btn"
          :disabled="currentPage >= currentPageTotal"
          aria-label="下一页"
          @click="changePage(currentPage + 1)"
        >
          ›
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 目标监控面板：分页列表、多维筛选、数量统计与海图双向联动。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import './target-monitor.css'
import { Loading, Search, Ship } from '@element-plus/icons-vue'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import { EO_DEVICES, FENCE_ZONES } from '@/mock/maritime/monitor'
import { RADAR_STATIONS } from '@/utils/maritimeGeography'
import {
  ALARM_LEVEL_LABELS,
  MONITOR_CATEGORY_LABELS,
  TARGET_SOURCE_LABELS,
  TARGET_SOURCE_OPTIONS,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_OPTIONS,
} from '@/types/maritime'
import type { FusionTarget, MonitorCategory, TargetSource, TargetType } from '@/types/maritime'

const targetsStore = useMaritimeTargetsStore()
const mapStore = useMaritimeMapViewStore()

const monitorTabs: Array<{ value: MonitorCategory; label: string }> = [
  { value: 'vessel', label: MONITOR_CATEGORY_LABELS.vessel },
  { value: 'radar', label: MONITOR_CATEGORY_LABELS.radar },
  { value: 'eo', label: MONITOR_CATEGORY_LABELS.eo },
  { value: 'fence', label: MONITOR_CATEGORY_LABELS.fence },
]

const activeTab = ref<MonitorCategory>('vessel')
const radarKeyword = ref('')
const eoKeyword = ref('')
const fenceKeyword = ref('')
const categoryPage = ref(1)
const categoryPageSize = ref(10)

const sourceOptions = TARGET_SOURCE_OPTIONS.map((value) => ({ value, label: TARGET_SOURCE_LABELS[value] }))
const typeOptions = TARGET_TYPE_OPTIONS.map((value) => ({ value, label: TARGET_TYPE_LABELS[value] }))

const keyword = ref(targetsStore.filter.keyword)
let keywordTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (value) => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    if (activeTab.value === 'vessel') targetsStore.applyFilter({ keyword: value })
  }, 250)
})

function matchesKeyword(value: string, fields: string[]) {
  const kw = value.trim().toLowerCase()
  return !kw || fields.some((field) => field.toLowerCase().includes(kw))
}

const filteredRadarStations = computed(() =>
  RADAR_STATIONS.filter((station) => matchesKeyword(radarKeyword.value, [station.name, station.id])),
)

const filteredEoDevices = computed(() =>
  EO_DEVICES.filter((device) => matchesKeyword(eoKeyword.value, [device.name, device.id])),
)

const filteredFenceZones = computed(() =>
  FENCE_ZONES.filter((zone) => matchesKeyword(fenceKeyword.value, [zone.name, zone.id])),
)

const panelTotal = computed(() => {
  if (activeTab.value === 'radar') return filteredRadarStations.value.length
  if (activeTab.value === 'eo') return filteredEoDevices.value.length
  if (activeTab.value === 'fence') return filteredFenceZones.value.length
  return targetsStore.filteredTotal
})

const emptyText = computed(() => `暂无符合条件的${MONITOR_CATEGORY_LABELS[activeTab.value]}`)

const tabCounts = computed(() => ({
  vessel: targetsStore.targets.length,
  radar: RADAR_STATIONS.length,
  eo: EO_DEVICES.length,
  fence: FENCE_ZONES.length,
}))

const hasActiveFilter = computed(() => {
  if (activeTab.value === 'radar') {
    return radarKeyword.value.trim().length > 0
  }
  if (activeTab.value === 'eo') return eoKeyword.value.trim().length > 0
  if (activeTab.value === 'fence') return fenceKeyword.value.trim().length > 0
  return (
    targetsStore.filter.sources.length > 0 ||
    targetsStore.filter.types.length > 0 ||
    targetsStore.filter.keyword.trim().length > 0
  )
})

const filteredSourceCounts = computed(() => {
  const list = targetsStore.filteredTargets
  return {
    phased: list.filter((t) => t.sources.includes('phased')).length,
    xband1: list.filter((t) => t.sources.includes('xband1')).length,
    xband2: list.filter((t) => t.sources.includes('xband2')).length,
    ais: list.filter((t) => t.sources.includes('ais')).length,
    framecode: list.filter((t) => t.sources.includes('framecode')).length,
  }
})

const radarStats = computed(() => {
  const list = filteredRadarStations.value
  return [
    { value: list.length, label: '雷达站' },
    { value: list.filter((s) => s.online).length, label: '在线' },
    { value: list.filter((s) => !s.online).length, label: '离线' },
    { value: list.reduce((sum, s) => sum + s.radiusKm, 0), label: '覆盖 km' },
  ]
})

const eoStats = computed(() => {
  const list = filteredEoDevices.value
  return [
    { value: list.length, label: '光电设备' },
    { value: list.filter((d) => d.online).length, label: '在线' },
    { value: list.filter((d) => !d.online).length, label: '离线' },
    { value: list.reduce((sum, d) => sum + d.alarmCount, 0), label: '告警' },
  ]
})

const fenceStats = computed(() => {
  const list = filteredFenceZones.value
  return [
    { value: list.length, label: '区域' },
    { value: list.filter((z) => z.enabled).length, label: '启用' },
    { value: list.filter((z) => !z.enabled).length, label: '停用' },
    { value: list.reduce((sum, z) => sum + z.alarmCount, 0), label: '告警' },
  ]
})

const categoryPageTotal = computed(() => Math.max(1, Math.ceil(panelTotal.value / categoryPageSize.value)))
const currentPageTotal = computed(() =>
  activeTab.value === 'vessel' ? targetsStore.pageTotal : categoryPageTotal.value,
)
const currentPage = computed(() =>
  activeTab.value === 'vessel' ? targetsStore.page : Math.min(categoryPage.value, categoryPageTotal.value),
)
const currentPageSize = computed(() =>
  activeTab.value === 'vessel' ? targetsStore.pageSize : categoryPageSize.value,
)

const pagedRadarStations = computed(() => {
  const start = (currentPage.value - 1) * categoryPageSize.value
  return filteredRadarStations.value.slice(start, start + categoryPageSize.value)
})

const pagedEoDevices = computed(() => {
  const start = (currentPage.value - 1) * categoryPageSize.value
  return filteredEoDevices.value.slice(start, start + categoryPageSize.value)
})

const pagedFenceZones = computed(() => {
  const start = (currentPage.value - 1) * categoryPageSize.value
  return filteredFenceZones.value.slice(start, start + categoryPageSize.value)
})

watch(panelTotal, () => {
  if (categoryPage.value > categoryPageTotal.value) categoryPage.value = categoryPageTotal.value
})

function toggleSource(value: TargetSource) {
  const current = targetsStore.filter.sources
  targetsStore.applyFilter({
    sources: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
  })
}

function toggleType(value: TargetType) {
  const current = targetsStore.filter.types
  targetsStore.applyFilter({
    types: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
  })
}

function clearFilter() {
  if (activeTab.value === 'radar') {
    radarKeyword.value = ''
  } else if (activeTab.value === 'eo') {
    eoKeyword.value = ''
  } else if (activeTab.value === 'fence') {
    fenceKeyword.value = ''
  } else {
    keyword.value = ''
    targetsStore.applyFilter({ sources: [], statuses: [], types: [], keyword: '' })
  }
  categoryPage.value = 1
}

function handlePageSizeChange(event: Event) {
  const next = Number((event.target as HTMLSelectElement).value)
  if (activeTab.value === 'vessel') {
    targetsStore.setPageSize(next)
  } else {
    categoryPageSize.value = next
    categoryPage.value = 1
  }
}

function changePage(next: number) {
  if (activeTab.value === 'vessel') {
    targetsStore.setPage(next)
    return
  }
  categoryPage.value = Math.min(currentPageTotal.value, Math.max(1, next))
}

function switchTab(next: MonitorCategory) {
  if (activeTab.value === next) return
  activeTab.value = next
  categoryPage.value = 1
}

function handleCategoryClick(category: MonitorCategory, id: string) {
  targetsStore.clearSelection()
  mapStore.selectMonitorItem(category, id)
  if (category === 'radar') {
    const station = RADAR_STATIONS.find((item) => item.id === id)
    if (!station) return
    mapStore.showLayer('radar')
    mapStore.focusPoint({ lon: station.lon, lat: station.lat }, Math.max(2.8, mapStore.zoom))
    return
  }
  if (category === 'eo') {
    const device = EO_DEVICES.find((item) => item.id === id)
    if (!device) return
    mapStore.showLayer('eo')
    mapStore.focusPoint({ lon: device.lon, lat: device.lat }, Math.max(2.8, mapStore.zoom))
    return
  }
  const zone = FENCE_ZONES.find((item) => item.id === id)
  if (!zone) return
  mapStore.showLayer('zones')
  mapStore.focusPoint({ lon: zone.lon, lat: zone.lat }, Math.max(2.8, mapStore.zoom))
}

function handleRowClick(target: FusionTarget) {
  if (!targetsStore.loaded) {
    ElMessage.warning('海图数据加载中，请稍后重试')
    return
  }
  mapStore.clearMonitorSelection()
  targetsStore.selectTarget(target.id)
  mapStore.focusTarget(target)
}

function formatTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

onBeforeUnmount(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
})
</script>

<style scoped>
</style>
