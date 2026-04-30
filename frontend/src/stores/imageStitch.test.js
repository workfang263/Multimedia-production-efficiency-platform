import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImageStitchStore } from './imageStitch'
import { DEFAULT_CANVAS_SIZE } from '@/utils/constants'

describe('imageStitch store layoutControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始化时兼容旧 p3 layoutRatios', () => {
    const store = useImageStitchStore()

    expect(store.layoutRatios.canvasSize).toBe(DEFAULT_CANVAS_SIZE)
    expect(store.layoutRatios.splitX).toBeCloseTo(2 / 3, 4)
    expect(store.layoutRatios.splitY).toBeCloseTo(1 / 2, 4)
    expect(store.getLayoutControls('p3').splitX).toBeCloseTo(store.layoutRatios.splitX, 4)
    expect(store.getLayoutControls('p3').splitY).toBeCloseTo(store.layoutRatios.splitY, 4)
  })

  it('updateSplitXFromLeftWidth 会回写到统一 layoutControls', () => {
    const store = useImageStitchStore()

    store.updateSplitXFromLeftWidth(720)

    expect(store.layoutRatios.splitX).toBeCloseTo(0.6, 3)
    expect(store.getLayoutControls('p3').splitX).toBeCloseTo(0.6, 3)
  })

  it('p4 自定义 layoutControls 后 currentCells 仍返回 4 个格子', () => {
    const store = useImageStitchStore()

    store.switchPuzzleType('p4')
    store.updateLayoutControl('p4', 'splitX', 0.58)
    store.updateLayoutControl('p4', 'rightSplitY1', 0.22)
    store.updateLayoutControl('p4', 'rightSplitY2', 0.74)

    const controls = store.getLayoutControls('p4')
    expect(controls.rightSplitY1).toBeLessThan(controls.rightSplitY2)
    expect(store.currentCells.cells).toHaveLength(4)
    store.currentCells.cells.forEach((cell) => {
      expect(cell.w).toBeGreaterThan(0)
      expect(cell.h).toBeGreaterThan(0)
    })
  })
})
