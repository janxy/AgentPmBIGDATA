/** 融合目标状态底座：数据、筛选、分页、选中与详情缓存。 */
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import {
  fetchMaritimeOverview,
  fetchTargetDetail,
  fetchTargetSources,
  fetchTargetTrack,
  fetchTargets,
} from '@/api/maritime'
import type {
  FusionTarget,
  MaritimeStats,
  SourceReport,
  TargetFilter,
  TargetSource,
  TargetStatus,
  TargetType,
  TrackPoint,
} from '@/types/maritime'
import { RADAR_SOURCE_OPTIONS } from '@/types/maritime'
import { useMaritimeAlarmsStore } from './maritimeAlarms'
import { useMaritimeUiStore } from './maritimeUi'

export const useMaritimeTargetsStore = defineStore('maritimeTargets', {
  state: () => ({
    targets: [] as FusionTarget[],
    loaded: false,
    loading: false,
    refreshing: false,
    lastUpdated: '',
    errorMessage: '',
    filter: {
      sources: [] as TargetSource[],
      statuses: [] as TargetStatus[],
      types: [] as TargetType[],
      keyword: '',
    },
    page: 1,
    pageSize: 10,
    selectedId: null as string | null,
    detail: null as FusionTarget | null,
    sources: [] as SourceReport[],
    track: [] as TrackPoint[],
    detailLoading: false,
    overview: null as MaritimeStats | null,
    detailRequestSeq: 0,
    followedIds: [] as string[],
  }),

  getters: {
    filteredTargets(state) {
      const { sources: sourceFilter, statuses, types, keyword } = state.filter
      const kw = keyword.trim().toLowerCase()
      const followedIds = state.followedIds
      return state.targets
        .filter((t) => {
          if (kw && ![t.name, t.mmsi, t.id].some((v) => v.toLowerCase().includes(kw))) return false
          if (sourceFilter.length && !sourceFilter.some((s) => t.sources.includes(s))) return false
          if (statuses.length && !statuses.includes(t.status)) return false
          if (types.length && !types.includes(t.type)) return false
          return true
        })
        .sort((a, b) => {
          const followedA = followedIds.includes(a.id) ? 0 : 1
          const followedB = followedIds.includes(b.id) ? 0 : 1
          if (followedA !== followedB) return followedA - followedB
          return b.lastUpdate.localeCompare(a.lastUpdate)
        })
    },
    filteredTotal(): number {
      return this.filteredTargets.length
    },
    pageTotal(): number {
      return Math.max(1, Math.ceil(this.filteredTotal / this.pageSize))
    },
    pagedTargets(): FusionTarget[] {
      const start = (this.page - 1) * this.pageSize
      return this.filteredTargets.slice(start, start + this.pageSize)
    },
    sourceCounts(state) {
      return {
        radar: state.targets.filter((t) => RADAR_SOURCE_OPTIONS.some((s) => t.sources.includes(s))).length,
        ais: state.targets.filter((t) => t.sources.includes('ais')).length,
        framecode: state.targets.filter((t) => t.sources.includes('framecode')).length,
      }
    },
    filteredAlarmCount(): number {
      const ids = new Set(this.filteredTargets.map((t) => t.id))
      const alarms = useMaritimeAlarmsStore().alarms
      return new Set(alarms.filter((a) => a.status === 'pending' && ids.has(a.targetId)).map((a) => a.targetId)).size
    },
  },

  actions: {
    async loadInitial() {
      if (this.loaded) return
      this.loading = true
      try {
        const [list, stats] = await Promise.all([
          fetchTargets({ page: 1, pageSize: 999 }),
          fetchMaritimeOverview(),
        ])
        this.targets = list.items
        this.overview = stats
        this.lastUpdated = new Date().toISOString()
        this.loaded = true
        this.errorMessage = ''
      } catch {
        this.errorMessage = '数据刷新失败，正在使用最近数据'
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      if (this.refreshing) return
      this.refreshing = true
      try {
        const [list, stats] = await Promise.all([
          fetchTargets({ page: 1, pageSize: 999 }),
          fetchMaritimeOverview(),
        ])
        this.targets = list.items
        this.overview = stats
        this.lastUpdated = new Date().toISOString()
        this.loaded = true
        this.errorMessage = ''
        const selected = this.selectedId
        const fresh = selected ? this.targets.find((t) => t.id === selected) ?? null : null
        if (selected && !fresh) {
          ElMessage.warning('目标已离线或已移除')
          this.clearSelection()
        } else if (fresh && this.detail?.id === selected) {
          this.detail = { ...this.detail, ...fresh }
        }
        if (this.page > this.pageTotal) this.page = this.pageTotal
      } catch {
        this.errorMessage = '数据刷新失败，正在使用最近数据'
      } finally {
        this.refreshing = false
      }
    },

    applyFilter(patch: Partial<TargetFilter>) {
      this.filter = { ...this.filter, ...patch }
      this.page = 1
    },

    setPage(next: number) {
      this.page = Math.min(this.pageTotal, Math.max(1, next))
    },

    setPageSize(next: number) {
      this.pageSize = next
      this.page = 1
    },

    toggleFollow(id: string) {
      this.followedIds = this.followedIds.includes(id)
        ? this.followedIds.filter((item) => item !== id)
        : [...this.followedIds, id]
    },

    isFollowed(id: string) {
      return this.followedIds.includes(id)
    },

    async loadDetail(id: string) {
      const seq = this.detailRequestSeq + 1
      this.detailRequestSeq = seq
      this.sources = []
      this.track = []
      this.detailLoading = true
      try {
        const [target, sourceList, trackList] = await Promise.all([
          fetchTargetDetail(id),
          fetchTargetSources(id),
          fetchTargetTrack(id, 60),
        ])
        if (this.selectedId !== id || this.detailRequestSeq !== seq) return
        this.detail = target
        this.sources = sourceList
        this.track = trackList
      } catch {
        if (this.selectedId === id && this.detailRequestSeq === seq) {
          ElMessage.error('目标详情加载失败，请稍后重试')
        }
      } finally {
        if (this.selectedId === id && this.detailRequestSeq === seq) this.detailLoading = false
      }
    },

    selectTarget(id: string) {
      const target = this.targets.find((t) => t.id === id)
      if (!target) {
        ElMessage.warning('目标已离线或已移除')
        this.clearSelection()
        return
      }
      this.selectedId = id
      this.detail = target
      this.sources = []
      this.track = []
      useMaritimeUiStore().openDetail()
      void this.loadDetail(id)
    },

    clearSelection() {
      this.selectedId = null
      this.detail = null
      this.sources = []
      this.track = []
      this.detailLoading = false
      this.detailRequestSeq += 1
      useMaritimeUiStore().closeDetail()
    },

    clearError() {
      this.errorMessage = ''
    },
  },
})
