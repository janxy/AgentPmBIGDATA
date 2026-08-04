// 全局 mock 开关 — 改为 false 可关闭所有 mock
import { handleMaritimeRequest } from '@/mock/maritime'

export const MOCK_ENABLED = true

if (MOCK_ENABLED) {
  const MOCK_INSTALLED_KEY = '__AXURE_MOCK_FETCH_INSTALLED__'
  const MOCK_ORIGINAL_FETCH_KEY = '__AXURE_MOCK_ORIGINAL_FETCH__'
  const mockRoutes: Record<string, Record<string, (body?: unknown) => unknown>> = {
    POST: {
      '/api/auth/login': (body: unknown) => {
        const { username, password } = body as { username: string; password: string }
        if (username === 'admin' && password === '123456') {
          return {
            code: 0,
            data: {
              token: 'mock-token-axuremart-2026',
              user: { id: 1, name: '张明', email: 'admin@axuremart.ai', avatar: '', role: 'admin' },
            },
            message: '登录成功',
          }
        }
        return { code: 401, data: null, message: '用户名或密码错误' }
      },
      '/api/auth/logout': () => ({ code: 0, message: '已退出登录' }),
    },
    GET: {
      '/api/auth/me': () => ({
        code: 0,
        data: { id: 1, name: '张明', email: 'admin@axuremart.ai', avatar: '', role: 'admin' },
      }),
    },
  }

  const delay = () => new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200))
  const parseBody = (raw: BodyInit | null | undefined): unknown => {
    if (!raw) return null
    try {
      return JSON.parse(raw as string)
    } catch {
      return raw
    }
  }

  let installedMockFetch: typeof window.fetch | null = null
  const windowRecord = window as unknown as Record<string, unknown>

  if (!windowRecord[MOCK_INSTALLED_KEY]) {
    const originalFetch = (windowRecord[MOCK_ORIGINAL_FETCH_KEY] as typeof window.fetch | undefined) ?? window.fetch.bind(window)
    windowRecord[MOCK_ORIGINAL_FETCH_KEY] = originalFetch
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      const parsed = new URL(rawUrl, window.location.origin)
      const pathname = parsed.pathname
      const method = (init?.method || 'GET').toUpperCase()

      if (pathname.startsWith('/api/maritime')) {
        await delay()
        const params: Record<string, string | string[]> = {}
        parsed.searchParams.forEach((value, key) => {
          const existing = params[key]
          if (Array.isArray(existing)) existing.push(value)
          else if (typeof existing === 'string') params[key] = [existing, value]
          else params[key] = value
        })
        const data = handleMaritimeRequest(method, pathname, params, parseBody(init?.body))
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const handler = mockRoutes[method]?.[pathname]
      if (handler) {
        await delay()
        const data = handler(parseBody(init?.body))
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return originalFetch(input, init)
    }
    installedMockFetch = mockFetch
    window.fetch = mockFetch
    windowRecord[MOCK_INSTALLED_KEY] = true
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      const originalFetch = windowRecord[MOCK_ORIGINAL_FETCH_KEY] as typeof window.fetch | undefined
      if (installedMockFetch && window.fetch === installedMockFetch && originalFetch) {
        window.fetch = originalFetch
      }
      windowRecord[MOCK_INSTALLED_KEY] = false
      windowRecord[MOCK_ORIGINAL_FETCH_KEY] = undefined
    })
  }
}
