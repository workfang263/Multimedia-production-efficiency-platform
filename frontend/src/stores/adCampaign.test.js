import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  alert: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    info: mocks.info,
    warning: mocks.warning,
    success: mocks.success,
  },
  ElMessageBox: {
    alert: mocks.alert,
    confirm: mocks.confirm,
  },
}))

import { useAdCampaignStore } from './adCampaign'

const makeImageLinks = (count) => {
  return Array.from({ length: count }, (_, index) => ({
    link: `https://example.com/image-${count}-${index + 1}.jpg`,
    productInfo: {
      productId: `id-${count}-${index + 1}`,
      productSpu: `spu-${count}-${index + 1}`,
    },
  }))
}

describe('adCampaign store stitch sync automation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('从拼图页同步 5 拼外链时自动切到 stitch_sync + 5:1', async () => {
    const store = useAdCampaignStore()

    const synced = await store.addExternalLink(
      'https://example.com/external-5',
      makeImageLinks(5),
      { pieceCount: 5, stitchRatio: '5:1' }
    )

    expect(synced).toBe(true)
    expect(store.workflowMode).toBe('stitch_sync')
    expect(store.stitchRatio).toBe('5:1')
    expect(store.syncSource).toBe('stitch')
    expect(store.productDataMapping.externalLinks).toHaveLength(1)
    expect(store.productDataMapping.externalLinks[0].pieceCount).toBe(5)
    expect(store.productDataMapping.externalLinks[0].productInfo).toHaveLength(5)
    expect(store.formData['商品图片链接']).toBe('https://example.com/external-5')
  })

  it('已有 3:1 拼图同步数据时切换到 5:1 会确认并清空旧拼图数据', async () => {
    const store = useAdCampaignStore()

    await store.addExternalLink(
      'https://example.com/external-3',
      makeImageLinks(3),
      { pieceCount: 3, stitchRatio: '3:1' }
    )

    store.formData['商品ID'] = 'old-id-1\nold-id-2\nold-id-3'
    store.formData['商品SPU'] = 'old-spu-1\nold-spu-2\nold-spu-3'

    mocks.confirm.mockResolvedValueOnce(true)

    const synced = await store.addExternalLink(
      'https://example.com/external-5',
      makeImageLinks(5),
      { pieceCount: 5, stitchRatio: '5:1' }
    )

    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(synced).toBe(true)
    expect(store.workflowMode).toBe('stitch_sync')
    expect(store.stitchRatio).toBe('5:1')
    expect(store.productDataMapping.externalLinks).toHaveLength(1)
    expect(store.productDataMapping.externalLinks[0].externalLink).toBe('https://example.com/external-5')
    expect(store.formData['商品图片链接']).toBe('https://example.com/external-5')
    expect(store.formData['商品ID']).toBe('')
    expect(store.formData['商品SPU']).toBe('')
  })
})
