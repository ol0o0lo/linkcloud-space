import assert from 'node:assert/strict'
import test from 'node:test'

import { getHouseMatchErrorCopy, resolveHouseMatchError } from '../src/domain/house-match.ts'
import { isPublicRoute } from '../src/modules/registry.ts'
import { getHouseMatchDetailRoute, getHouseMatchRoute } from '../src/modules/routes.ts'

test('配房错误状态区分过期、不存在和版本不支持', () => {
  assert.equal(resolveHouseMatchError({ statusCode: 410 }), 'expired')
  assert.equal(resolveHouseMatchError({ statusCode: 404 }), 'not-found')
  assert.equal(resolveHouseMatchError({ response: { status: 422 } }), 'unsupported')
  assert.match(getHouseMatchErrorCopy('expired').tip, /联系顾问/)
})

test('配房列表和详情路由保留分享 key', () => {
  assert.equal(getHouseMatchRoute('key/value'), '/pages/house-match/index?key=key%2Fvalue')
  assert.equal(getHouseMatchDetailRoute('key/value', 19), '/pages-housing/match-detail/index?key=key%2Fvalue&id=19')
  assert.equal(isPublicRoute(getHouseMatchRoute('key/value')), true)
  assert.equal(isPublicRoute(getHouseMatchDetailRoute('key/value', 19)), true)
})
