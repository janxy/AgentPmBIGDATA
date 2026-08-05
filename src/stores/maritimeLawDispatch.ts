/** 智能执法派单：当前/历史两个只读列表。 */
import { defineStore } from 'pinia'
import { fetchLawDispatchOrders } from '@/api/maritime'
import type { DispatchOrder } from '@/types/maritime'

export const useMaritimeLawDispatchStore = defineStore('maritimeLawDispatch', {
  state: () => ({
    orders: [] as DispatchOrder[],
    loaded: false,
    loading: false,
    errorMessage: '',
  }),

  getters: {
    currentOrders(state): DispatchOrder[] {
      return state.orders
        .filter((order) => order.status !== 'finished')
        .sort((a, b) => b.dispatchTime.localeCompare(a.dispatchTime))
    },
    historyOrders(state): DispatchOrder[] {
      return state.orders
        .filter((order) => order.status === 'finished')
        .sort((a, b) => (b.endTime || b.dispatchTime).localeCompare(a.endTime || a.dispatchTime))
    },
  },

  actions: {
    async loadInitial() {
      if (this.loaded) return
      this.loading = true
      try {
        const orders = await fetchLawDispatchOrders({ page: 1, pageSize: 999 })
        this.orders = orders.items
        this.loaded = true
        this.errorMessage = ''
      } catch {
        this.errorMessage = '派单数据加载失败，正在使用最近数据'
      } finally {
        this.loading = false
      }
    },
  },
})
