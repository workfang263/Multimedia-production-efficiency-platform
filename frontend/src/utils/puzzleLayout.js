/**
 * 拼图布局计算工具
 *
 * 单一真相源：所有格子坐标仅由此模块产出。后端不维护第二套布局算法。
 *
 * computeCells 管道：
 *   1. 读版式默认配置与 layoutControls → 2. 计算 contentBox 像素（铺满画布） →
 *   3. layoutControls 归一化生成 raw normCells → 4. 映射到 contentBox 像素 →
 *   5. 扣 gutterPx 得最终 cells
 *
 * gutterPx 语义（硬约束）：
 *   - gutterPx 仅在 contentBox 像素阶段扣除
 *   - 不得参与归一化坐标运算，不得被额外缩放系数二次缩放
 *   - 每格从其有邻接关系的边缘扣除 gutterPx/2
 *   - 相邻两格净空恒为 gutterPx（允许 ±1px 取整误差）
 */

import {
  PUZZLE_CONFIGS,
  DEFAULT_GUTTER_PX,
  MIN_CELL_SIZE_PX,
  getDefaultLayoutControls,
} from './constants'

export function getPieceCount(puzzleType) {
  const cfg = PUZZLE_CONFIGS[puzzleType]
  if (!cfg) throw new Error(`Unknown puzzleType: ${puzzleType}`)
  return cfg.pieceCount
}

/**
 * 计算内容区：当前策略为内容区直接铺满画布，不再使用 3:4 居中留白。
 *
 * @param {{ width: number, height: number }} canvas - 画布像素尺寸
 * @param {string} _aspectRatio - '1:1'|'3:4'
 * @returns {{ x: number, y: number, width: number, height: number }} contentBox（整数像素）
 */
function computeContentBox(canvas, _aspectRatio) {
  const { width, height } = canvas
  return { x: 0, y: 0, width, height }
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function getAxisMinRatio(contentSize, segments) {
  const ratio = MIN_CELL_SIZE_PX / Math.max(1, contentSize)
  const hardCap = (1 / segments) - 0.0001
  return Math.min(ratio, hardCap)
}

function buildNormCells(puzzleType, controls) {
  switch (puzzleType) {
    case 'p3':
      return [
        { x: 0, y: 0, w: controls.splitX, h: 1 },
        { x: controls.splitX, y: 0, w: 1 - controls.splitX, h: controls.splitY },
        { x: controls.splitX, y: controls.splitY, w: 1 - controls.splitX, h: 1 - controls.splitY },
      ]
    case 'p4':
      return [
        { x: 0, y: 0, w: controls.splitX, h: 1 },
        { x: controls.splitX, y: 0, w: 1 - controls.splitX, h: controls.rightSplitY1 },
        {
          x: controls.splitX,
          y: controls.rightSplitY1,
          w: 1 - controls.splitX,
          h: controls.rightSplitY2 - controls.rightSplitY1,
        },
        { x: controls.splitX, y: controls.rightSplitY2, w: 1 - controls.splitX, h: 1 - controls.rightSplitY2 },
      ]
    case 'p5':
      return [
        { x: 0, y: 0, w: controls.topSplitX, h: controls.splitY },
        { x: controls.topSplitX, y: 0, w: 1 - controls.topSplitX, h: controls.splitY },
        { x: 0, y: controls.splitY, w: controls.bottomSplitX1, h: 1 - controls.splitY },
        {
          x: controls.bottomSplitX1,
          y: controls.splitY,
          w: controls.bottomSplitX2 - controls.bottomSplitX1,
          h: 1 - controls.splitY,
        },
        { x: controls.bottomSplitX2, y: controls.splitY, w: 1 - controls.bottomSplitX2, h: 1 - controls.splitY },
      ]
    case 'p6':
      return [
        { x: 0, y: 0, w: controls.splitX, h: controls.upperBottomY },
        { x: controls.splitX, y: 0, w: 1 - controls.splitX, h: controls.rightSplitY },
        {
          x: controls.splitX,
          y: controls.rightSplitY,
          w: 1 - controls.splitX,
          h: controls.upperBottomY - controls.rightSplitY,
        },
        { x: 0, y: controls.upperBottomY, w: controls.bottomSplitX1, h: 1 - controls.upperBottomY },
        {
          x: controls.bottomSplitX1,
          y: controls.upperBottomY,
          w: controls.bottomSplitX2 - controls.bottomSplitX1,
          h: 1 - controls.upperBottomY,
        },
        {
          x: controls.bottomSplitX2,
          y: controls.upperBottomY,
          w: 1 - controls.bottomSplitX2,
          h: 1 - controls.upperBottomY,
        },
      ]
    default:
      throw new Error(`Unknown puzzleType: ${puzzleType}`)
  }
}

/**
 * 规范化拖拽比例，保证最小尺寸、顺序与几何合法。
 *
 * @param {Object} params
 * @param {string} params.puzzleType
 * @param {Object} [params.layoutControls]
 * @param {number} params.canvasWidth
 * @param {number} params.canvasHeight
 * @param {string} params.aspectRatio
 * @param {{x:number,y:number,width:number,height:number}} [params.contentBox]
 * @returns {Object}
 */
export function normalizeLayoutControls({
  puzzleType,
  layoutControls,
  canvasWidth,
  canvasHeight,
  aspectRatio,
  contentBox,
}) {
  const cfg = PUZZLE_CONFIGS[puzzleType]
  if (!cfg) throw new Error(`Unknown puzzleType: ${puzzleType}`)

  const resolvedContentBox = contentBox || computeContentBox({ width: canvasWidth, height: canvasHeight }, aspectRatio)
  const cbW = resolvedContentBox.width
  const cbH = resolvedContentBox.height
  const defaults = getDefaultLayoutControls(puzzleType)
  const raw = { ...defaults, ...(layoutControls || {}) }

  const xMin2 = getAxisMinRatio(cbW, 2)
  const xMin3 = getAxisMinRatio(cbW, 3)
  const yMin2 = getAxisMinRatio(cbH, 2)
  const yMin3 = getAxisMinRatio(cbH, 3)

  switch (puzzleType) {
    case 'p3': {
      const splitX = clamp(raw.splitX, xMin2, 1 - xMin2)
      const splitY = clamp(raw.splitY, yMin2, 1 - yMin2)
      return { splitX, splitY }
    }
    case 'p4': {
      const splitX = clamp(raw.splitX, xMin2, 1 - xMin2)
      const rightSplitY1 = clamp(raw.rightSplitY1, yMin3, 1 - (2 * yMin3))
      const rightSplitY2 = clamp(raw.rightSplitY2, rightSplitY1 + yMin3, 1 - yMin3)
      return { splitX, rightSplitY1, rightSplitY2 }
    }
    case 'p5': {
      const splitY = clamp(raw.splitY, yMin2, 1 - yMin2)
      const topSplitX = clamp(raw.topSplitX, xMin2, 1 - xMin2)
      const bottomSplitX1 = clamp(raw.bottomSplitX1, xMin3, 1 - (2 * xMin3))
      const bottomSplitX2 = clamp(raw.bottomSplitX2, bottomSplitX1 + xMin3, 1 - xMin3)
      return { splitY, topSplitX, bottomSplitX1, bottomSplitX2 }
    }
    case 'p6': {
      const splitX = clamp(raw.splitX, xMin2, 1 - xMin2)
      const upperBottomY = clamp(raw.upperBottomY, 2 * yMin3, 1 - yMin3)
      const rightSplitY = clamp(raw.rightSplitY, yMin3, upperBottomY - yMin3)
      const bottomSplitX1 = clamp(raw.bottomSplitX1, xMin3, 1 - (2 * xMin3))
      const bottomSplitX2 = clamp(raw.bottomSplitX2, bottomSplitX1 + xMin3, 1 - xMin3)
      return { splitX, upperBottomY, rightSplitY, bottomSplitX1, bottomSplitX2 }
    }
    default:
      return defaults
  }
}

/**
 * 计算拼图格子坐标
 *
 * @param {Object} params
 * @param {string}  params.puzzleType  - 'p3'|'p4'|'p5'|'p6'
 * @param {string}  params.aspectRatio - '1:1'|'3:4'
 * @param {number}  params.canvasWidth  - 画布宽度（px）
 * @param {number}  params.canvasHeight - 画布高度（px）
 * @param {number}  [params.gutterPx]   - 缝宽（px），默认 4
 * @param {Object}  [params.layoutControls] - 拖拽后的版式比例参数
 * @returns {{ cells: Array<{x:number,y:number,w:number,h:number}>, contentBox: {x:number,y:number,width:number,height:number} }}
 */
export function computeCells({
  puzzleType,
  aspectRatio,
  canvasWidth,
  canvasHeight,
  gutterPx,
  layoutControls,
}) {
  const cfg = PUZZLE_CONFIGS[puzzleType]
  if (!cfg) throw new Error(`Unknown puzzleType: ${puzzleType}`)

  const g = typeof gutterPx === 'number' && gutterPx >= 0 ? Math.round(gutterPx) : DEFAULT_GUTTER_PX
  const halfG = g / 2

  const canvas = { width: canvasWidth, height: canvasHeight }
  const contentBox = computeContentBox(canvas, aspectRatio)
  const { width: cbW, height: cbH } = contentBox

  const normalizedControls = normalizeLayoutControls({
    puzzleType,
    layoutControls,
    canvasWidth,
    canvasHeight,
    aspectRatio,
    contentBox,
  })
  const normCells = buildNormCells(puzzleType, normalizedControls)

  const rawCells = normCells.map((nc) => ({
    x: contentBox.x + nc.x * cbW,
    y: contentBox.y + nc.y * cbH,
    w: nc.w * cbW,
    h: nc.h * cbH,
  }))

  const shrunkCells = rawCells.map((rc, i) => {
    const adj = cfg.adjacency[i]
    let x = rc.x
    let y = rc.y
    let w = rc.w
    let h = rc.h

    if (adj.left) {
      x += halfG
      w -= halfG
    }
    if (adj.right) {
      w -= halfG
    }
    if (adj.top) {
      y += halfG
      h -= halfG
    }
    if (adj.bottom) {
      h -= halfG
    }

    return { x, y, w, h }
  })

  const cells = shrunkCells.map((sc, i) => {
    const adj = cfg.adjacency[i]
    const x = Math.floor(sc.x)
    const y = Math.floor(sc.y)

    const w = adj.right
      ? Math.max(1, Math.floor(sc.x + sc.w) - x)
      : Math.max(1, Math.round(sc.w))

    const h = adj.bottom
      ? Math.max(1, Math.floor(sc.y + sc.h) - y)
      : Math.max(1, Math.round(sc.h))

    return { x, y, w, h }
  })

  return { cells, contentBox }
}

/**
 * 验证 cells 是否全部落在 contentBox 内（用于测试断言）
 */
export function cellsWithinContentBox(cells, contentBox) {
  const cbR = contentBox.x + contentBox.width
  const cbB = contentBox.y + contentBox.height
  return cells.every(
    (c) =>
      c.x >= contentBox.x &&
      c.y >= contentBox.y &&
      c.x + c.w <= cbR &&
      c.y + c.h <= cbB
  )
}

/**
 * 获取相邻格之间的净空距离（用于测试断言缝宽 = gutterPx）
 * 返回所有相邻格对的水平/垂直净空数组
 */
export function getGaps(cells, _normCells, adjacency) {
  const gaps = []

  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const adjI = adjacency[i]
      const adjJ = adjacency[j]
      const a = cells[i]
      const b = cells[j]

      // 水平相邻：i 的右侧邻接 j 的左侧
      if (adjI.right && adjJ.left) {
        const aRight = a.x + a.w
        const bLeft = b.x
        const gap = bLeft - aRight
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        // 邻近过滤器：仅当 y 向有重叠且 gap ≤ 2*gutter（防中间隔了其他格）
        if (overlapY > 0 && Math.abs(gap) <= 20) {
          gaps.push({ type: 'horizontal', between: [i, j], gap })
        }
      }

      // 垂直相邻：i 的下方邻接 j 的上方
      if (adjI.bottom && adjJ.top) {
        const aBottom = a.y + a.h
        const bTop = b.y
        const gap = bTop - aBottom
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        if (overlapX > 0 && Math.abs(gap) <= 20) {
          gaps.push({ type: 'vertical', between: [i, j], gap })
        }
      }
    }
  }

  return gaps
}
