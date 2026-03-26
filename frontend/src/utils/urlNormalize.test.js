import { describe, it, expect } from 'vitest'
import { normalizeUrl, normalizeUrls } from './urlNormalize'

describe('normalizeUrl', () => {
  it('去除查询参数与锚点并转小写', () => {
    expect(
      normalizeUrl('HTTPS://EXAMPLE.COM/PATH.JPG?x=1#h')
    ).toBe('https://example.com/path.jpg')
  })

  it('空值与非字符串返回空串', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(null)).toBe('')
    expect(normalizeUrl(undefined)).toBe('')
    expect(normalizeUrl(123)).toBe('')
  })

  it('相对路径等非法 URL 走降级分支', () => {
    expect(normalizeUrl('/a/B?Q=1#x')).toBe('/a/b')
  })
})

describe('normalizeUrls', () => {
  it('批量处理并过滤空项', () => {
    expect(normalizeUrls([' https://A.COM/X ', '', null])).toEqual([
      'https://a.com/x',
    ])
  })

  it('非数组返回空数组', () => {
    expect(normalizeUrls(null)).toEqual([])
    expect(normalizeUrls({})).toEqual([])
  })
})
