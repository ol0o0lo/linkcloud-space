import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { TDesignResolver } from '../tdesign-resolver.ts'

test('聊天、附件和基础组件按需解析到已安装的 Vue 组件', async () => {
  const resolver = TDesignResolver()
  assert.equal(typeof resolver, 'object')
  assert.equal(resolver.type, 'component')
  for (const [name, path] of [
    ['TChatList', '@tdesign/uniapp-chat/chat-list/chat-list.vue'],
    ['TChatMessage', '@tdesign/uniapp-chat/chat-message/chat-message.vue'],
    ['TChatSender', '@tdesign/uniapp-chat/chat-sender/chat-sender.vue'],
    ['TChatMarkdown', '@tdesign/uniapp-chat/chat-markdown/chat-markdown.vue'],
    ['TChatThinking', '@tdesign/uniapp-chat/chat-thinking/chat-thinking.vue'],
    ['TAttachments', '@tdesign/uniapp-chat/attachments/attachments.vue'],
    ['TButton', '@tdesign/uniapp/button/button.vue'],
    ['t-chat-list', '@tdesign/uniapp-chat/chat-list/chat-list.vue'],
  ]) {
    assert.deepEqual(await resolver.resolve(name), { name, from: path })
    assert.equal(existsSync(fileURLToPath(import.meta.resolve(path))), true, path)
  }
  for (const name of ['WdButton', 'AppPage', 'Toast'])
    assert.equal(await resolver.resolve(name), undefined)
})
