/**
 * 拼图版式配置常量
 *
 * 术语 = layoutControls
 * 具体含义：版式内部可拖拽分割线的位置比例，只保存 0~1 的边界值，不保存最终像素 cells。
 *
 * 术语 = adjustableGuides
 * 具体含义：前端可渲染的拖拽手柄描述，声明方向、控制字段、视觉名称，供 ImageStitch.vue 统一消费。
 *
 * 术语 = adjacency
 * 具体含义：格子邻接关系，用于 gutterPx 在像素阶段的半边扣减。
 */

/** 内容盒宽高比（所有版式归一化后均填满 [0,1]²，R_content 恒为 1） */
export const R_CONTENT = 1

/** 默认 gutter 像素 */
export const DEFAULT_GUTTER_PX = 4

/** 最小 cell 尺寸（像素） */
export const MIN_CELL_SIZE_PX = 120

/** 默认画布基准尺寸（像素） */
export const DEFAULT_CANVAS_SIZE = 1200

/** 支持的长宽比 */
export const ASPECT_RATIOS = {
  '1:1': { w: 1, h: 1 },
  '3:4': { w: 3, h: 4 },
}

/** 默认拼图类型 */
export const DEFAULT_PUZZLE_TYPE = 'p3'

/** 默认长宽比 */
export const DEFAULT_ASPECT_RATIO = '1:1'

const cloneControls = (controls) => ({ ...controls })

export const PUZZLE_CONFIGS = {
  p3: {
    pieceCount: 3,
    slotIds: ['p3_left', 'p3_topRight', 'p3_bottomRight'],
    defaultAspectRatio: '1:1',
    defaultLayoutControls: {
      splitX: 2 / 3,
      splitY: 1 / 2,
    },
    adjustableGuides: [
      { id: 'p3_splitX', orientation: 'vertical', controlKey: 'splitX', label: '左右分割线' },
      { id: 'p3_splitY', orientation: 'horizontal', controlKey: 'splitY', label: '右侧上下分割线' },
    ],
    adjacency: [
      { right: true, bottom: false },
      { left: true, bottom: true },
      { left: true, top: true },
    ],
  },

  p4: {
    pieceCount: 4,
    slotIds: ['p4_left', 'p4_topRight', 'p4_midRight', 'p4_bottomRight'],
    defaultAspectRatio: '1:1',
    defaultLayoutControls: {
      splitX: 2 / 3,
      rightSplitY1: 1 / 3,
      rightSplitY2: 2 / 3,
    },
    adjustableGuides: [
      { id: 'p4_splitX', orientation: 'vertical', controlKey: 'splitX', label: '左右分割线' },
      { id: 'p4_rightSplitY1', orientation: 'horizontal', controlKey: 'rightSplitY1', label: '右侧上中分割线' },
      { id: 'p4_rightSplitY2', orientation: 'horizontal', controlKey: 'rightSplitY2', label: '右侧中下分割线' },
    ],
    adjacency: [
      { right: true, bottom: false },
      { left: true, bottom: true },
      { left: true, top: true, bottom: true },
      { left: true, top: true },
    ],
  },

  p5: {
    pieceCount: 5,
    slotIds: ['p5_topLeft', 'p5_topRight', 'p5_bottomLeft', 'p5_bottomMid', 'p5_bottomRight'],
    defaultAspectRatio: '1:1',
    defaultLayoutControls: {
      splitY: 1 / 2,
      topSplitX: 1 / 2,
      bottomSplitX1: 1 / 3,
      bottomSplitX2: 2 / 3,
    },
    adjustableGuides: [
      { id: 'p5_splitY', orientation: 'horizontal', controlKey: 'splitY', label: '上下分割线' },
      { id: 'p5_topSplitX', orientation: 'vertical', controlKey: 'topSplitX', label: '上排左右分割线' },
      { id: 'p5_bottomSplitX1', orientation: 'vertical', controlKey: 'bottomSplitX1', label: '下排左中分割线' },
      { id: 'p5_bottomSplitX2', orientation: 'vertical', controlKey: 'bottomSplitX2', label: '下排中右分割线' },
    ],
    adjacency: [
      { right: true, bottom: true },
      { left: true, bottom: true },
      { top: true, right: true },
      { top: true, left: true, right: true },
      { top: true, left: true },
    ],
  },

  p6: {
    pieceCount: 6,
    slotIds: [
      'p6_left',
      'p6_topRight',
      'p6_midRight',
      'p6_bottomLeft',
      'p6_bottomMid',
      'p6_bottomRight',
    ],
    defaultAspectRatio: '1:1',
    defaultLayoutControls: {
      splitX: 2 / 3,
      upperBottomY: 3 / 4,
      rightSplitY: 3 / 8,
      bottomSplitX1: 1 / 3,
      bottomSplitX2: 2 / 3,
    },
    adjustableGuides: [
      { id: 'p6_splitX', orientation: 'vertical', controlKey: 'splitX', label: '左右分割线' },
      { id: 'p6_upperBottomY', orientation: 'horizontal', controlKey: 'upperBottomY', label: '上区与底排分割线' },
      { id: 'p6_rightSplitY', orientation: 'horizontal', controlKey: 'rightSplitY', label: '右侧上下分割线' },
      { id: 'p6_bottomSplitX1', orientation: 'vertical', controlKey: 'bottomSplitX1', label: '底排左中分割线' },
      { id: 'p6_bottomSplitX2', orientation: 'vertical', controlKey: 'bottomSplitX2', label: '底排中右分割线' },
    ],
    adjacency: [
      { right: true, bottom: true },
      { left: true, bottom: true },
      { left: true, top: true, bottom: true },
      { top: true, right: true },
      { top: true, left: true, right: true },
      { top: true, left: true },
    ],
  },
}

export function getDefaultLayoutControls(puzzleType) {
  const cfg = PUZZLE_CONFIGS[puzzleType]
  if (!cfg) throw new Error(`Unknown puzzleType: ${puzzleType}`)
  return cloneControls(cfg.defaultLayoutControls)
}

export function createInitialLayoutControlsByType() {
  return Object.fromEntries(
    Object.keys(PUZZLE_CONFIGS).map((type) => [type, getDefaultLayoutControls(type)])
  )
}
