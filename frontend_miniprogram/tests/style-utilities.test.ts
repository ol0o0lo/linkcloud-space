import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const projectRoot = new URL('../', import.meta.url)
const sourceRoot = new URL('../src/', import.meta.url).pathname
const allowedArbitraryUtilities = new Set([
  'active:scale-[0.985]',
  'grid-cols-[1fr_1.5fr]',
  'h-[calc(96rpx+env(safe-area-inset-bottom))]',
  'min-h-[inherit]',
  'pb-[calc(18rpx+env(safe-area-inset-bottom))]',
  'pb-[calc(124rpx+env(safe-area-inset-bottom))]',
  'pb-[calc(var(--app-page-gutter)+env(safe-area-inset-bottom))]',
])

function vueFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory())
      return vueFiles(path)
    return name.endsWith('.vue') ? [path] : []
  })
}

test('小程序模板不使用带 px 或 rpx 的任意间距、尺寸和圆角工具类', () => {
  const directUnitUtility = /-?(?:m[trblxy]?|p[trblxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|w|h|min-w|max-w|min-h|max-h|rounded(?:-[trbl]{1,2})?|translate-[xy]|border)-\d+(?:rpx|px)\b/g
  const files = [
    ...vueFiles(sourceRoot),
    new URL('uno.config.ts', projectRoot).pathname,
  ]
  const violations = files.flatMap((path) => {
    const matches = readFileSync(path, 'utf8').match(directUnitUtility) ?? []
    return matches.map(className => `${relative(new URL('.', projectRoot).pathname, path)}: ${className}`)
  })

  assert.deepEqual(violations, [])
})

test('任意值工具类只能使用审核过的结构表达式', () => {
  const arbitraryUtility = /\b[A-Z0-9:-]+-\[[^\]]+\]/gi
  const files = [
    ...vueFiles(sourceRoot),
    new URL('uno.config.ts', projectRoot).pathname,
  ]
  const violations = files.flatMap((path) => {
    const matches = readFileSync(path, 'utf8').match(arbitraryUtility) ?? []
    return matches
      .filter(className => !allowedArbitraryUtilities.has(className))
      .map(className => `${relative(new URL('.', projectRoot).pathname, path)}: ${className}`)
  })

  assert.deepEqual(violations, [])
})
