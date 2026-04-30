/**
 * 会话 ID 工具（单例）
 *
 * 同一浏览器 profile 内所有页面（ImageStitch、VideoGeneration、广告链）
 * 共享同一个 sessionId，保证：
 *   - fetch-image 写入公共临时目录 {sessionId}/
 *   - stitch 读取同一目录
 *   - 外链回写与下载链路路径对齐
 *
 * 多人隔离：不同浏览器/隐身窗口 = 不同 localStorage → 不同 sid。
 *
 * 用法：
 *   import { getSessionId, SESSION_KEY } from '@/utils/session'
 *   const headers = { 'x-session-id': getSessionId() }
 */

/** localStorage key（与 VideoGeneration、ImageStitch、广告链统一） */
export const SESSION_KEY = 'x-session-id'

/** 模块级缓存：同一 JS 运行时内 sid 恒定，避免重复读 localStorage */
let cachedSid = null

/**
 * 生成新的会话 ID
 * 格式：sid_{8位随机}_{时间戳36进制}
 */
function generateSessionId() {
  const randomPart = Math.random().toString(36).slice(2, 10)
  const timePart = Date.now().toString(36)
  return `sid_${randomPart}_${timePart}`
}

/**
 * 获取或创建持久化会话 ID
 *
 * 优先级：
 *   1. 模块级缓存 cachedSid（同标签页内绝对恒定）
 *   2. localStorage.getItem(SESSION_KEY)（跨标签页/刷新后持久化）
 *   3. 生成新 sid 并写入 localStorage
 *
 * 降级：localStorage 不可用时使用内存 fallback
 *
 * @returns {string} 会话 ID
 */
export function getSessionId() {
  // 单例缓存：已解析过则直接返回
  if (cachedSid) {
    return cachedSid
  }

  try {
    let sid = localStorage.getItem(SESSION_KEY)

    // 验证格式：必须以 sid_ 开头（排除旧格式或脏数据）
    if (!sid || typeof sid !== 'string' || !sid.startsWith('sid_')) {
      sid = generateSessionId()
      localStorage.setItem(SESSION_KEY, sid)
    }

    cachedSid = sid
    return sid
  } catch (_e) {
    // localStorage 不可用（隐私模式/存储满等），使用全局内存降级
    if (!window.__sharedSessionId) {
      window.__sharedSessionId = generateSessionId()
    }
    cachedSid = window.__sharedSessionId
    return cachedSid
  }
}

/**
 * 重置会话 ID（仅用于测试/调试，生产勿调用）
 */
export function resetSessionId() {
  cachedSid = null
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (_e) { /* ignore */ }
  delete window.__sharedSessionId
}
