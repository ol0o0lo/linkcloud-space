import assert from 'node:assert/strict'
import test from 'node:test'
import type { TenantContactShare, TenantContactValues } from '../src/services/manual/tenant-rental.ts'
import { canShareContact, createContactSharingController, emptyContactSharingState } from '../src/features/tenant-rental/contact-sharing.ts'

function fixture() {
  let userId = 1
  let saved: TenantContactValues = { phone: '+8613800138001', wechat: 'private-wechat' }
  let state = emptyContactSharingState()
  const writes: TenantContactValues[] = []
  const shares: TenantContactShare[] = []
  const delivered: number[] = []
  const api = {
    read: async () => ({ ...saved }),
    save: async (values: TenantContactValues) => {
      writes.push({ ...values })
      saved = { ...values }
      return saved
    },
    share: async (conversationId: number, payload: TenantContactShare) => {
      shares.push(payload)
      return { id: 5, conversation_id: conversationId, seq: 1, sender_member_id: 1, client_message_id: payload.client_message_id, content: '联系方式', created_at: '2026-10-25T00:00:00Z' }
    },
  }
  const controller = createContactSharingController(api, () => userId, value => state = value, message => delivered.push(message.id))
  return { api, controller, state: () => state, writes, shares, delivered, switchAccount: () => userId = 2 }
}

test('读取和修改个人设置不选择或发送联系方式，再次打开读取修改后的值', async () => {
  const ctx = fixture()
  await ctx.controller.open(1, 17)
  assert.deepEqual(ctx.state().channels, [])
  assert.equal(canShareContact(ctx.state()), false)
  ctx.controller.edit('wechat', 'updated-wechat')
  await ctx.controller.save()
  assert.equal(ctx.shares.length, 0)
  assert.deepEqual(ctx.state().channels, [])
  await ctx.controller.open(1, 17)
  assert.equal(ctx.state().values.wechat, 'updated-wechat')
  ctx.controller.edit('phone', '')
  await ctx.controller.save()
  assert.equal(ctx.writes.at(-1)?.phone, '')
})

test('读取失败不能将空表单覆盖已有个人设置', async () => {
  const ctx = fixture()
  ctx.api.read = async () => {
    throw new Error('网络不可用')
  }
  await ctx.controller.open(1, 17)
  assert.equal(ctx.state().loaded, false)
  assert.equal(await ctx.controller.save(), false)
  assert.equal(ctx.writes.length, 0)
  assert.equal(ctx.state().error, '网络不可用')
})

test('连续修改串行保存，旧响应不能覆盖新的输入', async () => {
  const ctx = fixture()
  await ctx.controller.open(1, 17)
  let finishFirst: (values: TenantContactValues) => void = () => {}
  const originalSave = ctx.api.save
  let calls = 0
  ctx.api.save = async (values) => {
    calls += 1
    if (calls === 1)
      return new Promise(resolve => finishFirst = resolve)
    return originalSave(values)
  }
  ctx.controller.edit('wechat', 'first-edit')
  const first = ctx.controller.save()
  await Promise.resolve()
  ctx.controller.edit('wechat', 'latest-edit')
  const second = ctx.controller.save()
  assert.equal(calls, 1)
  finishFirst({ phone: '+8613800138001', wechat: 'first-edit' })
  await first
  assert.equal(ctx.state().values.wechat, 'latest-edit')
  await second
  assert.equal(ctx.writes.at(-1)?.wechat, 'latest-edit')
})

test('分享只包含勾选项，网络失败重试复用 UUID，重复点击不重复提交', async () => {
  const ctx = fixture()
  await ctx.controller.open(1, 17)
  ctx.controller.select('phone', true)
  const originalShare = ctx.api.share
  let failedUuid = ''
  let calls = 0
  ctx.api.share = async (conversationId, payload) => {
    calls += 1
    assert.equal(conversationId, 17)
    assert.equal(payload.wechat, '')
    assert.deepEqual(payload.channels, ['phone'])
    if (calls === 1) {
      failedUuid = payload.client_message_id
      throw new Error('回执丢失')
    }
    assert.equal(payload.client_message_id, failedUuid)
    return originalShare(conversationId, payload)
  }
  await Promise.all([ctx.controller.send(), ctx.controller.send()])
  assert.equal(calls, 1)
  await ctx.controller.send()
  assert.deepEqual(ctx.delivered, [5])
  assert.equal(ctx.writes.length, 0)
})

test('保存失败阻止发送，切换账号后不会提交旧输入', async () => {
  const ctx = fixture()
  await ctx.controller.open(1, 17)
  ctx.controller.edit('wechat', 'changed-wechat')
  ctx.controller.select('wechat', true)
  ctx.api.save = async () => {
    throw new Error('保存失败')
  }
  await ctx.controller.send()
  assert.equal(ctx.shares.length, 0)
  assert.equal(ctx.state().values.wechat, 'changed-wechat')
  assert.equal(ctx.state().error, '保存失败')
  await ctx.controller.open(1, 17)
  assert.equal(ctx.state().values.wechat, 'changed-wechat')
  assert.deepEqual(ctx.state().channels, [])
  ctx.switchAccount()
  assert.equal(await ctx.controller.save(), false)
  ctx.controller.reset()
  assert.deepEqual(ctx.state().values, { phone: '', wechat: '' })
})
