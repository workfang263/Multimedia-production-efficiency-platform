import { describe, it, expect, beforeEach } from 'vitest'
import { getSessionId, SESSION_KEY, resetSessionId } from './session'

// happy-dom provides localStorage
beforeEach(() => {
  localStorage.clear()
  resetSessionId()
})

describe('getSessionId', () => {
  it('首次调用生成 sid_ 前缀的新 ID', () => {
    const sid = getSessionId()
    expect(sid).toMatch(/^sid_/)
  })

  it('同一运行时内多次调用返回相同 ID（单例缓存）', () => {
    const a = getSessionId()
    const b = getSessionId()
    expect(a).toBe(b)
  })

  it('写入 localStorage 持久化', () => {
    const sid = getSessionId()
    expect(localStorage.getItem(SESSION_KEY)).toBe(sid)
  })

  it('resetSessionId 后生成新 ID', () => {
    const old = getSessionId()
    resetSessionId()
    const fresh = getSessionId()
    expect(fresh).not.toBe(old)
  })

  it('localStorage 已有有效 sid 时复用', () => {
    localStorage.setItem(SESSION_KEY, 'sid_preexist_abc')
    const sid = getSessionId()
    expect(sid).toBe('sid_preexist_abc')
  })

  it('localStorage 中格式无效时重新生成', () => {
    localStorage.setItem(SESSION_KEY, 'bad-format')
    const sid = getSessionId()
    expect(sid).not.toBe('bad-format')
    expect(sid).toMatch(/^sid_/)
  })

  it('localStorage 为空字符串时重新生成', () => {
    localStorage.setItem(SESSION_KEY, '')
    const sid = getSessionId()
    expect(sid).toMatch(/^sid_/)
  })
})
