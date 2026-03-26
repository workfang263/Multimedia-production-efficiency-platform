#!/usr/bin/env node
/**
 * 融合平台 HTTP 冒烟：需在 Nginx + api-gateway（及依赖）已启动后执行。
 *
 * 用法：
 *   SMOKE_BASE_URL=http://127.0.0.1:8081 node scripts/smoke-platform.mjs
 *   # 或测公网（本机可访问公网 IP:8081 时）
 *   SMOKE_BASE_URL=http://你的IP:8081 node scripts/smoke-platform.mjs
 *
 * 退出码：0 全部通过，1 有失败。
 */

const base = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8081').replace(/\/$/, '')

function fail(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`)
  process.exitCode = 1
}

function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`)
}

async function fetchJson(path) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { _raw: text }
  }
  return { res, data }
}

async function main() {
  console.log(`SMOKE_BASE_URL=${base}\n`)

  // 1) 静态入口（经 Nginx）
  {
    const r = await fetch(`${base}/`)
    if (!r.ok) {
      fail(`GET / 期望 2xx，实际 ${r.status}`)
    } else {
      ok('GET / 可访问（前端静态或回退 index.html）')
    }
  }

  // 2) 网关健康
  {
    const { res, data } = await fetchJson('/api/health')
    if (!res.ok) {
      fail(`/api/health HTTP ${res.status}`)
    } else if (data?.status !== 'healthy') {
      fail(`/api/health 响应异常: ${JSON.stringify(data)}`)
    } else {
      ok(`/api/health status=healthy`)
    }
  }

  // 3) 服务状态（含 video-service /ffmpeg 探测）
  {
    const { res, data } = await fetchJson('/api/services/status')
    if (!res.ok) {
      fail(`/api/services/status HTTP ${res.status}`)
    } else {
      const vg = data?.videoGeneration
      const st = vg?.status
      if (st === 'healthy') {
        ok(`/api/services/status videoGeneration=healthy`)
      } else {
        fail(
          `/api/services/status videoGeneration 非 healthy: ${JSON.stringify(vg)}（请确认 video-service 与网关 VIDEO_GENERATION_URL）`
        )
      }
    }
  }

  // 4) 轻量 JSON 接口
  {
    const { res, data } = await fetchJson('/api/image-links')
    if (!res.ok) {
      fail(`/api/image-links HTTP ${res.status}`)
    } else if (data?.success !== true) {
      fail(`/api/image-links 未返回 success:true`)
    } else {
      ok(`/api/image-links success（links 条数可忽略）`)
    }
  }

  if (process.exitCode === 1) {
    console.error(
      '\n提示：请在项目根执行 `docker compose up -d`，并确认 80 端口映射到 Nginx。'
    )
  } else {
    console.log('\n\x1b[32m全部冒烟检查通过。\x1b[0m')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
