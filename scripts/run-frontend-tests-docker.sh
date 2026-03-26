#!/usr/bin/env bash
# 在无 Node/npm 的机器上跑前端 Vitest：依赖 Docker + 官方 node 镜像。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo ">>> 使用 Docker (node:20-alpine) 在 frontend 内执行: npm ci && npm run test"
docker run --rm \
  -v "$ROOT/frontend:/app" \
  -w /app \
  node:20-alpine \
  sh -c 'npm ci && npm run test'
