/** 统一请求封装：校验 HTTP 状态与业务 code，抛出可读错误。 */

export class RequestError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = 'RequestError'
    this.code = code
  }
}

interface ApiEnvelope<T> {
  code: number
  data: T
  message: string
}

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new RequestError('网络请求失败，请稍后重试', -1)
  }

  let body: ApiEnvelope<T>
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new RequestError('响应数据解析失败，请稍后重试', -2)
  }

  if (!res.ok || body.code !== 0) {
    throw new RequestError(body.message || '请求失败，请稍后重试', body.code ?? res.status)
  }
  return body.data
}
