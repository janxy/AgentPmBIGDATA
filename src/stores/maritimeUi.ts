/** 大屏界面状态：面板展开、工具栏浮层与数据维护入口。 */
import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useMaritimeUiStore = defineStore('maritimeUi', () => {
  const detailOpen = ref(false)
  const leftCollapsed = ref(false)
  const toolbarOpen = ref(false)
  const alarmListOpen = ref(false)
  const dataAdminOpen = ref(false)

  function openDetail() {
    detailOpen.value = true
  }

  function closeDetail() {
    detailOpen.value = false
  }

  function toggleLeft() {
    leftCollapsed.value = !leftCollapsed.value
  }

  function toggleToolbar() {
    toolbarOpen.value = !toolbarOpen.value
  }

  function closeToolbar() {
    toolbarOpen.value = false
  }

  function toggleAlarmList() {
    alarmListOpen.value = !alarmListOpen.value
  }

  function setAlarmListOpen(value: boolean) {
    alarmListOpen.value = value
  }

  function setDataAdminOpen(value: boolean) {
    dataAdminOpen.value = value
  }

  return {
    detailOpen,
    leftCollapsed,
    toolbarOpen,
    alarmListOpen,
    dataAdminOpen,
    openDetail,
    closeDetail,
    toggleLeft,
    toggleToolbar,
    closeToolbar,
    toggleAlarmList,
    setAlarmListOpen,
    setDataAdminOpen,
  }
})
