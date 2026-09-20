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

test('页面入口、组件和 feature 不直接依赖 OpenAPI 生成目录', () => {
  const files = [
    ...sourceFiles(join(sourceRoot, 'pages')),
    ...sourceFiles(join(sourceRoot, 'pages-saas')),
    ...sourceFiles(join(sourceRoot, 'pages-housing')),
    ...sourceFiles(join(sourceRoot, 'pages-org-rental')),
    ...sourceFiles(join(sourceRoot, 'pages-org-work')),
    ...sourceFiles(join(sourceRoot, 'pages-org-admin')),
    ...sourceFiles(join(sourceRoot, 'features')),
  ].filter(path => !path.includes('/api/'))
  const violations = files.filter(path => readFileSync(path, 'utf8').includes('@/services/openapi'))
  assert.deepEqual(violations, [])
})

test('全局组件不依赖分包且分包之间不互相引用', () => {
  const globalComponents = sourceFiles(join(sourceRoot, 'components'))
  const globalViolations = globalComponents.filter(path => /@\/pages-[^/]+\//.test(readFileSync(path, 'utf8')))
  assert.deepEqual(globalViolations, [])

  const subpackageRoots = ['pages-saas', 'pages-housing', 'pages-personal-rental', 'pages-landlord', 'pages-org-rental', 'pages-org-work', 'pages-org-admin']
  for (const root of subpackageRoots) {
    const files = sourceFiles(join(sourceRoot, root))
    const otherRoots = subpackageRoots.filter(candidate => candidate !== root)
    const violations = files.filter(path => otherRoots.some(candidate => readFileSync(path, 'utf8').includes(`@/${candidate}/`)))
    assert.deepEqual(violations, [], `${root} 不得引用其他分包`)
  }
})

test('组织租赁页面只依赖分包公开 API 接口', () => {
  const files = sourceFiles(join(sourceRoot, 'pages-org-rental'))
    .filter(path => !path.endsWith('/api/organization-rental.ts'))
    .filter(path => !path.endsWith('/api/client.ts'))
  const violations = files.filter((path) => {
    const source = readFileSync(path, 'utf8')
    return source.includes('@/pages-org-rental/api/client') || /from\s+['"]\.\/client['"]/.test(source)
  })
  assert.deepEqual(violations, [])
})

test('页面和 feature 不直接调用底层网络与登录 API', () => {
  const files = [
    ...sourceFiles(join(sourceRoot, 'pages')),
    ...sourceFiles(join(sourceRoot, 'pages-saas')),
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
