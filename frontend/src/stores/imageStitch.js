import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { normalizeUrl } from '@/utils/urlNormalize'
import { computeCells, getPieceCount, normalizeLayoutControls } from '@/utils/puzzleLayout'
import {
  PUZZLE_CONFIGS,
  DEFAULT_PUZZLE_TYPE,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_GUTTER_PX,
  DEFAULT_CANVAS_SIZE,
  getDefaultLayoutControls,
  createInitialLayoutControlsByType,
} from '@/utils/constants'

export const useImageStitchStore = defineStore('imageStitch', () => {
  // ========== 素材列表 ==========
  const materials = ref([])

  // ========== 拼图配置 ==========
  const puzzleType = ref(DEFAULT_PUZZLE_TYPE)
  const aspectRatio = ref(DEFAULT_ASPECT_RATIO)
  const gutterPx = ref(DEFAULT_GUTTER_PX)

  // ========== 动态槽位 ==========
  const slots = ref(createEmptySlots(DEFAULT_PUZZLE_TYPE))

  // ========== 兼容层：保留 p3 旧接口 ==========
  const layoutRatios = reactive({
    splitX: getDefaultLayoutControls('p3').splitX,
    splitY: getDefaultLayoutControls('p3').splitY,
    canvasSize: DEFAULT_CANVAS_SIZE,
  })

  // ========== 新模型：按版式保存拖拽比例 ==========
  const layoutControlsByType = reactive(createInitialLayoutControlsByType())

  // ========== 辅助函数 ==========
  function createEmptySlots(type) {
    const cfg = PUZZLE_CONFIGS[type]
    if (!cfg) return {}
    const result = {}
    cfg.slotIds.forEach((id) => {
      result[id] = null
    })
    return result
  }

  function getSlotIds() {
    const cfg = PUZZLE_CONFIGS[puzzleType.value]
    return cfg ? cfg.slotIds : []
  }

  function syncLegacyP3Ratios() {
    const p3Controls = layoutControlsByType.p3 || getDefaultLayoutControls('p3')
    layoutRatios.splitX = p3Controls.splitX
    layoutRatios.splitY = p3Controls.splitY
  }

  function getLayoutControls(type = puzzleType.value) {
    return layoutControlsByType[type] || getDefaultLayoutControls(type)
  }

  function normalizeControlsForType(type, draftControls) {
    const canvas = getCanvasPixels()
    return normalizeLayoutControls({
      puzzleType: type,
      layoutControls: draftControls,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      aspectRatio: aspectRatio.value,
    })
  }

  function setLayoutControls(type, nextControls) {
    const normalized = normalizeControlsForType(type, nextControls)
    layoutControlsByType[type] = normalized
    if (type === 'p3') {
      syncLegacyP3Ratios()
    }
    return normalized
  }

  function updateLayoutControl(type, controlKey, nextRatio) {
    const current = getLayoutControls(type)
    return setLayoutControls(type, {
      ...current,
      [controlKey]: nextRatio,
    })
  }

  function resetLayoutControls(type = puzzleType.value) {
    return setLayoutControls(type, getDefaultLayoutControls(type))
  }

  // ========== 计算 cells：所有版式统一走 computeCells ==========
  const currentCells = computed(() => {
    const type = puzzleType.value
    const ratio = aspectRatio.value
    const g = gutterPx.value
    const canvas = getCanvasPixels()
    return computeCells({
      puzzleType: type,
      aspectRatio: ratio,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      gutterPx: g,
      layoutControls: getLayoutControls(type),
    })
  })

  function getCanvasPixels() {
    const ratio = aspectRatio.value
    if (ratio === '3:4') {
      const base = layoutRatios.canvasSize
      return { width: Math.round(base * 0.75), height: base }
    }
    const size = layoutRatios.canvasSize
    return { width: size, height: size }
  }

  // ========== p3 旧版尺寸计算（向后兼容，供现有输入框显示） ==========
  const imageSizes = computed(() => {
    if (puzzleType.value !== 'p3') {
      const { cells } = currentCells.value
      const slotIds = getSlotIds()
      const result = {}
      cells.forEach((c, i) => {
        if (slotIds[i]) result[slotIds[i]] = { width: c.w, height: c.h }
      })
      return result
    }

    const canvas = getCanvasPixels()
    const { splitX, splitY } = getLayoutControls('p3')

    const leftWidth = Math.round(canvas.width * splitX)
    const leftHeight = canvas.height
    const rightWidth = canvas.width - leftWidth
    const topRightHeight = Math.round(canvas.height * splitY)
    const bottomRightHeight = canvas.height - topRightHeight

    return {
      p3_left: { width: leftWidth, height: leftHeight },
      p3_topRight: { width: rightWidth, height: topRightHeight },
      p3_bottomRight: { width: rightWidth, height: bottomRightHeight },
    }
  })

  // ========== 初始化比例 ==========
  const initRatiosFromDefault = () => {
    layoutRatios.canvasSize = DEFAULT_CANVAS_SIZE
    resetLayoutControls('p3')
  }

  // ========== 拼图类型切换 ==========
  function switchPuzzleType(type) {
    if (!PUZZLE_CONFIGS[type]) return false
    puzzleType.value = type
    slots.value = createEmptySlots(type)
    if (!layoutControlsByType[type]) {
      layoutControlsByType[type] = getDefaultLayoutControls(type)
    }
    if (type === 'p3') {
      syncLegacyP3Ratios()
    }
    return true
  }

  // ========== 画布槽位操作（使用 slotIds） ==========
  function getSlotIdByIndex(index) {
    const ids = getSlotIds()
    return ids[index] || null
  }

  function setCanvasSlotByIndex(index, materialId, productInfo = null) {
    const slotId = getSlotIdByIndex(index)
    if (!slotId) return

    const newSlots = { ...slots.value }
    if (materialId === null) {
      newSlots[slotId] = null
    } else {
      newSlots[slotId] = { materialId, productInfo: productInfo || null }
    }
    slots.value = newSlots
  }

  function setCanvasSlot(slotId, materialId, productInfo = null) {
    const newSlots = { ...slots.value }
    if (materialId === null) {
      newSlots[slotId] = null
    } else {
      newSlots[slotId] = { materialId, productInfo: productInfo || null }
    }
    slots.value = newSlots
  }

  function clearCanvasSlot(slotId) {
    setCanvasSlot(slotId, null)
  }

  function resetCanvas() {
    slots.value = createEmptySlots(puzzleType.value)
  }

  // ========== 检查画布是否填满 ==========
  function isCanvasComplete() {
    const ids = getSlotIds()
    const N = getPieceCount(puzzleType.value)
    const filled = ids.filter((id) => {
      const d = slots.value[id]
      if (!d) return false
      return typeof d === 'object' ? !!d.materialId : !!d
    }).length
    return filled === N
  }

  // ========== 槽位商品信息 ==========
  function getSlotMaterialId(slotId) {
    const d = slots.value[slotId]
    if (!d) return null
    return typeof d === 'object' ? d.materialId : d
  }

  function getSlotProductInfo(slotId) {
    const d = slots.value[slotId]
    if (!d || typeof d !== 'object') return null
    return d.productInfo || null
  }

  function getAllSlotsProductInfo() {
    return getSlotIds()
      .map((id) => getSlotProductInfo(id))
      .filter(Boolean)
  }

  // ========== 素材管理 ==========
  function addMaterial(material) {
    materials.value.push(material)
    autoScanProductInfo(material).catch(() => {})
  }

  function removeMaterial(materialId) {
    const index = materials.value.findIndex((m) => m.id === materialId)
    if (index > -1) {
      materials.value.splice(index, 1)
      // 清空使用该素材的槽位
      const ids = getSlotIds()
      ids.forEach((id) => {
        const d = slots.value[id]
        if (d) {
          const mid = typeof d === 'object' ? d.materialId : d
          if (mid === materialId) setCanvasSlot(id, null)
        }
      })
    }
  }

  function getMaterialById(materialId) {
    return materials.value.find((m) => m.id === materialId) || null
  }

  async function autoScanProductInfo(material) {
    try {
      const { useAdCampaignStore } = await import('./adCampaign')
      const adCampaignStore = useAdCampaignStore()
      const materialUrl = material.originalUrl || material.publicUrl || material.previewUrl || ''
      if (!materialUrl) return
      const normalizedUrl = normalizeUrl(materialUrl)
      if (!normalizedUrl) return
      const imageToProduct = adCampaignStore.productDataMapping?.imageToProduct || {}
      const productInfo = imageToProduct[normalizedUrl]
      if (productInfo) {
        material.productInfo = {
          productId: productInfo.productId,
          productSpu: productInfo.productSpu,
          productImage: materialUrl,
        }
      }
    } catch (_e) { /* ignore */ }
  }

  // ========== p3 比例更新方法 ==========
  function updateSplitXFromLeftWidth(leftWidth) {
    const canvas = getCanvasPixels()
    if (!canvas.width) return
    updateLayoutControl('p3', 'splitX', leftWidth / canvas.width)
  }

  function updateSplitYFromTopRightHeight(topRightHeight) {
    const canvas = getCanvasPixels()
    if (!canvas.height) return
    updateLayoutControl('p3', 'splitY', topRightHeight / canvas.height)
  }

  function updateCanvasSize(newSize) {
    layoutRatios.canvasSize = Math.max(200, Math.min(2000, newSize))
  }

  // ========== 画布尺寸 ==========
  function getCanvasSize() {
    const sizes = imageSizes.value
    const ids = getSlotIds()
    const first = sizes[ids[0]] || { width: 800, height: 800 }
    const second = sizes[ids[1]] || { width: 400, height: 400 }
    return {
      width: first.width + second.width,
      height: first.height,
    }
  }

  function getCanvasSizeSquare() {
    const size = layoutRatios.canvasSize
    return { width: size, height: size, adjusted: false }
  }

  function getAdjustedSizesForSquare() {
    const sizes = imageSizes.value
    const ids = getSlotIds()
    const result = {}
    ids.forEach((id) => {
      result[id] = sizes[id] ? { ...sizes[id] } : { width: 400, height: 400 }
    })
    result.adjusted = false
    return result
  }

  function adjustRightSizesForSquare() { /* no-op in new layout system */ }
  function resetImageSizes() {
    layoutRatios.canvasSize = DEFAULT_CANVAS_SIZE
    resetLayoutControls('p3')
  }
  function setImageSize() { /* no-op */ }

  // ========== V2 请求体构建 ==========
  function buildStitchRequestPayload(imagePaths) {
    const canvas = getCanvasPixels()
    const { cells } = currentCells.value
    return {
      puzzleType: puzzleType.value,
      aspectRatio: aspectRatio.value,
      gutterPx: gutterPx.value,
      canvas: { width: canvas.width, height: canvas.height },
      images: imagePaths,
      cells: cells.map((c) => ({
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
      })),
    }
  }

  // ========== 初始化 ==========
  initRatiosFromDefault()

  return {
    materials,
    slots,
    layoutRatios,
    layoutControlsByType,
    imageSizes,
    currentCells,
    puzzleType,
    aspectRatio,
    gutterPx,

    // Slot helpers
    getSlotIds,
    createEmptySlots,
    switchPuzzleType,
    getLayoutControls,
    updateLayoutControl,
    resetLayoutControls,

    // 素材
    addMaterial,
    removeMaterial,
    getMaterialById,

    // 槽位
    setCanvasSlotByIndex,
    setCanvasSlot,
    clearCanvasSlot,
    resetCanvas,
    isCanvasComplete,

    // 商品信息
    getSlotMaterialId,
    getSlotProductInfo,
    getAllSlotsProductInfo,

    // 画布
    getCanvasSize,
    getCanvasSizeSquare,
    getAdjustedSizesForSquare,
    adjustRightSizesForSquare,
    resetImageSizes,
    setImageSize,
    getCanvasPixels,

    // p3 比例
    initRatiosFromDefault,
    updateSplitXFromLeftWidth,
    updateSplitYFromTopRightHeight,
    updateCanvasSize,

    // V2
    buildStitchRequestPayload,
  }
})
