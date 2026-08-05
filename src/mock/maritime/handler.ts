/** /api/maritime 请求分发：把 URL 参数与请求体映射到演示数据查询函数。 */
import type { AlarmLevel, AlarmType, DisposeStatus, DispatchOutcome, DispatchStatus, TargetSource, TargetStatus, TargetType } from '@/types/maritime'
import {
  MockError,
  DISPOSE_STATUS_OPTIONS,
  advanceDispatch,
  buildStats,
  createSmartDispatch,
  finishDispatch,
  getMaritimeStatus,
  queryAlarms,
  queryLawDispatchDetail,
  queryLawDispatchOrders,
  queryLawDispatchOverview,
  queryTargetDetail,
  queryTargetSources,
  queryTargetTracks,
  queryTargets,
  queryTargetTrack,
  recommendLawDispatch,
  refreshData,
  setPaused,
  setSimError,
  updateAlarmStatus,
  urgeDispatch,
} from './data'

type RequestParams = Record<string, string | string[] | undefined>

interface ApiEnvelope<T> {
  code: number
  data: T
  message: string
}

const ok = <T>(data: T, message = 'ok'): ApiEnvelope<T> => ({ code: 0, data, message })
const err = (message: string, code: number): ApiEnvelope<null> => ({ code, data: null, message })

const first = (value: string | string[] | undefined, fallback = ''): string =>
  Array.isArray(value) ? value[0] ?? fallback : value ?? fallback
const toList = <T extends string>(value: string | string[] | undefined): T[] => {
  if (!value) return []
  const raw = Array.isArray(value) ? value.join(',') : value
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as T[]
}
const toNumber = (value: string | string[] | undefined, fallback: number): number => {
  const parsed = Number(first(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

interface AlarmStatusBody {
  id?: string
  status?: string
}

interface PauseBody {
  paused?: boolean
}

interface ErrorBody {
  enabled?: boolean
}

interface LawDispatchBody {
  alarmId?: string
  vesselId?: string
}

interface LawOrderBody {
  id?: string
}

interface LawFinishBody {
  id?: string
  outcome?: string
  note?: string
}

/** 处理一个 /api/maritime 请求，返回统一响应包。 */
export function handleMaritimeRequest(
  method: string,
  path: string,
  params: RequestParams = {},
  body: unknown = null,
): ApiEnvelope<unknown> {
  try {
    if (method === 'GET') {
      if (path === '/api/maritime/overview') return ok(buildStats())
      if (path === '/api/maritime/targets') {
        return ok(
          queryTargets({
            page: toNumber(params.page, 1),
            pageSize: toNumber(params.pageSize, 10),
            sources: toList<TargetSource>(params.sources),
            statuses: toList<TargetStatus>(params.statuses),
            types: toList<TargetType>(params.types),
            keyword: first(params.keyword),
          }),
        )
      }
      if (path === '/api/maritime/target/detail') return ok(queryTargetDetail(first(params.id)))
      if (path === '/api/maritime/target/sources') return ok(queryTargetSources(first(params.id)))
      if (path === '/api/maritime/target/track') {
        return ok(queryTargetTrack(first(params.id), toNumber(params.limit, 60)))
      }
      if (path === '/api/maritime/target/tracks') {
        return ok(queryTargetTracks(toNumber(params.limit, 20)))
      }
      if (path === '/api/maritime/alarms') {
        return ok(
          queryAlarms({
            page: toNumber(params.page, 1),
            pageSize: toNumber(params.pageSize, 10),
            levels: toList<AlarmLevel>(params.levels),
          }),
        )
      }
      if (path === '/api/maritime/law/overview') return ok(queryLawDispatchOverview())
      if (path === '/api/maritime/law/orders') {
        return ok(
          queryLawDispatchOrders({
            page: toNumber(params.page, 1),
            pageSize: toNumber(params.pageSize, 10),
            scope: first(params.scope) === 'history' ? 'history' : first(params.scope) === 'current' ? 'current' : undefined,
            statuses: toList<DispatchStatus>(params.statuses),
            outcomes: toList<DispatchOutcome>(params.outcomes),
            types: toList<AlarmType>(params.types),
            keyword: first(params.keyword),
          }),
        )
      }
      if (path === '/api/maritime/law/order/detail') return ok(queryLawDispatchDetail(first(params.id)))
      if (path === '/api/maritime/law/recommend') return ok(recommendLawDispatch(first(params.alarmId) || undefined))
      if (path === '/api/maritime/status') return ok(getMaritimeStatus())
      return err('接口不存在', 404)
    }

    if (method === 'POST') {
      if (path === '/api/maritime/alarms/status') {
        const payload = (body || {}) as AlarmStatusBody
        const next = payload.status || 'pending'
        if (!DISPOSE_STATUS_OPTIONS.includes(next as DisposeStatus)) {
          return err('处置状态不合法', 400)
        }
        return ok(updateAlarmStatus(payload.id || '', next as DisposeStatus))
      }
      if (path === '/api/maritime/refresh') return ok(refreshData())
      if (path === '/api/maritime/pause') {
        setPaused(Boolean((body as PauseBody)?.paused))
        return ok(getMaritimeStatus())
      }
      if (path === '/api/maritime/error') {
        setSimError(Boolean((body as ErrorBody)?.enabled))
        return ok(getMaritimeStatus())
      }
      if (path === '/api/maritime/law/dispatch') {
        const payload = (body || {}) as LawDispatchBody
        return ok(createSmartDispatch({ alarmId: payload.alarmId || undefined, vesselId: payload.vesselId || undefined }))
      }
      if (path === '/api/maritime/law/urge') {
        return ok(urgeDispatch((body as LawOrderBody)?.id || ''))
      }
      if (path === '/api/maritime/law/advance') {
        return ok(advanceDispatch((body as LawOrderBody)?.id || ''))
      }
      if (path === '/api/maritime/law/finish') {
        const payload = (body || {}) as LawFinishBody
        return ok(finishDispatch(payload.id || '', payload.outcome as DispatchOutcome, payload.note || ''))
      }
      return err('接口不存在', 404)
    }

    return err('请求方法不支持', 405)
  } catch (error) {
    if (error instanceof MockError) return err(error.message, error.code)
    return err('演示数据服务异常，请稍后重试', 500)
  }
}
