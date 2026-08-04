/** 告警地图联动：定位关联目标、按告警位置回退并联动目标详情。 */
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import { useMaritimeMapViewStore } from '@/stores/maritimeMapView'
import type { AlarmEvent } from '@/types/maritime'

export function useAlarmLocate() {
  const targetsStore = useMaritimeTargetsStore()
  const mapStore = useMaritimeMapViewStore()

  function locateAlarm(alarm: AlarmEvent, openTargetDetail: boolean): boolean {
    if (!targetsStore.loaded) {
      ElMessage.warning('海图数据加载中，请稍后重试')
      return false
    }
    const target = targetsStore.targets.find((item) => item.id === alarm.targetId)
    if (target) {
      if (target.status === 'offline') ElMessage.info('目标已离线，定位至最近已知位置')
      mapStore.focusTarget(target)
      if (openTargetDetail) targetsStore.selectTarget(target.id)
      return true
    }
    if (Number.isFinite(alarm.lon) && Number.isFinite(alarm.lat)) {
      mapStore.center = { lon: alarm.lon, lat: alarm.lat }
      mapStore.zoom = 2.6
      mapStore.setHighlight(alarm.targetId)
      ElMessage.warning('目标位置缺失，已定位至告警位置')
      return false
    }
    ElMessage.warning('目标位置缺失，无法定位')
    return false
  }

  return { locateAlarm }
}
