import { describe, it, expect } from 'vitest'
import {
  computeCells,
  getPieceCount,
  cellsWithinContentBox,
  getGaps,
  normalizeLayoutControls,
} from './puzzleLayout'
import { PUZZLE_CONFIGS, MIN_CELL_SIZE_PX } from './constants'

// ================================ 辅助函数 ================================

function makeOpts(puzzleType, aspectRatio, canvasW, canvasH, gutterPx = 4, layoutControls) {
  return { puzzleType, aspectRatio, canvasWidth: canvasW, canvasHeight: canvasH, gutterPx, layoutControls }
}

/** 检查 cells 互不重叠 */
function noOverlap(cells) {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j]
      const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
      const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      if (overlapX > 0 && overlapY > 0) return false
    }
  }
  return true
}

/** 检查 contentBox 是否铺满画布 */
function contentBoxFullCanvas(contentBox, canvasW, canvasH) {
  return (
    contentBox.x === 0 &&
    contentBox.y === 0 &&
    contentBox.width === canvasW &&
    contentBox.height === canvasH
  )
}

// ================================ getPieceCount ================================

describe('getPieceCount', () => {
  it('p3 → 3', () => expect(getPieceCount('p3')).toBe(3))
  it('p4 → 4', () => expect(getPieceCount('p4')).toBe(4))
  it('p5 → 5', () => expect(getPieceCount('p5')).toBe(5))
  it('p6 → 6', () => expect(getPieceCount('p6')).toBe(6))
  it('未知类型抛错', () => {
    expect(() => getPieceCount('p99')).toThrow('Unknown puzzleType')
  })
})

// ================================ 核心黄金用例 ================================

describe('computeCells — 黄金用例', () => {
  const canvasSizes = [
    { w: 1200, h: 1200, label: '1200×1200' },
    { w: 900, h: 1200, label: '900×1200' },
    { w: 600, h: 600, label: '600×600' },
    { w: 450, h: 600, label: '450×600' },
  ]

  const types = ['p3', 'p4', 'p5', 'p6']
  const ratios = ['1:1', '3:4']
  const gutters = [0, 4, 8]

  for (const cs of canvasSizes) {
    for (const type of types) {
      for (const ratio of ratios) {
        // 跳过不匹配的画布比例组合（3:4 需宽:高=3:4）
        if (ratio === '3:4' && cs.w * 4 !== cs.h * 3) continue
        if (ratio === '1:1' && cs.w !== cs.h) continue

        for (const g of gutters) {
          it(`${type} ${ratio} ${cs.label} gutter=${g}`, () => {
            const { cells, contentBox } = computeCells(
              makeOpts(type, ratio, cs.w, cs.h, g)
            )

            const cfg = PUZZLE_CONFIGS[type]

            // 1. 数量
            expect(cells).toHaveLength(cfg.pieceCount)

            // 2. 互不重叠
            expect(noOverlap(cells)).toBe(true)

            // 3. 全部在 canvas 内
            expect(cellsWithinContentBox(cells, { x: 0, y: 0, width: cs.w, height: cs.h })).toBe(true)

            // 4. 全部在 contentBox 内
            expect(cellsWithinContentBox(cells, contentBox)).toBe(true)

            // 5. contentBox 铺满画布
            expect(contentBoxFullCanvas(contentBox, cs.w, cs.h)).toBe(true)

            // 6. cell 宽高均 > 0
            cells.forEach((c, i) => {
              expect(c.w).toBeGreaterThan(0)
              expect(c.h).toBeGreaterThan(0)
            })

            // 7. gutter=0 时相邻格无间隙
            if (g === 0) {
              const gaps = getGaps(cells, cfg.normCells, cfg.adjacency)
              gaps.forEach((gap) => {
                expect(Math.abs(gap.gap)).toBeLessThanOrEqual(1)
              })
            }

            // 8. gutter>0 时相邻缝宽 = gutterPx（允许 ±1px）
            if (g > 0) {
              const gaps = getGaps(cells, cfg.normCells, cfg.adjacency)
              expect(gaps.length).toBeGreaterThan(0)
              gaps.forEach((gap) => {
                expect(Math.abs(gap.gap - g)).toBeLessThanOrEqual(1)
              })
            }
          })
        }
      }
    }
  }
})

// ================================ contentBox 口径一致性 ================================

describe('contentBox 跨长宽比行为', () => {
  const types = ['p3', 'p4', 'p5', 'p6']

  for (const type of types) {
    it(`${type}: 1:1 和 3:4 下 contentBox 都应铺满画布`, () => {
      const r1 = computeCells(makeOpts(type, '1:1', 1200, 1200, 4))
      const r2 = computeCells(makeOpts(type, '3:4', 900, 1200, 4))

      expect(contentBoxFullCanvas(r1.contentBox, 1200, 1200)).toBe(true)
      expect(contentBoxFullCanvas(r2.contentBox, 900, 1200)).toBe(true)
    })
  }
})

// ================================ 3:4 全画布铺满 ================================

describe('3:4 full canvas', () => {
  it('contentBox 直接等于 3:4 画布', () => {
    const { contentBox } = computeCells(makeOpts('p3', '3:4', 900, 1200, 4))
    expect(contentBox).toEqual({ x: 0, y: 0, width: 900, height: 1200 })
  })

  it('cells 在 3:4 下覆盖画布上下边界', () => {
    const { cells } = computeCells(makeOpts('p3', '3:4', 900, 1200, 4))
    const top = Math.min(...cells.map((c) => c.y))
    const bottom = Math.max(...cells.map((c) => c.y + c.h))
    expect(top).toBe(0)
    expect(bottom).toBe(1200)
  })
})

// ================================ p6 几何专项 ================================

describe('p6 几何', () => {
  it('6 格互不重叠且均在 contentBox 内', () => {
    const { cells, contentBox } = computeCells(makeOpts('p6', '1:1', 1200, 1200, 4))
    expect(cells).toHaveLength(6)
    expect(noOverlap(cells)).toBe(true)
    expect(cellsWithinContentBox(cells, contentBox)).toBe(true)
  })

  it('左大(格0)高度 = contentBox.height - bottomRowHeight - rowGutter', () => {
    const g = 4
    const { cells, contentBox } = computeCells(makeOpts('p6', '1:1', 1200, 1200, g))
    const cell0 = cells[0]

    // 底行高度 = contentBox.height * 1/4
    const bottomRowHeight = contentBox.height / 4

    // cell0 高度应约等于 contentBox.height - bottomRowHeight - g
    // (cell0 从底部 edge 缩进了 g/2，底行从顶部 edge 缩进了 g/2，总共 g)
    const expectedH = contentBox.height - bottomRowHeight - g
    expect(Math.abs(cell0.h - expectedH)).toBeLessThanOrEqual(2)
  })

  it('底部 3 格高度一致', () => {
    const { cells } = computeCells(makeOpts('p6', '1:1', 1200, 1200, 4))
    const h3 = cells[3].h
    const h4 = cells[4].h
    const h5 = cells[5].h
    expect(Math.abs(h3 - h4)).toBeLessThanOrEqual(1)
    expect(Math.abs(h4 - h5)).toBeLessThanOrEqual(1)
  })
})

// ================================ 整数像素纪律 ================================

describe('整数像素', () => {
  it('所有坐标和尺寸为整数', () => {
    for (const type of ['p3', 'p4', 'p5', 'p6']) {
      const { cells, contentBox } = computeCells(makeOpts(type, '1:1', 1200, 1200, 4))
      expect(Number.isInteger(contentBox.x)).toBe(true)
      expect(Number.isInteger(contentBox.y)).toBe(true)
      expect(Number.isInteger(contentBox.width)).toBe(true)
      expect(Number.isInteger(contentBox.height)).toBe(true)
      cells.forEach((c) => {
        expect(Number.isInteger(c.x)).toBe(true)
        expect(Number.isInteger(c.y)).toBe(true)
        expect(Number.isInteger(c.w)).toBe(true)
        expect(Number.isInteger(c.h)).toBe(true)
      })
    }
  })
})

// ================================ layoutControls 规范化 ================================

describe('normalizeLayoutControls', () => {
  it('p4 顺序错误时自动收敛到合法边界', () => {
    const controls = normalizeLayoutControls({
      puzzleType: 'p4',
      layoutControls: { splitX: 0.9, rightSplitY1: 0.8, rightSplitY2: 0.2 },
      canvasWidth: 1200,
      canvasHeight: 1200,
      aspectRatio: '1:1',
    })

    expect(controls.splitX).toBeLessThan(1)
    expect(controls.rightSplitY1).toBeLessThan(controls.rightSplitY2)
  })

  it('p6 在小画布下也保证下排三格可分', () => {
    const controls = normalizeLayoutControls({
      puzzleType: 'p6',
      layoutControls: { bottomSplitX1: 0.9, bottomSplitX2: 0.95 },
      canvasWidth: 360,
      canvasHeight: 360,
      aspectRatio: '1:1',
    })

    expect(controls.bottomSplitX1).toBeLessThan(controls.bottomSplitX2)
    expect(controls.bottomSplitX2).toBeLessThan(1)
  })
})

// ================================ 自定义 layoutControls ================================

describe('computeCells with layoutControls', () => {
  it('p4 自定义左右比例后仍不重叠且全部合法', () => {
    const { cells, contentBox } = computeCells(
      makeOpts('p4', '1:1', 1200, 1200, 4, {
        splitX: 0.58,
        rightSplitY1: 0.22,
        rightSplitY2: 0.74,
      })
    )

    expect(noOverlap(cells)).toBe(true)
    expect(cellsWithinContentBox(cells, contentBox)).toBe(true)
    cells.forEach((cell) => {
      expect(cell.w).toBeGreaterThanOrEqual(MIN_CELL_SIZE_PX)
      expect(cell.h).toBeGreaterThanOrEqual(MIN_CELL_SIZE_PX)
    })
  })

  it('p5 自定义上下与下排三分后仍满足缝宽', () => {
    const { cells } = computeCells(
      makeOpts('p5', '1:1', 1200, 1200, 4, {
        splitY: 0.42,
        topSplitX: 0.44,
        bottomSplitX1: 0.28,
        bottomSplitX2: 0.7,
      })
    )

    const gaps = getGaps(cells, [], PUZZLE_CONFIGS.p5.adjacency)
    expect(gaps.length).toBeGreaterThan(0)
    gaps.forEach((gap) => {
      expect(Math.abs(gap.gap - 4)).toBeLessThanOrEqual(1)
    })
  })

  it('p6 自定义布局后底排与上区均保持最小尺寸', () => {
    const { cells, contentBox } = computeCells(
      makeOpts('p6', '1:1', 1200, 1200, 4, {
        splitX: 0.57,
        upperBottomY: 0.68,
        rightSplitY: 0.31,
        bottomSplitX1: 0.26,
        bottomSplitX2: 0.73,
      })
    )

    expect(noOverlap(cells)).toBe(true)
    expect(cellsWithinContentBox(cells, contentBox)).toBe(true)
    cells.forEach((cell) => {
      expect(cell.w).toBeGreaterThanOrEqual(MIN_CELL_SIZE_PX)
      expect(cell.h).toBeGreaterThanOrEqual(MIN_CELL_SIZE_PX)
    })
  })
})

// ================================ 边界：gutterPx 默认值 ================================

describe('默认 gutterPx', () => {
  it('不传 gutterPx 时默认 4', () => {
    const { cells } = computeCells({
      puzzleType: 'p3',
      aspectRatio: '1:1',
      canvasWidth: 1200,
      canvasHeight: 1200,
    })
    const gaps = getGaps(cells, PUZZLE_CONFIGS.p3.normCells, PUZZLE_CONFIGS.p3.adjacency)
    expect(gaps.length).toBeGreaterThan(0)
    gaps.forEach((g) => {
      expect(Math.abs(g.gap - 4)).toBeLessThanOrEqual(1)
    })
  })

  it('gutterPx=0 相邻格无重叠无间隙', () => {
    const { cells } = computeCells(makeOpts('p3', '1:1', 1200, 1200, 0))
    expect(noOverlap(cells)).toBe(true)
    const gaps = getGaps(cells, PUZZLE_CONFIGS.p3.normCells, PUZZLE_CONFIGS.p3.adjacency)
    gaps.forEach((g) => {
      expect(Math.abs(g.gap)).toBeLessThanOrEqual(1)
    })
  })
})
