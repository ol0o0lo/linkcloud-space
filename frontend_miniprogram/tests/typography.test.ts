import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

const sourceRoot = new URL('../src/', import.meta.url).pathname
const projectRoot = new URL('../', import.meta.url)

function vueFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory())
      return vueFiles(path)
    return name.endsWith('.vue') ? [path] : []
  })
}

test('小程序模板只使用命名的 UnoCSS 字号阶梯', () => {
  const arbitraryFontSize = /\btext-(?:\[\d+(?:rpx|px)\]|\d+(?:rpx|px)\b)/g
  const files = [
    ...vueFiles(sourceRoot),
    new URL('uno.config.ts', projectRoot).pathname,
  ]
  const violations = files
    .flatMap((path) => {
      const matches = readFileSync(path, 'utf8').match(arbitraryFontSize) ?? []
      return matches.map(className => `${relative(new URL('.', projectRoot).pathname, path)}: ${className}`)
    })

  assert.deepEqual(violations, [])
})
