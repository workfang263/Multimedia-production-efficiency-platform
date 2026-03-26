#!/usr/bin/env bash
# 在无 Node 的机器上跑 HTTP 冒烟：依赖 Docker。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:8081}"
echo ">>> 使用 Docker (node:20-alpine) 执行冒烟，SMOKE_BASE_URL=$SMOKE_BASE_URL"
docker run --rm \
  --network host \
  -v "$ROOT:/work" \
  -w /work \
  -e SMOKE_BASE_URL \
  node:20-alpine \
  node scripts/smoke-platform.mjs
