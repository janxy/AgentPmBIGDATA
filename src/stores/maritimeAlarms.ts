/** 告警事件状态：列表、筛选、选中与处置状态流转。 */
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { fetchAlarms, updateAlarmStatus as updateAlarmStatusApi } from '@/api/maritime'
import type { AlarmEvent, AlarmLevel, DisposeStatus } from '@/types/maritime'

export const useMaritimeAlarmsStore = defineStore('maritimeAlarms', {
  state: () => ({
    alarms: [] as AlarmEvent[],
    loaded: false,
    loading: false,
    refreshing: false,
    levelFilter: [] as AlarmLevel[],
    selectedAlarmId: null as string | null,
    lastUpdated: '',
    errorMessage: '',
  }),

  getters: {
    filteredAlarms(state): AlarmEvent[] {
      const levels = state.levelFilter
      return state.alarms
        .filter((a) => levels.length === 0 || levels.includes(a.level))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    },
    recentAlarms(): AlarmEvent[] {
      return this.filteredAlarms.slice(0, 16)
    },
    pendingCount(): number {
      return this.alarms.filter((a) => a.status === 'pending').length
    },
    pendingTargetIds(): Set<string> {
      return new Set(this.alarms.filter((a) => a.status === 'pending').map((a) => a.targetId))
    },
  },

  actions: {
    async loadInitial() {
      if (this.loaded) return
      this.loading = true
      try {
        const result = await fetchAlarms({ page: 1, pageSize: 999 })
        this.alarms = result.items
        this.loaded = true
        this.lastUpdated = new Date().toISOString()
        this.errorMessage = ''
      } catch {
        this.errorMessage = '告警数据刷新失败，正在使用最近数据'
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      if (this.refreshing) return
      this.refreshing = true
      try {
        const result = await fetchAlarms({ page: 1, pageSize: 999 })
        this.alarms = result.items
        this.loaded = true
        this.lastUpdated = new Date().toISOString()
        this.errorMessage = ''
      } catch {
        this.errorMessage = '告警数据刷新失败，正在使用最近数据'
      } finally {
        this.refreshing = false
      }
    },

    setLevelFilter(levels: AlarmLevel[]) {
      this.levelFilter = levels
    },

    selectAlarm(id: string) {
      this.selectedAlarmId = id
    },

    clearSelection() {
      this.selectedAlarmId = null
    },

    async updateAlarmStatus(id: string, next: DisposeStatus): Promise<boolean> {
      try {
        const updated = await updateAlarmStatusApi(id, next)
        this.alarms = this.alarms.map((a) => (a.id === id ? updated : a))
        return true
      } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '处置状态更新失败，请稍后重试')
        return false
      }
    },

    async startDispose(id: string): Promise<boolean> {
      const alarm = this.alarms.find((a) => a.id === id)
      if (!alarm) return false
      if (alarm.status !== 'pending') {
        ElMessage.warning('该告警已进入处置流程，请勿重复操作')
        return false
      }
      return this.updateAlarmStatus(id, 'processing')
    },

    async completeDispose(id: string): Promise<boolean> {
      const alarm = this.alarms.find((a) => a.id === id)
      if (!alarm) return false
      if (alarm.status !== 'processing') {
        ElMessage.warning('当前状态无法标记完成')
        return false
      }
      return this.updateAlarmStatus(id, 'done')
    },

    async reviewDispose(id: string): Promise<boolean> {
      const alarm = this.alarms.find((a) => a.id === id)
      if (!alarm) return false
      if (alarm.status !== 'done') {
        ElMessage.warning('仅已处置告警可复核')
        return false
      }
      return this.updateAlarmStatus(id, 'reviewed')
    },

    clearError() {
      this.errorMessage = ''
    },
  },
})
