<template>
  <div class="image-stitch-container">
    <!-- 三栏布局：素材区 | 画布预览区 | 布局参数 -->
    <div class="workspace-layout">
      <!-- 左侧：素材区 -->
      <div class="materials-section">
        <h2>素材库</h2>
        
        <!-- URL 输入框 -->
        <div class="url-input-section">
          <el-input
            v-model="imageUrl"
            type="textarea"
            :rows="5"
            :autosize="{ minRows: 3, maxRows: 10 }"
            placeholder="请输入图片 URL（支持多个，用逗号、换行或分号分隔）&#10;例如：&#10;https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
            clearable
            :disabled="downloading || batchDownloading"
          />
          <div class="button-group" style="margin-top: 10px;">
            <el-button 
              type="primary" 
              @click="handleBatchAdd"
              :loading="batchDownloading"
              :disabled="downloading || batchDownloading"
            >
              {{ batchDownloading ? '批量下载中...' : '批量添加' }}
            </el-button>
          </div>
          
          <!-- 提示信息 -->
          <p class="input-hint" v-if="!downloading && !batchDownloading">
            支持一次添加多个图片URL，用逗号、换行或分号分隔
          </p>
          
          <!-- 批量下载进度 -->
          <p class="input-hint downloading-hint" v-if="batchDownloading">
            <el-icon class="is-loading" style="margin-right: 5px;"><Loading /></el-icon>
            正在批量下载：{{ batchProgress.current }} / {{ batchProgress.total }}
            <span v-if="batchProgress.failed > 0" style="color: #f56c6c; margin-left: 10px;">
              （失败：{{ batchProgress.failed }}）
            </span>
          </p>
          
          <!-- 单个下载进度 -->
          <p class="input-hint downloading-hint" v-else-if="downloading">
            <el-icon class="is-loading" style="margin-right: 5px;"><Loading /></el-icon>
            正在下载图片，请稍候...
          </p>
        </div>

        <!-- 素材列表 -->
        <div class="materials-grid" v-if="materials.length > 0">
          <div
            v-for="material in materials"
            :key="material.id"
            class="material-card"
            :class="{ 'dragging': draggingMaterialId === material.id }"
            draggable="true"
            @dragstart="handleDragStart($event, material)"
            @dragend="handleDragEnd"
          >
            <div class="material-image">
              <img :src="material.previewUrl" :alt="material.id" />
            </div>
            <div class="material-actions">
              <el-button
                size="small"
                type="danger"
                @click="handleRemoveMaterial(material.id)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>

        <!-- 空状态提示 -->
        <div class="empty-state" v-else>
          <p>暂无素材，请输入图片 URL 添加</p>
        </div>
      </div>

      <!-- 中间：画布预览区 -->
      <div class="canvas-section">
        <div class="canvas-header">
          <h2>画布预览区</h2>
        </div>
        
        <!-- 画布网格布局 -->
        <div class="canvas-grid-wrapper" ref="canvasWrapper">
          <div 
            class="canvas-grid"
            ref="canvasGrid"
            :style="canvasGridStyleWithScale"
          >
          <!-- 左侧大图 (默认800x1200) - 使用绝对定位 -->
          <div
            class="canvas-slot left-slot"
            :class="{ 'drag-over': hoveredSlot === 'left' }"
            :style="leftSlotStyle"
            @dragover="handleDragOver($event, 'left')"
            @dragleave="handleDragLeave($event, 'left')"
            @drop="handleDrop($event, 'left')"
          >
            <div class="slot-content">
              <div class="slot-placeholder" v-if="!store.getSlotMaterialId('left')">
                <p>拖拽图片到这里</p>
                <small>左侧大图</small>
              </div>
              <img
                v-else
                :src="getMaterialPreviewUrl(store.getSlotMaterialId('left'))"
                alt="Left"
                class="slot-image"
              />
            </div>
          </div>

          <!-- 右上小图 (默认400x600) - 使用绝对定位 -->
          <div
            class="canvas-slot top-right-slot"
            :class="{ 'drag-over': hoveredSlot === 'topRight' }"
            :style="topRightSlotStyle"
            @dragover="handleDragOver($event, 'topRight')"
            @dragleave="handleDragLeave($event, 'topRight')"
            @drop="handleDrop($event, 'topRight')"
          >
            <div class="slot-content">
              <div class="slot-placeholder" v-if="!store.getSlotMaterialId('topRight')">
                <p>拖拽图片到这里</p>
                <small>右上小图</small>
              </div>
              <img
                v-else
                :src="getMaterialPreviewUrl(store.getSlotMaterialId('topRight'))"
                alt="Top Right"
                class="slot-image"
              />
            </div>
          </div>

          <!-- 右下小图 (默认400x600) - 使用绝对定位 -->
          <div
            class="canvas-slot bottom-right-slot"
            :class="{ 'drag-over': hoveredSlot === 'bottomRight' }"
            :style="bottomRightSlotStyle"
            @dragover="handleDragOver($event, 'bottomRight')"
            @dragleave="handleDragLeave($event, 'bottomRight')"
            @drop="handleDrop($event, 'bottomRight')"
          >
            <div class="slot-content">
              <div class="slot-placeholder" v-if="!store.getSlotMaterialId('bottomRight')">
                <p>拖拽图片到这里</p>
                <small>右下小图</small>
              </div>
              <img
                v-else
                :src="getMaterialPreviewUrl(store.getSlotMaterialId('bottomRight'))"
                alt="Bottom Right"
                class="slot-image"
              />
            </div>
          </div>

          <!-- 纵向分割线（中间，调整左右宽度） -->
          <div 
            class="divider divider-vertical"
            :class="{ 'dragging': dragging.type === 'vertical' }"
            :style="verticalDividerStyle"
            @mousedown="startVerticalDrag"
            title="拖动调整左右宽度比例"
          >
            <div class="divider-handle"></div>
          </div>

          <!-- 横向分割线（右侧，调整右上右下高度） -->
          <div 
            class="divider divider-horizontal"
            :class="{ 'dragging': dragging.type === 'horizontal' }"
            :style="horizontalDividerStyle"
            @mousedown="startHorizontalDrag"
            title="拖动调整右上右下高度比例"
          >
            <div class="divider-handle"></div>
          </div>
        </div>
        </div>
        
        <!-- 提示信息 -->
        <div class="canvas-hint" v-if="!isCanvasComplete && !resultImageUrl">
          <p>请先填充所有三个槽位（左侧大图、右上小图、右下小图）</p>
        </div>
      </div>

      <!-- 右侧：布局参数面板 -->
      <div class="layout-params-panel">
        <div class="params-header">
          <h3>布局参数</h3>
          <div class="params-header-buttons">
            <el-button
              type="primary"
              size="small"
              :disabled="!isCanvasComplete || generating || uploadingExternal"
              :loading="generating || uploadingExternal"
              @click="handleGenerateAndUpload"
            >
              {{ getGenerateButtonText() }}
            </el-button>
            <el-button 
              size="small" 
              @click="handleResetSizes"
            >
              默认
            </el-button>
          </div>
        </div>
        
        <!-- 尺寸调整面板 -->
        <div class="size-control-section">
          <!-- 主图尺寸 -->
          <div class="size-control-group">
            <h4>主图尺寸</h4>
            <div class="size-control-item">
              <label>宽度 (px)</label>
              <el-input-number
                v-model="localSizes.leftWidth"
                :min="100"
                :max="1800"
                :step="10"
                size="small"
                controls-position="right"
                @change="handleLeftWidthChange"
              />
            </div>
            <div class="size-control-item">
              <label>高度 (px)</label>
              <el-input-number
                v-model="localSizes.leftHeight"
                :min="200"
                :max="2000"
                :step="10"
                size="small"
                controls-position="right"
                @change="handleLeftHeightChange"
              />
            </div>
          </div>
          
          <!-- 细节1 (右上) -->
          <div class="size-control-group">
            <h4>细节1 (右上)</h4>
            <div class="size-control-item">
              <label>宽度 (px)</label>
              <el-input-number
                v-model="localSizes.topRightWidth"
                :min="100"
                :max="1800"
                :step="10"
                size="small"
                controls-position="right"
                disabled
              />
              <small class="size-hint">自动计算（右侧宽度）</small>
            </div>
            <div class="size-control-item">
              <label>高度 (px)</label>
              <el-input-number
                v-model="localSizes.topRightHeight"
                :min="100"
                :max="1800"
                :step="10"
                size="small"
                controls-position="right"
                @change="handleTopRightHeightChange"
              />
            </div>
          </div>
          
          <!-- 细节2 (右下) -->
          <div class="size-control-group">
            <h4>细节2 (右下)</h4>
            <div class="size-control-item">
              <label>宽度 (px)</label>
              <el-input-number
                v-model="localSizes.bottomRightWidth"
                :min="100"
                :max="1800"
                :step="10"
                size="small"
                controls-position="right"
                disabled
              />
              <small class="size-hint">自动计算（右侧宽度）</small>
            </div>
            <div class="size-control-item">
              <label>高度 (px)</label>
              <el-input-number
                v-model="localSizes.bottomRightHeight"
                :min="100"
                :max="1800"
                :step="10"
                size="small"
                controls-position="right"
                disabled
              />
              <small class="size-hint">自动计算（右下高度）</small>
            </div>
          </div>
          
          <!-- 画布总尺寸 -->
          <div class="size-control-group">
            <h4>画布总尺寸</h4>
            <div class="size-control-item">
              <label>尺寸 (px)</label>
              <el-input-number
                v-model="localSizes.canvasSize"
                :min="200"
                :max="2000"
                :step="50"
                size="small"
                controls-position="right"
                @change="handleCanvasSizeChange"
              />
              <small class="size-hint">1:1 正方形（宽度 = 高度）</small>
            </div>
          </div>
        </div>
        
        <!-- 生成结果区域（右侧面板下方） -->
        <div class="result-section" v-if="resultImageUrl">
          <div class="result-header">
            <h3>生成结果</h3>
          </div>
          <div class="result-content">
            <div class="result-preview">
              <img 
                :src="resultImageUrl" 
                alt="拼接结果" 
                class="result-image"
                @load="handleResultImageLoad"
              />
            </div>
            <!-- 尺寸信息显示 -->
            <div class="result-info" v-if="resultImageSize.width > 0">
              <div class="size-info">
                <span class="size-label">图片尺寸：</span>
                <span class="size-value">
                  {{ resultImageSize.width }} × {{ resultImageSize.height }} 像素
                </span>
              </div>
              <div class="size-info">
                <span class="size-label">画布尺寸：</span>
                <span class="size-value">
                  {{ canvasSize.width }} × {{ canvasSize.height }} 像素
                </span>
              </div>
            </div>
            <div class="result-actions">
              <!-- 本地链接 -->
              <el-input
                v-model="resultImageUrl"
                readonly
                size="small"
                class="result-url-input"
                style="margin-bottom: 10px;"
              >
                <template #append>
                  <el-button 
                    size="small"
                    @click="handleCopyUrl" 
                    :disabled="!resultImageUrl"
                  >
                    复制链接
                  </el-button>
                </template>
              </el-input>
              
              <!-- 上传到外链按钮 -->
              <el-button
                type="primary"
                size="small"
                :loading="uploadingExternal"
                :disabled="!resultImageUrl || uploadingExternal"
                @click="handleUploadToExternal"
                style="width: 100%; margin-bottom: 10px;"
              >
                {{ uploadingExternal ? '上传中...' : '上传到外链' }}
              </el-button>
              
              <!-- 外链 URL 显示（上传成功后显示） -->
              <div v-if="externalImageUrl" class="external-url-section">
                <div class="external-url-label">外链地址：</div>
                <el-input
                  v-model="externalImageUrl"
                  readonly
                  size="small"
                  class="result-url-input"
                >
                  <template #append>
                    <el-button 
                      size="small"
                      @click="handleCopyExternalUrl" 
                      :disabled="!externalImageUrl"
                    >
                      复制外链
                    </el-button>
                  </template>
                </el-input>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useImageStitchStore } from '@/stores/imageStitch'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import axios from 'axios'

// 使用 Store
const store = useImageStitchStore()

// 响应式数据
const imageUrl = ref('')
const downloading = ref(false)

// 批量下载状态管理
const batchDownloading = ref(false) // 是否正在批量下载
const batchProgress = ref({
  current: 0,  // 当前已处理的数量
  total: 0,    // 总共需要处理的数量
  success: 0,  // 成功的数量
  failed: 0    // 失败的数量
})

// 拖拽状态管理
const draggingMaterialId = ref(null) // 当前正在拖拽的素材 ID
const hoveredSlot = ref(null) // 当前悬停的槽位名称

// 生成状态
const generating = ref(false) // 是否正在生成
const resultImageUrl = ref('') // 生成的图片 URL
const resultImageSize = ref({ width: 0, height: 0 }) // 生成的图片尺寸

// 外链上传状态
const uploadingExternal = ref(false) // 是否正在上传到图床外链
const externalImageUrl = ref('') // 图床返回的外链 URL

// 分割线拖动状态管理（使用比例系统）
const dragging = ref({
  type: null,              // 'vertical' | 'horizontal' | null
  startX: 0,              // 拖动开始时的X坐标（屏幕坐标）
  startY: 0,              // 拖动开始时的Y坐标（屏幕坐标）
  startSplitX: 0,         // ✅ 拖动开始时的 splitX 比例值（0.0-1.0）
  startSplitY: 0,         // ✅ 拖动开始时的 splitY 比例值（0.0-1.0）
  canvasRect: null        // ✅ 拖动开始时的画布位置信息（用于计算相对位置）
})

// 计算属性 - 从 Store 获取素材列表和画布槽位
const materials = computed(() => store.materials)
const canvasSlots = computed(() => store.canvasSlots)

// 计算属性 - 从 Store 获取图片尺寸
const imageSizes = computed(() => store.imageSizes)

// 计算属性 - 计算画布总尺寸（1:1正方形）
const canvasSize = computed(() => store.layoutRatios.canvasSize)

// ========== 输入框本地变量（用于 v-model，因为 imageSizes 是计算属性，不能直接修改）==========
// 这些变量会从 imageSizes 计算属性同步，用户修改时通过 @change 事件调用 Store 的更新方法
const localSizes = reactive({
  leftWidth: 800,        // 左侧宽度
  leftHeight: 1200,      // 左侧高度
  topRightWidth: 400,    // 右上宽度
  topRightHeight: 600,   // 右上高度
  bottomRightWidth: 400, // 右下宽度
  bottomRightHeight: 600, // 右下高度
  canvasSize: 1200       // 画布总尺寸
})

// 监听 imageSizes 变化，同步到本地变量（用于显示）
watch(imageSizes, (newSizes) => {
  localSizes.leftWidth = newSizes.left.width
  localSizes.leftHeight = newSizes.left.height
  localSizes.topRightWidth = newSizes.topRight.width
  localSizes.topRightHeight = newSizes.topRight.height
  localSizes.bottomRightWidth = newSizes.bottomRight.width
  localSizes.bottomRightHeight = newSizes.bottomRight.height
}, { immediate: true })

// 监听 canvasSize 变化，同步到本地变量
watch(canvasSize, (newSize) => {
  localSizes.canvasSize = newSize
}, { immediate: true })

// 画布容器引用
const canvasWrapper = ref(null)
// 画布网格引用（用于获取实际渲染位置）
const canvasGrid = ref(null)

// 计算属性 - 画布网格动态样式（使用绝对定位 + aspect-ratio: 1/1）
const canvasGridStyleWithScale = computed(() => {
  // 使用比例系统：画布总尺寸（1:1正方形）
  const size = store.layoutRatios.canvasSize
  
  // 基础样式：使用 aspect-ratio 强制1:1，使用绝对定位
  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    aspectRatio: '1 / 1',  // ✅ 强制1:1正方形
    position: 'relative'   // ✅ 绝对定位容器
  }
  
  // 如果容器存在，计算自适应缩放比例
  if (canvasWrapper.value) {
    const containerWidth = canvasWrapper.value.clientWidth - 16 // 减去padding (8px * 2)
    const containerHeight = canvasWrapper.value.clientHeight - 16
    
    // 计算缩放比例（留5%边距，让画布更贴合容器）
    const scaleX = (containerWidth * 0.95) / size
    const scaleY = (containerHeight * 0.95) / size
    const scale = Math.min(scaleX, scaleY, 1) // 不超过100%，只缩小不放大
    
    if (scale < 1) {
      baseStyle.transform = `scale(${scale})`
      baseStyle.transformOrigin = 'center center'
    }
  }
  
  return baseStyle
})

// 计算属性 - 画布网格动态样式（使用1:1正方形尺寸，不缩放）- 已废弃，使用 canvasGridStyleWithScale
// 保留此计算属性以防其他地方引用，但实际不再使用
const canvasGridStyle = computed(() => {
  const size = store.layoutRatios.canvasSize
  return {
    width: `${size}px`,
    height: `${size}px`,
    aspectRatio: '1 / 1',
    position: 'relative'
  }
})

// 计算属性 - 检查画布是否已填满
const isCanvasComplete = computed(() => store.isCanvasComplete())

// 计算属性 - 获取当前画布的缩放比例
// 注意：使用比例系统后，拖动逻辑不再需要此方法，但保留以备将来需要
const getCurrentScale = () => {
  if (!canvasWrapper.value) return 1
  
  // ✅ 使用比例系统：画布总尺寸（1:1正方形）
  const canvasSize = store.layoutRatios.canvasSize
  
  const containerWidth = canvasWrapper.value.clientWidth - 24
  const containerHeight = canvasWrapper.value.clientHeight - 24
  
  // 计算缩放比例（留10%边距）
  const scaleX = (containerWidth * 0.9) / canvasSize
  const scaleY = (containerHeight * 0.9) / canvasSize
  const scale = Math.min(scaleX, scaleY, 1) // 不超过100%
  
  return scale < 1 ? scale : 1
}

// 计算属性 - 纵向分割线位置样式
// 纵向分割线位于左侧和右侧的分界处，垂直居中
const verticalDividerStyle = computed(() => {
  const { left } = imageSizes.value
  
  return {
    left: `${left.width}px`,  // 位于左侧和右侧的分界处
    top: '0',
    height: '100%',
    transform: 'translateX(-50%)' // 居中显示，让分割线在分界线的中间
  }
})

// 计算属性 - 横向分割线位置样式
// 横向分割线位于右上和右下的分界处，水平居中
const horizontalDividerStyle = computed(() => {
  const { left, topRight } = imageSizes.value
  
  return {
    left: `${left.width}px`,        // 从左侧宽度开始（右侧区域的起始位置）
    top: `${topRight.height}px`,     // 位于右上和右下的分界处
    width: `${topRight.width}px`,     // 宽度等于右侧宽度
    transform: 'translateY(-50%)'  // 居中显示，让分割线在分界线的中间
  }
})

// ========== 绝对定位槽位样式计算属性 ==========
// 左侧槽位：绝对定位在左侧，占据整个高度
const leftSlotStyle = computed(() => {
  const { left } = imageSizes.value
  return {
    position: 'absolute',
    left: '0',
    top: '0',
    width: `${left.width}px`,
    height: `${left.height}px`
  }
})

// 右上槽位：绝对定位在右侧上方
const topRightSlotStyle = computed(() => {
  const { left, topRight } = imageSizes.value
  return {
    position: 'absolute',
    left: `${left.width}px`,
    top: '0',
    width: `${topRight.width}px`,
    height: `${topRight.height}px`
  }
})

// 右下槽位：绝对定位在右侧下方
const bottomRightSlotStyle = computed(() => {
  const { left, topRight, bottomRight } = imageSizes.value
  return {
    position: 'absolute',
    left: `${left.width}px`,
    top: `${topRight.height}px`,
    width: `${bottomRight.width}px`,
    height: `${bottomRight.height}px`
  }
})

// 方法：根据素材 ID 获取预览 URL
const getMaterialPreviewUrl = (materialId) => {
  const material = store.getMaterialById(materialId)
  return material ? material.previewUrl : ''
}

/**
 * 解析批量URL输入
 * @param {string} input - 用户输入的文本
 * @returns {string[]} - 解析出的有效URL数组
 */
const parseUrls = (input) => {
  if (!input || typeof input !== 'string') {
    return []
  }
  
  // 1. 按多种分隔符分割（逗号、分号、换行符）
  const urls = input
    .split(/[,;\n\r]+/)  // 正则表达式：匹配逗号、分号、换行符（支持\n、\r、\r\n）
    .map(url => url.trim())  // 去除每个URL的首尾空格
    .filter(url => url.length > 0)  // 过滤空字符串
    .filter(url => url.startsWith('http://') || url.startsWith('https://'))  // 只保留有效的HTTP/HTTPS链接
  
  // 2. 去重（使用Set数据结构）
  const uniqueUrls = [...new Set(urls)]
  
  console.log(`📋 [parseUrls] 解析出 ${uniqueUrls.length} 个有效URL（去重前：${urls.length}）`)
  
  return uniqueUrls
}

/**
 * URL格式验证
 * @param {string} url - 需要验证的URL
 * @returns {boolean} - 是否为有效URL
 */
const isValidUrl = (url) => {
  try {
    // 使用URL构造函数验证（浏览器原生API）
    new URL(url)
    
    // 检查长度限制（防止过长的URL）
    if (url.length > 2048) {
      return false
    }
    
    return true
  } catch (e) {
    return false
  }
}

/**
 * 下载单个图片（内部函数，支持重试）
 * @param {string} url - 图片URL
 * @param {number} retryCount - 当前重试次数（默认0）
 * @returns {Promise<Object>} - 返回素材对象或null（失败）
 */
const downloadSingleImage = async (url, retryCount = 0) => {
  try {
    console.log(`📥 [downloadSingleImage] 开始下载图片 (尝试${retryCount + 1}/2):`, url)
    
    // 调用后端下载接口
    const response = await axios.post('/api/fetch-image', {
      url: url
    }, {
      timeout: 60000 // 60秒超时
    })
    
    // 检查响应
    if (response.data && response.data.success) {
      const { localPath, publicUrl, filename } = response.data
      
      // 生成唯一 ID
      const materialId = `material-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      
      // 创建素材对象
      const material = {
        id: materialId,
        originalUrl: url,
        localPath: localPath,
        publicUrl: publicUrl,
        previewUrl: localPath
      }
      
      console.log(`✅ [downloadSingleImage] 下载成功:`, filename)
      return { success: true, material, filename }
    } else {
      throw new Error(response.data?.error || '下载失败')
    }
  } catch (error) {
    console.error(`❌ [downloadSingleImage] 下载失败 (尝试${retryCount + 1}/2):`, error.message)
    
    // 如果是第一次失败，且不是URL无效错误，则重试一次
    if (retryCount === 0 && !error.message.includes('URL')) {
      console.log(`🔄 [downloadSingleImage] 准备重试...`)
      await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒后重试
      return await downloadSingleImage(url, retryCount + 1)
    }
    
    // 重试后仍失败，返回失败信息
    return {
      success: false,
      url: url,
      error: error.message || '未知错误'
    }
  }
}

/**
 * 并发控制函数：限制并发数量
 * @param {Array} tasks - 任务数组（每个任务是一个返回Promise的函数）
 * @param {number} limit - 并发限制数量（默认3）
 * @returns {Promise<Array>} - 返回所有任务的结果
 */
const promiseLimit = async (tasks, limit = 3) => {
  const results = []  // 存储所有结果
  const executing = []  // 存储正在执行的Promise
  
  for (const [index, task] of tasks.entries()) {
    // 创建Promise并立即执行
    const promise = Promise.resolve().then(() => task())
    results[index] = promise
    
    // 如果达到并发限制，等待最快完成的一个
    if (limit <= tasks.length) {
      // 将promise添加到executing数组，并在完成后移除
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      
      // 如果达到并发限制，等待一个完成
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
  }
  
  // 等待所有任务完成
  return Promise.all(results)
}

/**
 * 批量添加图片（主函数）
 */
const handleBatchAdd = async () => {
  const input = imageUrl.value.trim()
  
  // 1. 输入验证
  if (!input) {
    ElMessage.warning('请输入图片 URL')
    return
  }
  
  // 2. 解析URL
  const urls = parseUrls(input)
  
  if (urls.length === 0) {
    ElMessage.warning('未识别到有效的图片 URL，请检查输入格式')
    return
  }
  
  console.log(`📋 [handleBatchAdd] 解析出 ${urls.length} 个URL`)
  
  // 3. URL格式验证
  const validUrls = []
  const invalidUrls = []
  
  for (const url of urls) {
    if (isValidUrl(url)) {
      validUrls.push(url)
    } else {
      invalidUrls.push(url)
      console.warn(`⚠️ [handleBatchAdd] 无效URL:`, url)
    }
  }
  
  if (invalidUrls.length > 0) {
    ElMessage.warning(`发现 ${invalidUrls.length} 个无效URL，已自动过滤`)
  }
  
  if (validUrls.length === 0) {
    ElMessage.error('没有有效的URL可以下载')
    return
  }
  
  // 4. 过滤已添加的URL
  const newUrls = validUrls.filter(url => {
    const exists = store.materials.find(m => m.originalUrl === url)
    if (exists) {
      console.log(`ℹ️ [handleBatchAdd] URL已存在，跳过:`, url)
    }
    return !exists
  })
  
  if (newUrls.length === 0) {
    ElMessage.warning('所有URL都已添加，没有新的图片需要下载')
    return
  }
  
  if (newUrls.length < validUrls.length) {
    ElMessage.info(`已过滤 ${validUrls.length - newUrls.length} 个重复的URL`)
  }
  
  // 5. 开始批量下载
  console.log(`🚀 [handleBatchAdd] 开始批量下载 ${newUrls.length} 个图片`)
  
  batchDownloading.value = true
  batchProgress.value = {
    current: 0,
    total: newUrls.length,
    success: 0,
    failed: 0
  }
  
  try {
    // 6. 创建下载任务数组
    const tasks = newUrls.map((url, index) => {
      return async () => {
        console.log(`📥 [Task ${index + 1}/${newUrls.length}] 开始下载:`, url)
        
        // 下载图片（内部已包含重试机制）
        const result = await downloadSingleImage(url)
        
        // 更新进度
        batchProgress.value.current++
        
        if (result.success) {
          batchProgress.value.success++
          // 添加到Store
          store.addMaterial(result.material)
          console.log(`✅ [Task ${index + 1}/${newUrls.length}] 成功:`, result.filename)
        } else {
          batchProgress.value.failed++
          console.error(`❌ [Task ${index + 1}/${newUrls.length}] 失败:`, result.error)
        }
        
        return result
      }
    })
    
    // 7. 使用并发控制执行任务（限制3个并发）
    const results = await promiseLimit(tasks, 3)
    
    // 8. 统计结果
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length
    
    console.log(`✅ [handleBatchAdd] 批量下载完成: 成功${successCount}个，失败${failedCount}个`)
    
    // 9. 显示最终结果
    if (failedCount === 0) {
      ElMessage.success(`批量添加成功！共添加 ${successCount} 个素材`)
    } else if (successCount > 0) {
      ElMessage.warning(`批量添加完成：成功 ${successCount} 个，失败 ${failedCount} 个`)
      
      // 显示失败的URL
      const failedUrls = results.filter(r => !r.success).map(r => r.url)
      console.error('❌ 失败的URL列表:', failedUrls)
    } else {
      ElMessage.error(`批量添加失败：所有 ${failedCount} 个URL都下载失败`)
    }
    
    // 10. 清空输入框
    if (successCount > 0) {
      imageUrl.value = ''
    }
    
  } catch (error) {
    console.error('❌ [handleBatchAdd] 批量下载异常:', error)
    ElMessage.error(`批量下载出错：${error.message}`)
  } finally {
    // 重置状态
    batchDownloading.value = false
  }
}

// 方法：添加图片（调用后端下载接口）
const handleAddImage = async () => {
  const url = imageUrl.value.trim()
  
  // 输入验证
  if (!url) {
    ElMessage.warning('请输入图片 URL')
    return
  }

  // URL 格式验证
  // 1. 检查协议
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    ElMessage.error('URL 格式不正确：必须以 http:// 或 https:// 开头')
    return
  }
  
  // 2. 使用 URL 构造函数验证 URL 格式（更严格的验证）
  try {
    new URL(url)
  } catch (e) {
    ElMessage.error('URL 格式不正确：请输入有效的 URL 地址')
    return
  }
  
  // 3. 检查 URL 长度（防止过长的 URL）
  if (url.length > 2048) {
    ElMessage.error('URL 过长：URL 长度不能超过 2048 个字符')
    return
  }

  // 防止重复提交
  if (downloading.value) {
    ElMessage.warning('正在下载中，请稍候...')
    return
  }
  
  // 检查是否已存在相同的图片 URL（避免重复添加）
  const existingMaterial = store.materials.find(m => m.originalUrl === url)
  if (existingMaterial) {
    ElMessage.warning('该图片已添加，请勿重复添加')
    return
  }

  downloading.value = true
  
  try {
    console.log('📥 [ImageStitch] 开始下载图片:', url)
    
    // 调用后端下载接口（设置超时时间）
    const response = await axios.post('/api/fetch-image', {
      url: url
    }, {
      timeout: 60000 // 60秒超时
    })
    
    // 检查响应
    if (response.data && response.data.success) {
      const { localPath, publicUrl, filename } = response.data
      
      // 生成唯一 ID（使用文件名作为 ID 的一部分）
      const materialId = `material-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      
      // 创建素材对象
      // 注意：使用相对路径而不是完整 URL，避免跨域问题
      // 因为前端通过 Vite 代理访问后端，使用相对路径会通过代理转发
      const material = {
        id: materialId,
        originalUrl: url,
        localPath: localPath,
        publicUrl: publicUrl,
        previewUrl: localPath // 使用相对路径，通过 Vite 代理访问
      }
      
      // 添加到 Store
      store.addMaterial(material)
      
      // 清空输入框
      imageUrl.value = ''
      
      // 显示成功消息
      ElMessage.success(`素材添加成功：${filename}`)
      
      console.log('✅ [ImageStitch] 素材添加成功:', materialId)
    } else {
      throw new Error(response.data?.error || '下载失败')
    }
  } catch (error) {
    console.error('❌ [ImageStitch] 添加素材失败:', error)
    
    // 详细的错误处理
    let errorMessage = '添加素材失败'
    let errorDescription = ''
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 请求超时
      errorMessage = '下载超时'
      errorDescription = '图片下载时间过长，请检查网络连接或尝试使用其他图片 URL'
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      // 网络连接错误
      errorMessage = '网络连接失败'
      errorDescription = '无法连接到服务器，请检查网络连接或稍后重试'
    } else if (error.response) {
      // HTTP 错误响应
      const status = error.response.status
      const data = error.response.data
      
      if (status === 400) {
        errorMessage = '请求参数错误'
        errorDescription = data?.error || '请检查 URL 格式是否正确'
      } else if (status === 404) {
        errorMessage = '图片不存在'
        errorDescription = '无法找到该图片，请检查 URL 是否正确'
      } else if (status === 500) {
        errorMessage = '服务器错误'
        errorDescription = data?.error || '服务器处理请求时出错，请稍后重试'
      } else {
        errorMessage = `HTTP 错误 ${status}`
        errorDescription = data?.error || '请求失败，请稍后重试'
      }
    } else if (error.message) {
      // 其他错误
      errorMessage = '下载失败'
      errorDescription = error.message
    }
    
    // 显示错误消息（合并详细描述）
    // 注意：ElMessage 不支持多行显示，所以使用冒号分隔
    const fullErrorMessage = errorDescription 
      ? `${errorMessage}：${errorDescription}` 
      : errorMessage
    ElMessage.error(fullErrorMessage)
  } finally {
    downloading.value = false
  }
}

// 方法：删除素材
const handleRemoveMaterial = (materialId) => {
  store.removeMaterial(materialId)
  ElMessage.success('素材已删除')
}

// 方法：拖拽开始
const handleDragStart = (event, material) => {
  // 将素材 ID 存储到 dataTransfer 中
  event.dataTransfer.setData('materialId', material.id)
  // 设置拖拽效果为移动
  event.dataTransfer.effectAllowed = 'move'
  // 设置当前拖拽的素材 ID（用于视觉反馈）
  draggingMaterialId.value = material.id
  console.log('🎯 [拖拽] 开始拖拽素材:', material.id)
}

// 方法：拖拽结束
const handleDragEnd = () => {
  // 清除拖拽状态
  draggingMaterialId.value = null
  hoveredSlot.value = null
  console.log('🏁 [拖拽] 拖拽结束')
}

// 方法：拖拽悬停在槽位上
const handleDragOver = (event, slot) => {
  // 必须调用 preventDefault 才能允许放置
  event.preventDefault()
  // 设置悬停的槽位（用于高亮显示）
  hoveredSlot.value = slot
  // 设置拖拽效果为移动
  event.dataTransfer.dropEffect = 'move'
}

// 方法：拖拽离开槽位
const handleDragLeave = (event, slot) => {
  // 只有当鼠标真正离开槽位时才清除高亮
  // 注意：dragleave 事件可能会在子元素上触发，需要检查相关目标
  const rect = event.currentTarget.getBoundingClientRect()
  const x = event.clientX
  const y = event.clientY
  
  // 如果鼠标确实在槽位外部，才清除高亮
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    hoveredSlot.value = null
  }
}

// 方法：放置素材到槽位
const handleDrop = (event, slot) => {
  // 阻止默认行为（阻止浏览器打开图片）
  event.preventDefault()
  
  // 清除悬停状态
  hoveredSlot.value = null
  
  // 获取拖拽的素材 ID
  const materialId = event.dataTransfer.getData('materialId')
  
  if (!materialId) {
    console.warn('⚠️ [拖拽] 未找到素材 ID')
    return
  }
  
  // 验证素材是否存在
  const material = store.getMaterialById(materialId)
  if (!material) {
    ElMessage.warning('素材不存在')
    return
  }
  
  // 获取素材的商品信息（如果有）
  // 商品信息可能来自：
  // 1. 自动扫描（阶段二已实现）
  // 2. 手动标记（未来可能实现）
  const productInfo = material.productInfo || null
  
  // 设置槽位，同时记录商品信息
  store.setCanvasSlot(slot, materialId, productInfo)
  
  if (productInfo) {
    console.log(`✅ [拖拽] 素材已放置到槽位 ${slot}:`, {
      materialId,
      productId: productInfo.productId,
      productSpu: productInfo.productSpu
    })
  } else {
    console.log(`✅ [拖拽] 素材已放置到槽位 ${slot}:`, materialId)
    console.log(`ℹ️ [拖拽] 该素材暂无商品信息，建议先导入Excel或手动标记`)
  }
  
  ElMessage.success(`图片已添加到${getSlotName(slot)}`)
}

// 辅助方法：获取槽位中文名称
const getSlotName = (slot) => {
  const slotNames = {
    left: '左侧大图',
    topRight: '右上小图',
    bottomRight: '右下小图'
  }
  return slotNames[slot] || slot
}

/**
 * 方法：左侧宽度改变时的处理 - 使用比例系统
 * 当用户修改"左侧主图宽度"输入框时触发
 * 使用 Store 的 updateSplitXFromLeftWidth 方法更新比例
 */
const handleLeftWidthChange = (newWidth) => {
  if (!newWidth || newWidth < 100) return
  
  // 使用 Store 的更新方法，从左侧宽度反向计算 splitX
  store.updateSplitXFromLeftWidth(newWidth)
  
  console.log('📐 [输入框] 左侧宽度已更新:', newWidth, 'px')
  console.log('  - 新的 splitX:', store.layoutRatios.splitX.toFixed(4))
  console.log('  - 右侧宽度（自动计算）:', imageSizes.value.topRight.width, 'px')
}

/**
 * 方法：左侧高度改变时的处理
 * 注意：左侧高度应该等于画布总尺寸（1:1），所以修改左侧高度实际上应该修改画布总尺寸
 */
const handleLeftHeightChange = (newHeight) => {
  if (!newHeight || newHeight < 200) return
  
  // 左侧高度应该等于画布总尺寸，所以修改画布总尺寸
  store.updateCanvasSize(newHeight)
  
  console.log('📐 [输入框] 左侧高度已更新（实际更新画布总尺寸）:', newHeight, 'px')
}

/**
 * 方法：右上高度改变时的处理 - 使用比例系统
 * 当用户修改"右上细节图高度"输入框时触发
 * 使用 Store 的 updateSplitYFromTopRightHeight 方法更新比例
 */
const handleTopRightHeightChange = (newHeight) => {
  if (!newHeight || newHeight < 100) return
  
  // 使用 Store 的更新方法，从右上高度反向计算 splitY
  store.updateSplitYFromTopRightHeight(newHeight)
  
  console.log('📐 [输入框] 右上高度已更新:', newHeight, 'px')
  console.log('  - 新的 splitY:', store.layoutRatios.splitY.toFixed(4))
  console.log('  - 右下高度（自动计算）:', imageSizes.value.bottomRight.height, 'px')
}

/**
 * 方法：画布总尺寸改变时的处理 - 使用比例系统
 * 当用户修改"画布总尺寸"输入框时触发
 * 使用 Store 的 updateCanvasSize 方法更新画布尺寸（等比例缩放）
 */
const handleCanvasSizeChange = (newSize) => {
  if (!newSize || newSize < 200) return
  
  // 使用 Store 的更新方法，更新画布总尺寸（等比例缩放）
  store.updateCanvasSize(newSize)
  
  console.log('📐 [输入框] 画布总尺寸已更新:', newSize, 'px')
  console.log('  - splitX 保持不变:', store.layoutRatios.splitX.toFixed(4))
  console.log('  - splitY 保持不变:', store.layoutRatios.splitY.toFixed(4))
  console.log('  - 所有区域已等比例缩放')
}

/**
 * 方法：重置所有尺寸为默认值
 */
const handleResetSizes = () => {
  store.resetImageSizes()
  ElMessage.success('已重置为默认尺寸')
  console.log('🔄 [尺寸调整] 已重置为默认尺寸')
}

/**
 * 方法：开始纵向拖动（调整左右宽度）- 使用比例系统
 * 当用户按下纵向分割线时触发
 */
const startVerticalDrag = (e) => {
  // 获取画布网格的实际位置（考虑缩放）
  if (!canvasGrid.value) {
    console.warn('⚠️ [分割线] 画布网格引用不存在')
    return
  }
  
  const canvasRect = canvasGrid.value.getBoundingClientRect()
  
  // 记录拖动开始时的状态（使用比例系统）
  dragging.value = {
    type: 'vertical',
    startX: e.clientX,  // 屏幕坐标X
    startY: e.clientY,  // 屏幕坐标Y
    startSplitX: store.layoutRatios.splitX,  // ✅ 记录当前的比例值
    canvasRect: canvasRect  // ✅ 记录画布位置信息
  }
  
  // 添加全局事件监听（使用 window，确保鼠标移出也能继续拖动）
  window.addEventListener('mousemove', handleVerticalDrag)
  window.addEventListener('mouseup', stopVerticalDrag)
  
  // 防止选中文本和默认行为
  e.preventDefault()
  e.stopPropagation()
  
  console.log('🎯 [分割线] 开始纵向拖动，当前 splitX:', dragging.value.startSplitX.toFixed(4))
}

/**
 * 方法：处理纵向拖动（实时更新左右宽度）- 使用比例系统
 * 当用户拖动纵向分割线时持续触发
 * 
 * 核心思路：
 * 1. 计算鼠标在画布中的相对位置（0.0-1.0）
 * 2. 这个相对位置就是新的 splitX 比例值
 * 3. 使用 Store 的更新方法，自动处理边界限制
 * 4. 添加吸附功能，当接近 0.5 时自动吸附
 */
const handleVerticalDrag = (e) => {
  if (dragging.value.type !== 'vertical') return
  
  // 获取画布位置信息（使用拖动开始时保存的位置，避免频繁获取）
  const canvasRect = dragging.value.canvasRect
  if (!canvasRect) {
    console.warn('⚠️ [分割线] 画布位置信息不存在')
    return
  }
  
  // 计算鼠标在画布中的相对位置（0.0-1.0）
  // 这是核心：相对位置 = (鼠标X - 画布左边界) / 画布宽度
  const relativeX = (e.clientX - canvasRect.left) / canvasRect.width
  
  // 限制范围：0.1 - 0.9（确保左右两侧都至少有10%的空间）
  // 注意：Store 的更新方法会进一步限制为最小100px，这里只是初步限制
  let newSplitX = Math.max(0.1, Math.min(0.9, relativeX))
  
  // ✅ 添加吸附功能：当接近 0.5（50%）时自动吸附
  // 阈值：2%（0.02）
  const SNAP_THRESHOLD = 0.02
  if (Math.abs(newSplitX - 0.5) < SNAP_THRESHOLD) {
    newSplitX = 0.5
    console.log('🧲 [分割线] 吸附到 0.5（50%）')
  }
  
  // 使用 Store 的更新方法，从左侧宽度反向计算 splitX
  // 注意：updateSplitXFromLeftWidth 接收的是像素值，所以需要先计算像素值
  const canvasSize = store.layoutRatios.canvasSize
  const newLeftWidth = newSplitX * canvasSize
  
  // 调用 Store 的更新方法（会自动处理边界限制和极端情况预防）
  store.updateSplitXFromLeftWidth(newLeftWidth)
  
  // 实时日志（节流，避免输出过多）
  // 只在 splitX 变化超过 0.01 时输出
  const currentSplitX = store.layoutRatios.splitX
  if (Math.abs(currentSplitX - dragging.value.startSplitX) > 0.01 || Math.abs(newSplitX - 0.5) < SNAP_THRESHOLD) {
    const sizes = imageSizes.value
    console.log(`📐 [分割线] 纵向拖动: splitX=${currentSplitX.toFixed(4)}, 左侧=${sizes.left.width}px, 右侧=${sizes.topRight.width}px`)
  }
}

/**
 * 方法：开始横向拖动（调整右上右下高度）- 使用比例系统
 * 当用户按下横向分割线时触发
 */
const startHorizontalDrag = (e) => {
  // 获取画布网格的实际位置（考虑缩放）
  if (!canvasGrid.value) {
    console.warn('⚠️ [分割线] 画布网格引用不存在')
    return
  }
  
  const canvasRect = canvasGrid.value.getBoundingClientRect()
  
  // 记录拖动开始时的状态（使用比例系统）
  dragging.value = {
    type: 'horizontal',
    startX: e.clientX,  // 屏幕坐标X
    startY: e.clientY,  // 屏幕坐标Y
    startSplitY: store.layoutRatios.splitY,  // ✅ 记录当前的比例值
    canvasRect: canvasRect  // ✅ 记录画布位置信息
  }
  
  // 添加全局事件监听（使用 window，确保鼠标移出也能继续拖动）
  window.addEventListener('mousemove', handleHorizontalDrag)
  window.addEventListener('mouseup', stopHorizontalDrag)
  
  // 防止选中文本和默认行为
  e.preventDefault()
  e.stopPropagation()
  
  console.log('🎯 [分割线] 开始横向拖动，当前 splitY:', dragging.value.startSplitY.toFixed(4))
}

/**
 * 方法：处理横向拖动（实时更新右上右下高度）- 使用比例系统
 * 当用户拖动横向分割线时持续触发
 * 
 * 核心思路：
 * 1. 计算鼠标在画布中的相对位置（0.0-1.0）
 * 2. 这个相对位置就是新的 splitY 比例值
 * 3. 使用 Store 的更新方法，自动处理边界限制
 * 4. 添加吸附功能，当接近 0.5 时自动吸附
 */
const handleHorizontalDrag = (e) => {
  if (dragging.value.type !== 'horizontal') return
  
  // 获取画布位置信息（使用拖动开始时保存的位置，避免频繁获取）
  const canvasRect = dragging.value.canvasRect
  if (!canvasRect) {
    console.warn('⚠️ [分割线] 画布位置信息不存在')
    return
  }
  
  // 计算鼠标在画布中的相对位置（0.0-1.0）
  // 这是核心：相对位置 = (鼠标Y - 画布上边界) / 画布高度
  const relativeY = (e.clientY - canvasRect.top) / canvasRect.height
  
  // 限制范围：0.1 - 0.9（确保右上和右下都至少有10%的空间）
  // 注意：Store 的更新方法会进一步限制为最小100px，这里只是初步限制
  let newSplitY = Math.max(0.1, Math.min(0.9, relativeY))
  
  // ✅ 添加吸附功能：当接近 0.5（50%）时自动吸附
  // 阈值：2%（0.02）
  const SNAP_THRESHOLD = 0.02
  if (Math.abs(newSplitY - 0.5) < SNAP_THRESHOLD) {
    newSplitY = 0.5
    console.log('🧲 [分割线] 吸附到 0.5（50%）')
  }
  
  // 使用 Store 的更新方法，从右上高度反向计算 splitY
  // 注意：updateSplitYFromTopRightHeight 接收的是像素值，所以需要先计算像素值
  const canvasSize = store.layoutRatios.canvasSize
  const newTopRightHeight = newSplitY * canvasSize
  
  // 调用 Store 的更新方法（会自动处理边界限制和极端情况预防）
  store.updateSplitYFromTopRightHeight(newTopRightHeight)
  
  // 实时日志（节流，避免输出过多）
  // 只在 splitY 变化超过 0.01 时输出
  const currentSplitY = store.layoutRatios.splitY
  if (Math.abs(currentSplitY - dragging.value.startSplitY) > 0.01 || Math.abs(newSplitY - 0.5) < SNAP_THRESHOLD) {
    const sizes = imageSizes.value
    console.log(`📐 [分割线] 横向拖动: splitY=${currentSplitY.toFixed(4)}, 右上=${sizes.topRight.height}px, 右下=${sizes.bottomRight.height}px`)
  }
}

/**
 * 方法：停止拖动（纵向和横向共用）- 使用比例系统
 * 当用户释放鼠标时触发
 * 
 * 注意：使用比例系统后，不需要调用 adjustRightSizesForSquare
 * 因为比例系统本身就保证了1:1，像素值由计算属性自动计算
 */
const stopVerticalDrag = () => {
  if (dragging.value.type === 'vertical') {
    console.log('✅ [分割线] 纵向拖动结束')
    
    // 使用比例系统后，不需要调用自动调整
    // 因为比例系统本身就保证了1:1，像素值由计算属性自动计算
    
    dragging.value.type = null
    dragging.value.canvasRect = null  // 清理画布位置信息
    
    // 移除全局事件监听（使用 window）
    window.removeEventListener('mousemove', handleVerticalDrag)
    window.removeEventListener('mouseup', stopVerticalDrag)
  }
}

const stopHorizontalDrag = () => {
  if (dragging.value.type === 'horizontal') {
    console.log('✅ [分割线] 横向拖动结束')
    
    // 使用比例系统后，不需要调用自动调整
    
    dragging.value.type = null
    dragging.value.canvasRect = null  // 清理画布位置信息
    
    // 移除全局事件监听（使用 window）
    window.removeEventListener('mousemove', handleHorizontalDrag)
    window.removeEventListener('mouseup', stopHorizontalDrag)
  }
}

// 方法：生成拼接图片
const handleGenerate = async () => {
  // 检查画布是否已填满
  if (!store.isCanvasComplete()) {
    ElMessage.warning('请先填充所有三个槽位（左侧大图、右上小图、右下小图）')
    return
  }
  
  // 获取三个槽位的素材（使用新的方法获取 materialId）
  const leftMaterialId = store.getSlotMaterialId('left')
  const topRightMaterialId = store.getSlotMaterialId('topRight')
  const bottomRightMaterialId = store.getSlotMaterialId('bottomRight')
  
  const leftMaterial = store.getMaterialById(leftMaterialId)
  const topRightMaterial = store.getMaterialById(topRightMaterialId)
  const bottomRightMaterial = store.getMaterialById(bottomRightMaterialId)
  
  if (!leftMaterial || !topRightMaterial || !bottomRightMaterial) {
    ElMessage.error('素材数据不完整，请重新拖拽图片到对应的槽位')
    return
  }
  
  // 详细的数据完整性检查
  // 检查每个素材是否包含必要的字段
  const requiredFields = ['localPath', 'previewUrl']
  const missingFields = []
  
  if (!leftMaterial.localPath || !leftMaterial.previewUrl) {
    missingFields.push('左侧大图')
  }
  if (!topRightMaterial.localPath || !topRightMaterial.previewUrl) {
    missingFields.push('右上小图')
  }
  if (!bottomRightMaterial.localPath || !bottomRightMaterial.previewUrl) {
    missingFields.push('右下小图')
  }
  
  if (missingFields.length > 0) {
    ElMessage.error(`以下槽位的素材数据不完整：${missingFields.join('、')}，请重新添加素材`)
    return
  }

  // 防止重复提交
  if (generating.value) {
    ElMessage.warning('正在生成中，请稍候...')
    return
  }
  
  generating.value = true
  resultImageUrl.value = '' // 清空之前的结果
  
  try {
    console.log('🎨 [生成] 开始生成拼接图片...')
    console.log('🎨 [生成] 左侧图片:', leftMaterial.localPath)
    console.log('🎨 [生成] 右上图片:', topRightMaterial.localPath)
    console.log('🎨 [生成] 右下图片:', bottomRightMaterial.localPath)
    
    // 确保尺寸是1:1正方形（在生成前自动调整）
    // 使用 getAdjustedSizesForSquare() 获取调整后的尺寸，确保1:1
    const adjustedSizes = store.getAdjustedSizesForSquare()
    
    // 使用调整后的尺寸
    const currentSizes = adjustedSizes
    console.log('📐 [生成] 当前尺寸配置（已调整为1:1正方形）:')
    console.log('  - 左侧:', `${currentSizes.left.width} × ${currentSizes.left.height} 像素`)
    console.log('  - 右上:', `${currentSizes.topRight.width} × ${currentSizes.topRight.height} 像素`)
    console.log('  - 右下:', `${currentSizes.bottomRight.width} × ${currentSizes.bottomRight.height} 像素`)
    
    // 构建请求体（使用调整后的尺寸，确保1:1正方形）
    const requestBody = {
      // 图片路径参数
      left: leftMaterial.localPath,
      topRight: topRightMaterial.localPath,
      bottomRight: bottomRightMaterial.localPath,
      // 尺寸参数：传递调整后的尺寸配置（确保1:1正方形）
      leftSize: {
        width: currentSizes.left.width,
        height: currentSizes.left.height
      },
      topRightSize: {
        width: currentSizes.topRight.width,
        height: currentSizes.topRight.height
      },
      bottomRightSize: {
        width: currentSizes.bottomRight.width,
        height: currentSizes.bottomRight.height
      }
    }
    
    // 调试：输出完整的请求体
    console.log('📤 [生成] 发送的请求体:', JSON.stringify(requestBody, null, 2))
    
    // 调用 Python 拼接接口
    // 注意：通过 API 网关代理到 Python 服务
    // 设置较长的超时时间，因为图片处理可能需要较长时间
    // 传递尺寸参数，让后端根据用户设置的尺寸进行动态拼接
    const response = await axios.post('/api/video-generation/api/process/stitch', requestBody, {
      timeout: 120000 // 120秒超时（图片处理可能需要较长时间）
    })
    
    if (response.data && response.data.success) {
      const { imageUrl, localPath, filename } = response.data
      
      // 使用相对路径（通过 Vite 代理访问）
      resultImageUrl.value = localPath
      
      // 获取1:1正方形画布尺寸（用于验证）
      const expectedCanvasSize = store.getCanvasSizeSquare()
      
      // 重置尺寸信息（图片加载后会更新）
      resultImageSize.value = { width: 0, height: 0 }
      
      // 输出尺寸信息到控制台（用于验证）
      console.log('✅ [生成] 拼接成功:', localPath)
      console.log('📐 [生成] 使用的尺寸配置（1:1正方形）:')
      console.log('  - 左侧:', `${currentSizes.left.width} × ${currentSizes.left.height} 像素`)
      console.log('  - 右上:', `${currentSizes.topRight.width} × ${currentSizes.topRight.height} 像素`)
      console.log('  - 右下:', `${currentSizes.bottomRight.width} × ${currentSizes.bottomRight.height} 像素`)
      console.log('📐 [生成] 预期画布尺寸（1:1正方形）:', `${expectedCanvasSize.width} × ${expectedCanvasSize.height} 像素`)
      console.log('📐 [生成] 提示：图片加载完成后会显示实际尺寸，请查看生成结果区域的尺寸信息')
      
      ElMessage.success(`图片拼接成功！已生成：${filename || '拼接图片'}`)
    } else {
      throw new Error(response.data?.error || '生成失败')
    }
  } catch (error) {
    console.error('❌ [生成] 拼接失败:', error)
    
    // 详细的错误处理
    let errorMessage = '生成失败'
    let errorDescription = ''
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      // 请求超时
      errorMessage = '生成超时'
      errorDescription = '图片处理时间过长，可能是图片太大或服务器繁忙，请稍后重试'
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      // 网络连接错误
      errorMessage = '无法连接到服务器'
      errorDescription = '请检查网络连接，确保 Python 服务正在运行'
    } else if (error.response) {
      // HTTP 错误响应
      const status = error.response.status
      const data = error.response.data
      
      if (status === 400) {
        errorMessage = '请求参数错误'
        errorDescription = data?.error || '请检查图片路径是否正确'
      } else if (status === 404) {
        errorMessage = '图片文件不存在'
        errorDescription = data?.error || '无法找到指定的图片文件，请重新添加素材'
      } else if (status === 500) {
        errorMessage = '服务器处理错误'
        errorDescription = data?.error || '图片拼接过程中出错，请检查图片格式或稍后重试'
      } else {
        errorMessage = `HTTP 错误 ${status}`
        errorDescription = data?.error || '请求失败，请稍后重试'
      }
    } else if (error.message) {
      // 其他错误
      errorMessage = '生成失败'
      errorDescription = error.message
    }
    
    // 显示错误消息（合并详细描述）
    const fullErrorMessage = errorDescription 
      ? `${errorMessage}：${errorDescription}` 
      : errorMessage
    ElMessage.error(fullErrorMessage)
  } finally {
    generating.value = false
  }
}

/**
 * 获取生成按钮的文本（根据当前状态）
 * @returns {string} 按钮文本
 */
const getGenerateButtonText = () => {
  if (generating.value) {
    return '生成中...'
  } else if (uploadingExternal.value) {
    return '上传中...'
  } else {
    return '生成并上传外链'
  }
}

/**
 * 合并后的处理函数：生成并上传外链
 * 先调用生成，成功后自动调用上传
 */
const handleGenerateAndUpload = async () => {
  // 检查画布是否已填满
  if (!store.isCanvasComplete()) {
    ElMessage.warning('请先填充所有三个槽位（左侧大图、右上小图、右下小图）')
    return
  }
  
  // 获取三个槽位的素材
  const leftMaterialId = store.getSlotMaterialId('left')
  const topRightMaterialId = store.getSlotMaterialId('topRight')
  const bottomRightMaterialId = store.getSlotMaterialId('bottomRight')
  
  const leftMaterial = store.getMaterialById(leftMaterialId)
  const topRightMaterial = store.getMaterialById(topRightMaterialId)
  const bottomRightMaterial = store.getMaterialById(bottomRightMaterialId)
  
  if (!leftMaterial || !topRightMaterial || !bottomRightMaterial) {
    ElMessage.error('素材数据不完整，请重新拖拽图片到对应的槽位')
    return
  }
  
  // 防止重复提交
  if (generating.value || uploadingExternal.value) {
    ElMessage.warning('正在处理中，请稍候...')
    return
  }
  
  generating.value = true
  resultImageUrl.value = '' // 清空之前的结果
  externalImageUrl.value = '' // 清空之前的外链 URL
  
  try {
    // ========== 第一步：生成拼接图片 ==========
    console.log('🎨 [生成并上传] 第一步：开始生成拼接图片...')
    
    const adjustedSizes = store.getAdjustedSizesForSquare()
    const currentSizes = adjustedSizes
    
    const requestBody = {
      left: leftMaterial.localPath,
      topRight: topRightMaterial.localPath,
      bottomRight: bottomRightMaterial.localPath,
      leftSize: {
        width: currentSizes.left.width,
        height: currentSizes.left.height
      },
      topRightSize: {
        width: currentSizes.topRight.width,
        height: currentSizes.topRight.height
      },
      bottomRightSize: {
        width: currentSizes.bottomRight.width,
        height: currentSizes.bottomRight.height
      }
    }
    
    const response = await axios.post('/api/video-generation/api/process/stitch', requestBody, {
      timeout: 120000
    })
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || '生成失败')
    }
    
    const { localPath, filename } = response.data
    resultImageUrl.value = localPath
    resultImageSize.value = { width: 0, height: 0 }
    
    console.log('✅ [生成并上传] 第一步完成：拼接成功:', localPath)
    ElMessage.success(`图片拼接成功！正在上传外链...`)
    
    // ========== 第二步：自动上传到外链 ==========
    generating.value = false // 生成完成，切换到上传状态
    uploadingExternal.value = true
    
    console.log('📤 [生成并上传] 第二步：开始上传图片到图床外链')
    console.log('  - 图片 URL:', resultImageUrl.value)
    
    // 从 resultImageUrl 获取图片数据
    const imageResponse = await fetch(resultImageUrl.value)
    
    if (!imageResponse.ok) {
      throw new Error('无法获取图片数据')
    }
    
    const imageBlob = await imageResponse.blob()
    const fileSize = imageBlob.size
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)
    
    console.log(`  - 文件大小: ${fileSizeMB} MB`)
    
    // 检查文件大小（10MB 限制）
    const MAX_SIZE = 10 * 1024 * 1024
    if (fileSize > MAX_SIZE) {
      ElMessage.error(`图片过大（${fileSizeMB} MB），请上传小于 10MB 的图片`)
      uploadingExternal.value = false
      return
    }
    
    // 创建 FormData
    const formData = new FormData()
    const fileName = `stitch_${Date.now()}.${resultImageUrl.value.split('.').pop() || 'jpg'}`
    const imageFile = new File([imageBlob], fileName, { type: imageBlob.type })
    // 统一图床上传协议（M2.5）：字段名统一为 file
    formData.append('file', imageFile)
    
    console.log('  - 开始上传到后端...')
    
    // 调用后端接口（不手动设置 Content-Type，让浏览器自动带 boundary，否则后端收不到文件）
    // 统一图床上传入口（M2.5）：前端只调用网关，不直连具体图床实现
    const uploadResponse = await axios.post('/api/upload-image', formData, {
      timeout: 35000
    })
    
    // 处理上传响应
    if (uploadResponse.data && uploadResponse.data.success && uploadResponse.data.url) {
      externalImageUrl.value = uploadResponse.data.url
      console.log('✅ [生成并上传] 第二步完成：上传成功:', uploadResponse.data.url)
      ElMessage.success('图片已生成并上传到外链！')
      
      // 同步外链到广告投放页面
      syncExternalLinkToAdCampaign(uploadResponse.data.url)
    } else {
      throw new Error(uploadResponse.data?.error || '上传失败')
    }
    
  } catch (error) {
    console.error('❌ [生成并上传] 处理失败:', error)
    
    // 详细的错误处理
    let errorMessage = ''
    let errorDescription = ''
    
    // 判断是生成阶段还是上传阶段的错误
    const isGenerationError = generating.value
    
    if (isGenerationError) {
      // 生成阶段的错误
      errorMessage = '生成失败'
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorDescription = '图片处理时间过长，可能是图片太大或服务器繁忙，请稍后重试'
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        errorDescription = '请检查网络连接，确保 Python 服务正在运行'
      } else if (error.response) {
        const status = error.response.status
        const data = error.response.data
        
        if (status === 400) {
          errorDescription = data?.error || '请检查图片路径是否正确'
        } else if (status === 404) {
          errorDescription = data?.error || '无法找到指定的图片文件，请重新添加素材'
        } else if (status === 500) {
          errorDescription = data?.error || '图片拼接过程中出错，请检查图片格式或稍后重试'
        } else {
          errorDescription = data?.error || '请求失败，请稍后重试'
        }
      } else if (error.message) {
        errorDescription = error.message
      }
      
      const fullErrorMessage = errorDescription 
        ? `${errorMessage}：${errorDescription}` 
        : errorMessage
      ElMessage.error(fullErrorMessage)
      
    } else {
      // 上传阶段的错误（生成已成功）
      errorMessage = '上传失败'
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorDescription = '上传超时，请稍后重试。图片已生成，可以使用"上传到外链"按钮重新上传'
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        errorDescription = '无法连接到服务器，请检查网络连接。图片已生成，可以使用"上传到外链"按钮重新上传'
      } else if (error.response) {
        const data = error.response.data
        const rawDesc = data?.error ?? data?.message
        errorDescription = (typeof rawDesc === 'string' ? rawDesc : rawDesc?.message ?? '') || `上传失败 (HTTP ${error.response.status})。图片已生成，可以使用"上传到外链"按钮重新上传`
        
        const descStr = String(errorDescription ?? '')
        if (error.response.status === 401 || descStr.includes('API Key')) {
          errorDescription = 'API Key 无效或已过期，请联系管理员检查配置。图片已生成，可以使用"上传到外链"按钮重新上传'
        }
      } else if (error.message) {
        errorDescription = `${error.message}。图片已生成，可以使用"上传到外链"按钮重新上传`
      }
      
      ElMessage.warning(`图片生成成功，但${errorMessage}：${errorDescription}`)
    }
    
  } finally {
    generating.value = false
    uploadingExternal.value = false
  }
}

// 方法：复制图片 URL
// 方法：处理生成结果图片加载完成事件
// 当图片加载完成后，获取图片的实际尺寸（用于验证动态尺寸功能）
const handleResultImageLoad = (event) => {
  const img = event.target
  // 使用 naturalWidth 和 naturalHeight 获取图片的原始尺寸（不受CSS缩放影响）
  const actualWidth = img.naturalWidth
  const actualHeight = img.naturalHeight
  
  // 更新尺寸信息
  resultImageSize.value = {
    width: actualWidth,
    height: actualHeight
  }
  
  // 获取预期尺寸（1:1正方形，用于对比验证）
  const expectedSize = store.getCanvasSizeSquare()
  
  // 输出尺寸信息到控制台（用于验证）
  console.log('📐 [验证] 图片实际尺寸:', `${actualWidth} × ${actualHeight} 像素`)
  console.log('📐 [验证] 预期画布尺寸:', `${expectedSize.width} × ${expectedSize.height} 像素`)
  
  // 验证尺寸是否匹配（允许1像素的误差，因为可能存在舍入）
  const widthMatch = Math.abs(actualWidth - expectedSize.width) <= 1
  const heightMatch = Math.abs(actualHeight - expectedSize.height) <= 1
  
  if (widthMatch && heightMatch) {
    console.log('✅ [验证] 尺寸匹配成功！动态尺寸功能正常工作')
  } else {
    const widthDiff = actualWidth - expectedSize.width
    const heightDiff = actualHeight - expectedSize.height
    console.warn('⚠️ [验证] 尺寸不匹配！')
    console.warn('  实际尺寸:', `${actualWidth} × ${actualHeight} 像素`)
    console.warn('  预期尺寸:', `${expectedSize.width} × ${expectedSize.height} 像素`)
    console.warn('  宽度差异:', `${widthDiff > 0 ? '+' : ''}${widthDiff} 像素`)
    console.warn('  高度差异:', `${heightDiff > 0 ? '+' : ''}${heightDiff} 像素`)
    console.warn('  可能原因：后端未正确接收或使用尺寸参数，请检查后端日志')
  }
}

/**
 * 方法：上传图片到统一图床外链
 * 
 * 实现思路：
 * 1. 检查是否有生成的图片
 * 2. 从 resultImageUrl 获取图片数据（转换为 Blob）
 * 3. 检查文件大小（10MB 限制）
 * 4. 创建 FormData，添加图片
 * 5. 调用后端接口 /api/upload-image
 * 6. 显示上传结果
 * 
 * 技术要点：
 * - fetch API: 用于获取图片数据
 * - Blob: 二进制大对象，用于表示文件数据
 * - FormData: 用于创建 multipart/form-data 请求体
 * - 文件大小检查: 上传前验证，避免浪费带宽
 */
const handleUploadToExternal = async () => {
  // 1. 检查是否有生成的图片
  if (!resultImageUrl.value) {
    ElMessage.warning('请先生成拼接图片')
    return
  }

  // 防止重复提交
  if (uploadingExternal.value) {
    return
  }

  uploadingExternal.value = true
  externalImageUrl.value = '' // 清空之前的外链 URL

  try {
    console.log('📤 [ExternalUpload] 开始上传图片到图床外链')
    console.log('  - 图片 URL:', resultImageUrl.value)

    // 2. 从 resultImageUrl 获取图片数据
    // 使用 fetch 获取图片，然后转换为 Blob
    // 注意：如果未来有 Canvas 对象，优先使用 canvas.toBlob()
    const imageResponse = await fetch(resultImageUrl.value)
    
    if (!imageResponse.ok) {
      throw new Error('无法获取图片数据')
    }

    // 将响应转换为 Blob 对象
    // Blob 是二进制大对象，用于表示文件数据
    const imageBlob = await imageResponse.blob()
    const fileSize = imageBlob.size
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2)

    console.log(`  - 文件大小: ${fileSizeMB} MB`)

    // 3. 检查文件大小（10MB 限制）
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (fileSize > MAX_SIZE) {
      ElMessage.error(`图片过大（${fileSizeMB} MB），请上传小于 10MB 的图片`)
      return
    }

    // 4. 创建 FormData，添加图片
    // FormData 用于创建 multipart/form-data 格式的请求体
    const formData = new FormData()
    
    // 从 Blob 创建 File 对象（需要文件名）
    // 使用当前时间戳作为文件名，保持原始扩展名
    const fileName = `stitch_${Date.now()}.${resultImageUrl.value.split('.').pop() || 'jpg'}`
    const imageFile = new File([imageBlob], fileName, { type: imageBlob.type })
    
    // 统一图床上传协议（M2.5）：字段名统一为 file
    formData.append('file', imageFile)

    console.log('  - 开始上传到后端...')

    // 5. 调用后端接口
    // 统一图床上传入口（M2.5）：前端只调用网关，不直连具体图床实现
    const response = await axios.post('/api/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data' // 必须设置，让 axios 自动处理 boundary
      },
      timeout: 35000 // 35秒超时（比后端30秒稍长，留出缓冲）
    })

    // 6. 处理响应
    if (response.data && response.data.success && response.data.url) {
      externalImageUrl.value = response.data.url
      console.log('✅ [ExternalUpload] 上传成功:', response.data.url)
      ElMessage.success('图片已上传到外链！')
      
      // 7. 同步外链到广告投放页面（新增功能）
      syncExternalLinkToAdCampaign(response.data.url)
    } else {
      throw new Error(response.data?.error || '上传失败')
    }

  } catch (error) {
    console.error('❌ [ExternalUpload] 上传失败:', error)
    
    // ✅ 增强错误日志：输出完整的错误信息
    console.error('  - 错误消息:', error.message)
    console.error('  - 错误代码:', error.code)
    if (error.response) {
      console.error('  - HTTP 状态码:', error.response.status)
      console.error('  - 响应数据:', error.response.data)
    }
    
    // 详细的错误处理
    let errorMessage = '上传失败'
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = '上传超时，请稍后重试'
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
      errorMessage = '无法连接到服务器，请检查网络连接'
    } else if (error.response) {
      // 后端返回的错误
      const data = error.response.data
      // ✅ 显示后端返回的具体错误信息
      errorMessage = data?.error || data?.message || `上传失败 (HTTP ${error.response.status})`
      
    } else if (error.message) {
      errorMessage = error.message
    }

    ElMessage.error(errorMessage)
  } finally {
    uploadingExternal.value = false
  }
}

/**
 * 同步外链到广告投放页面（新增功能）
 * 在外链上传成功后，将外链和3张图片的商品信息同步到广告投放页面
 * 
 * @param {string} externalLink - 外链URL
 */
const syncExternalLinkToAdCampaign = async (externalLink) => {
  try {
    // 动态导入 adCampaignStore（避免循环依赖）
    const { useAdCampaignStore } = await import('@/stores/adCampaign')
    const adCampaignStore = useAdCampaignStore()
    
    // 检查是否在拼图对齐模式下（只有在这个模式下才同步）
    if (adCampaignStore.workflowMode !== 'stitch_sync') {
      console.log('ℹ️ [同步] 当前为标准模式，跳过外链同步')
      return
    }
    
    // 获取所有槽位的商品信息
    const productInfoList = store.getAllSlotsProductInfo()
    
    // 检查是否有商品信息
    if (productInfoList.length === 0) {
      console.warn('⚠️ [同步] 没有找到商品信息，无法同步外链')
      ElMessage.warning('未找到商品信息，外链未同步到广告投放页面。请先导入Excel或确保素材已关联商品信息。')
      return
    }
    
    // 检查是否有3个商品信息（拼图需要3张图片）
    if (productInfoList.length !== 3) {
      console.warn(`⚠️ [同步] 商品信息数量不完整：期望3个，实际${productInfoList.length}个`)
      ElMessage.warning(`商品信息不完整（${productInfoList.length}/3），外链未同步。请确保3张图片都已关联商品信息。`)
      return
    }
    
    // 获取3个槽位的素材，用于获取图片链接
    const leftMaterialId = store.getSlotMaterialId('left')
    const topRightMaterialId = store.getSlotMaterialId('topRight')
    const bottomRightMaterialId = store.getSlotMaterialId('bottomRight')
    
    const leftMaterial = store.getMaterialById(leftMaterialId)
    const topRightMaterial = store.getMaterialById(topRightMaterialId)
    const bottomRightMaterial = store.getMaterialById(bottomRightMaterialId)
    
    // 构建图片链接数组（包含商品信息）
    const imageLinks = [
      {
        link: leftMaterial?.originalUrl || leftMaterial?.publicUrl || '',
        productInfo: store.getSlotProductInfo('left')
      },
      {
        link: topRightMaterial?.originalUrl || topRightMaterial?.publicUrl || '',
        productInfo: store.getSlotProductInfo('topRight')
      },
      {
        link: bottomRightMaterial?.originalUrl || bottomRightMaterial?.publicUrl || '',
        productInfo: store.getSlotProductInfo('bottomRight')
      }
    ].filter(item => item.link) // 过滤掉空的链接
    
    // 调用 store 方法添加外链（会自动去重和智能切换）
    adCampaignStore.addExternalLink(externalLink, imageLinks)
    
    console.log('✅ [同步] 外链已同步到广告投放页面:', {
      externalLink,
      productCount: productInfoList.length,
      imageCount: imageLinks.length
    })
    
    ElMessage.success('外链已同步到广告投放页面！')
    
  } catch (error) {
    console.error('❌ [同步] 外链同步失败:', error)
    // 静默失败，不影响外链上传的成功提示
    // 只在控制台记录错误，不显示错误提示（避免干扰用户体验）
  }
}

/**
 * 方法：复制外链 URL 到剪贴板
 * 
 * 使用 navigator.clipboard API（现代浏览器支持）
 * 如果浏览器不支持，降级到传统方法
 */
const handleCopyExternalUrl = async () => {
  if (!externalImageUrl.value) {
    ElMessage.warning('没有外链地址可复制')
    return
  }

  try {
    // 使用现代 Clipboard API
    await navigator.clipboard.writeText(externalImageUrl.value)
    ElMessage.success('外链地址已复制到剪贴板')
    console.log('✅ [ExternalUpload] 外链地址已复制:', externalImageUrl.value)
  } catch (error) {
    console.error('❌ [ExternalUpload] 复制失败:', error)
    
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea')
      textArea.value = externalImageUrl.value
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      ElMessage.success('外链地址已复制到剪贴板')
    } catch (fallbackError) {
      ElMessage.error('复制失败，请手动复制')
    }
  }
}

const handleCopyUrl = async () => {
  if (!resultImageUrl.value) {
    ElMessage.warning('没有可复制的链接')
    return
  }
  
  // 构建完整的 URL（如果需要）
  const fullUrl = resultImageUrl.value.startsWith('http')
    ? resultImageUrl.value
    : `${window.location.origin}${resultImageUrl.value}`
  
  // 检查是否支持 Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    // 使用现代 Clipboard API（需要 HTTPS 或 localhost）
    try {
      await navigator.clipboard.writeText(fullUrl)
      ElMessage.success('链接已复制到剪贴板')
      console.log('📋 [复制] 已复制链接:', fullUrl)
      return
    } catch (error) {
      console.warn('⚠️ [复制] Clipboard API 失败，尝试降级方案:', error)
      // 如果 Clipboard API 失败，继续使用降级方案
    }
  }
  
  // 降级方案：使用传统方法（兼容所有浏览器和环境）
  try {
    const textArea = document.createElement('textarea')
    textArea.value = fullUrl
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px' // 移到屏幕外，而不是 opacity: 0
    textArea.style.top = '0'
    textArea.setAttribute('readonly', '') // 防止移动端键盘弹出
    document.body.appendChild(textArea)
    
    // 选择文本（兼容不同浏览器）
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      // iOS 设备需要特殊处理
      const range = document.createRange()
      range.selectNodeContents(textArea)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      textArea.setSelectionRange(0, 999999)
    } else {
      textArea.select()
    }
    
    // 执行复制
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      ElMessage.success('链接已复制到剪贴板')
      console.log('📋 [复制] 已复制链接（降级方案）:', fullUrl)
    } else {
      throw new Error('execCommand 返回 false')
    }
  } catch (fallbackError) {
    console.error('❌ [复制] 所有复制方法都失败:', fallbackError)
    ElMessage.error('复制失败，请手动复制链接')
  }
}

// 组件挂载时的初始化
onMounted(() => {
  console.log('📸 [ImageStitch] 图片拼接页面已加载')
})

// 组件卸载时的清理
onUnmounted(() => {
  // 清理拖动事件监听器（防止内存泄漏）- 使用 window
  if (dragging.value.type === 'vertical') {
    window.removeEventListener('mousemove', handleVerticalDrag)
    window.removeEventListener('mouseup', stopVerticalDrag)
  }
  if (dragging.value.type === 'horizontal') {
    window.removeEventListener('mousemove', handleHorizontalDrag)
    window.removeEventListener('mouseup', stopHorizontalDrag)
  }
  console.log('📸 [ImageStitch] 图片拼接页面已卸载，事件监听器已清理')
})
</script>

<style scoped>
.image-stitch-container {
  width: 100%;
  min-height: calc(100vh - 40px);
  padding: 12px;
  background-color: #f5f7fa;
}

/* 工作区布局：三栏结构（水平排列） */
.workspace-layout {
  display: flex;
  gap: 12px;
  height: calc(100vh - 64px);
  max-width: 100%;
}

/* 左侧：素材区 */
.materials-section {
  width: 340px;
  flex-shrink: 0;
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.materials-section h2 {
  font-size: 1rem;
  margin: 0 0 16px 0;
  color: #303133;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 12px;
}

/* 中间：画布预览区 */
.canvas-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 0;
  overflow: hidden;
}

.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.canvas-header h2 {
  font-size: 1rem;
  margin: 0;
  color: #303133;
  font-weight: 600;
}

.generate-button-top {
  padding: 8px 20px;
  font-weight: 500;
}

.section-placeholder {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 1rem;
}

/* 画布容器：用于自适应缩放 */
.canvas-grid-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* 改为 hidden，去掉滚动条 */
  min-height: 0;
  padding: 8px; /* 减少 padding，从 12px 改为 8px */
  position: relative;
}

/* 画布预览区样式 - 使用绝对定位 */
.canvas-grid {
  /* ✅ 移除 CSS Grid，使用绝对定位 */
  /* display: grid; - 已移除 */
  /* gap: 4px; - 已移除，绝对定位不需要 gap */
  transform-origin: center center;
  transition: transform 0.3s ease;
  /* 自适应缩放：确保画布完整显示在容器内 */
  flex-shrink: 0;
  /* ✅ 相对定位：作为绝对定位槽位的容器 */
  position: relative;
  /* ✅ 使用 aspect-ratio 强制1:1（通过 :style 动态绑定） */
}

/* 画布槽位通用样式 - 使用绝对定位 */
.canvas-slot {
  /* ✅ 移除 width: 100%; height: 100%; - 绝对定位使用具体尺寸 */
  /* ✅ 位置和尺寸通过 :style 动态绑定（leftSlotStyle, topRightSlotStyle, bottomRightSlotStyle） */
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f5f7fa;
  position: absolute;  /* ✅ 绝对定位 */
  transition: all 0.3s ease;
}

/* 左侧大图：不再需要 grid-row: span 2，使用绝对定位 */
/* .left-slot - 已移除，使用绝对定位，位置和尺寸通过 leftSlotStyle 计算属性动态绑定 */

.canvas-slot:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}

/* 拖拽悬停在槽位上时的高亮样式 */
.canvas-slot.drag-over {
  border-color: #409eff; /* 蓝色边框 */
  border-style: solid; /* 实线边框 */
  border-width: 3px; /* 加粗边框 */
  background-color: #ecf5ff; /* 浅蓝色背景 */
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.4); /* 蓝色光晕效果 */
  transform: scale(1.02); /* 稍微放大 */
}

.slot-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* 占位符样式 */
.slot-placeholder {
  text-align: center;
  color: #909399;
  padding: 20px;
}

.slot-placeholder p {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.slot-placeholder small {
  font-size: 12px;
  color: #c0c4cc;
}

/* 槽位图片样式 */
.slot-image {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 图片填充容器，保持比例，从中心裁剪 */
  object-position: center;
  display: block;
}

/* ========== 分割线样式 ========== */

/* 分割线容器（绝对定位，覆盖在画布上） */
.divider {
  position: absolute;
  z-index: 10; /* 确保分割线在槽位之上 */
  user-select: none; /* 防止选中文本 */
  transition: all 0.3s ease; /* ✅ 优化：添加 all 过渡，让所有属性都有过渡效果 */
  pointer-events: auto; /* 确保可以接收鼠标事件 */
}

/* ✅ 宽大热区（伪元素）- 增大拖动热区，让用户更容易拖动 */
.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: -1; /* 在分割线下方，不遮挡视觉 */
  pointer-events: auto; /* 确保可以接收鼠标事件 */
  transition: all 0.3s ease;
}

/* 纵向分割线（中间，调整左右宽度） */
.divider-vertical {
  cursor: col-resize; /* 左右箭头光标，提示可以左右拖动 */
  width: 4px; /* 分割线宽度（视觉宽度） */
  background-color: rgba(64, 158, 255, 0.4); /* ✅ 优化：稍微提高不透明度（从 0.3 提升到 0.4） */
  border-radius: 2px;
}

/* ✅ 纵向分割线的宽大热区（优化：增大热区） */
.divider-vertical::before {
  width: 30px; /* ✅ 优化：热区宽度从 20px 增大到 30px（比视觉宽度 4px 大 7.5 倍） */
  height: 100%; /* 热区高度：占满整个分割线高度 */
  left: 50%;
  transform: translateX(-50%); /* 水平居中 */
  background-color: transparent; /* 热区本身不可见 */
}

/* 横向分割线（右侧，调整右上右下高度） */
.divider-horizontal {
  cursor: row-resize; /* 上下箭头光标，提示可以上下拖动 */
  height: 4px; /* 分割线高度（视觉高度） */
  background-color: rgba(64, 158, 255, 0.4); /* ✅ 优化：稍微提高不透明度（从 0.3 提升到 0.4） */
  border-radius: 2px;
}

/* ✅ 横向分割线的宽大热区（优化：增大热区） */
.divider-horizontal::before {
  width: 100%; /* 热区宽度：占满整个分割线宽度 */
  height: 30px; /* ✅ 优化：热区高度从 20px 增大到 30px（比视觉高度 4px 大 7.5 倍） */
  top: 50%;
  transform: translateY(-50%); /* 垂直居中 */
  background-color: transparent; /* 热区本身不可见 */
}

/* ✅ 优化：分割线悬停效果（更明显的视觉反馈） */
.divider:hover {
  background-color: rgba(64, 158, 255, 0.9); /* ✅ 优化：悬停时更明显（从 0.8 提升到 0.9） */
  box-shadow: 0 0 16px rgba(64, 158, 255, 0.7); /* ✅ 优化：增强阴影效果（从 12px 0.6 提升到 16px 0.7） */
  transform: scale(1.3); /* ✅ 优化：稍微放大（从 1.2 提升到 1.3），让用户更容易看到 */
  transition: all 0.2s ease; /* ✅ 优化：添加快速过渡动画，让悬停效果更流畅 */
}

/* ✅ 优化：分割线拖动时的效果 */
.divider.dragging {
  background-color: rgba(64, 158, 255, 1); /* ✅ 拖动时完全不透明 */
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.9); /* ✅ 优化：增强光晕效果（从 16px 0.8 提升到 20px 0.9） */
  transform: scale(1.4); /* ✅ 优化：拖动时进一步放大（从 1.3 提升到 1.4） */
  transition: all 0.1s ease; /* ✅ 优化：添加快速过渡动画，让拖动效果更流畅 */
}

/* 分割线手柄（更明显的视觉提示，方便用户识别和拖动） */
.divider-handle {
  position: absolute;
  background-color: rgba(64, 158, 255, 0.9); /* ✅ 优化：提高不透明度（从 0.8 提升到 0.9） */
  border-radius: 3px; /* ✅ 优化：稍微增大圆角（从 2px 提升到 3px） */
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* ✅ 优化：添加轻微阴影，让手柄更立体 */
}

/* 纵向分割线手柄（垂直方向的手柄） */
.divider-vertical .divider-handle {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 20px; /* 手柄宽度 */
  height: 40px; /* 手柄高度 */
}

/* 横向分割线手柄（水平方向的手柄） */
.divider-horizontal .divider-handle {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 40px; /* 手柄宽度 */
  height: 20px; /* 手柄高度 */
}

/* 分割线手柄悬停效果 */
.divider:hover .divider-handle {
  background-color: rgba(64, 158, 255, 1); /* 悬停时完全不透明 */
  transform: translate(-50%, -50%) scale(1.15); /* ✅ 优化：稍微放大（从 1.1 提升到 1.15） */
  box-shadow: 0 4px 8px rgba(64, 158, 255, 0.5); /* ✅ 优化：增强阴影效果，让手柄更明显 */
}

/* 分割线拖动时手柄效果 */
.divider.dragging .divider-handle {
  background-color: rgba(64, 158, 255, 1);
  box-shadow: 0 0 16px rgba(64, 158, 255, 0.9); /* ✅ 优化：增强光晕效果（从 12px 0.8 提升到 16px 0.9） */
  transform: translate(-50%, -50%) scale(1.2); /* ✅ 优化：拖动时进一步放大 */
}

/* 素材区样式 */
.url-input-section {
  margin-bottom: 20px;
}

.input-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 0;
}

.downloading-hint {
  color: #409eff;
  display: flex;
  align-items: center;
  font-weight: 500;
}

.downloading-hint .el-icon {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 素材网格布局 - 使用 Bootstrap Grid 样式 */
.materials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

/* 素材卡片 */
.material-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
  background-color: #fff;
  transition: all 0.3s ease;
  cursor: move; /* 表示可拖拽 */
}

.material-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* 拖拽中的素材卡片样式 */
.material-card.dragging {
  opacity: 0.5; /* 降低透明度，表示正在被拖拽 */
  transform: scale(0.95); /* 稍微缩小 */
  box-shadow: 0 8px 16px rgba(64, 158, 255, 0.3); /* 蓝色阴影 */
  border-color: #409eff; /* 蓝色边框 */
}

.material-image {
  width: 100%;
  aspect-ratio: 1; /* 保持正方形 */
  overflow: hidden;
  background-color: #f5f7fa;
}

.material-image img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 图片填充容器，保持比例 */
  display: block;
}

.material-actions {
  padding: 6px;
  display: flex;
  justify-content: center;
  background-color: #fff;
}

.material-actions .el-button {
  font-size: 0.75rem;
  padding: 4px 8px;
  height: auto;
  line-height: 1.2;
}

/* 空状态 */
.empty-state {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

/* 画布提示信息 */
.canvas-hint {
  margin-top: 12px;
  padding: 12px;
  background-color: #f0f9ff;
  border-radius: 6px;
  border: 1px solid #bae6fd;
  text-align: center;
}

.canvas-hint p {
  margin: 0;
  font-size: 0.875rem;
  color: #0369a1;
}

/* 生成结果区域（右侧面板下方） */
.result-section {
  margin-top: 16px;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.result-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.result-header h3 {
  font-size: 0.875rem;
  margin: 0;
  color: #303133;
  font-weight: 600;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-preview {
  text-align: center;
  background-color: white;
  border-radius: 6px;
  padding: 8px;
  border: 1px solid #e4e7ed;
  max-height: 300px;
  overflow: hidden;
  /* 确保容器可以容纳1:1的正方形图片 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-image {
  max-width: 100%;
  max-height: 280px;
  width: 100%;
  aspect-ratio: 1; /* 强制1:1正方形显示 */
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  object-fit: contain; /* 保持图片比例，完整显示 */
  object-position: center;
}

/* 尺寸信息显示 */
.result-info {
  margin: 12px 0;
  padding: 10px;
  background-color: #f0f2f5;
  border-radius: 6px;
  font-size: 13px;
}

.size-info {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.size-info:last-child {
  margin-bottom: 0;
}

.size-label {
  color: #606266;
  font-weight: 500;
  margin-right: 8px;
  min-width: 80px;
}

.size-value {
  color: #303133;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.result-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-url-input {
  flex: 1;
}

/* 外链上传相关样式 */
.external-url-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e4e7ed;
}

.external-url-label {
  font-size: 0.75rem;
  color: #606266;
  margin-bottom: 6px;
  font-weight: 500;
}

/* 响应式布局 - 小屏幕时垂直排列 */
/* 右侧：布局参数面板（紧凑设计） */
.layout-params-panel {
  width: 260px;
  flex-shrink: 0;
  background-color: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.params-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.params-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #303133;
  font-weight: 600;
}

.params-header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 尺寸调整面板样式 */
.size-control-section {
  margin-top: 0;
}

.size-control-group {
  margin-bottom: 8px;
  padding: 8px;
  background-color: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.size-control-group:last-child {
  margin-bottom: 0;
}

.size-control-group h4 {
  margin: 0 0 8px 0;
  font-size: 0.75rem;
  color: #606266;
  font-weight: 600;
}

.size-control-item {
  margin-bottom: 8px;
}

.size-control-item:last-child {
  margin-bottom: 0;
}

.size-control-item label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.6875rem;
  color: #909399;
  font-weight: 500;
}

.size-control-item .el-input-number {
  width: 100%;
}

.size-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  color: #909399;
  font-style: italic;
}

@media (max-width: 1024px) {
  .workspace-layout {
    flex-direction: column;
    height: auto;
  }
  
  .materials-section {
    width: 100%;
    max-height: 400px;
  }
  
  .layout-params-panel {
    width: 100%;
    max-height: 400px;
  }
}

@media (max-width: 768px) {
  .image-stitch-container {
    padding: 12px;
  }
  
  .workspace-layout {
    gap: 12px;
  }
  
  .result-actions {
    flex-direction: column;
  }
  
  .result-url-input {
    width: 100%;
  }
}
</style>

