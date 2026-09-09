import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const sourceRoot = new URL('../src/', import.meta.url).pathname

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory())
      return sourceFiles(path)
    return /\.(?:ts|vue)$/.test(name) ? [path] : []
  })
}

test('页面入口和 feature 不直接依赖 OpenAPI 生成目录', () => {
  const files = [
    ...sourceFiles(join(sourceRoot, 'pages')),
    ...sourceFiles(join(sourceRoot, 'pages-housing')),
    ...sourceFiles(join(sourceRoot, 'pages-org-rental')),
    ...sourceFiles(join(sourceRoot, 'pages-org-work')),
    ...sourceFiles(join(sourceRoot, 'pages-org-admin')),
    ...sourceFiles(join(sourceRoot, 'features')),
  ]
  const violations = files.filter(path => readFileSync(path, 'utf8').includes('@/services/openapi'))
  assert.deepEqual(violations, [])
})

test('页面和 feature 不直接调用底层网络与登录 API', () => {
  const files = [
    ...sourceFiles(join(sourceRoot, 'pages')),
    ...sourceFiles(join(sourceRoot, 'pages-housing')),
    ...sourceFiles(join(sourceRoot, 'pages-org-rental')),
    ...sourceFiles(join(sourceRoot, 'pages-org-work')),
    ...sourceFiles(join(sourceRoot, 'pages-org-admin')),
    ...sourceFiles(join(sourceRoot, 'features')),
  ]
  const forbidden = /uni\.(?:request|uploadFile|login)\s*\(/
  const violations = files.filter(path => forbidden.test(readFileSync(path, 'utf8')))
  assert.deepEqual(violations, [])
})

test('平台目录之外不直接读写 uni 持久化存储', () => {
  const files = sourceFiles(sourceRoot)
    .filter(path => !path.includes('/platform/'))
    .filter(path => !path.includes('/services/openapi/'))
  const forbidden = /uni\.(?:getStorageSync|setStorageSync|removeStorageSync)\s*\(/
  const violations = files.filter(path => forbidden.test(readFileSync(path, 'utf8')))
  assert.deepEqual(violations, [])
})
