type UnreadSource = 'notifications' | 'messages'

/** 两类未读独立更新，身份变化同时作废旧请求。 */
export function createUnreadBadgeState() {
  let scope = ''
  const counts = { notifications: 0, messages: 0 }
  const revisions = { notifications: 0, messages: 0 }
  function setScope(key: string) {
    if (scope === key)
      return
    scope = key
    counts.notifications = 0
    counts.messages = 0
    revisions.notifications += 1
    revisions.messages += 1
  }
  function begin(source: UnreadSource) {
    return ++revisions[source]
  }
  function set(source: UnreadSource, count: number, revision = begin(source)) {
    if (revision !== revisions[source])
      return
    counts[source] = Math.max(0, count)
  }
  return {
    setScope,
    begin,
    set,
    isCurrent: (source: UnreadSource, revision: number) => revision === revisions[source],
    count: (source: UnreadSource) => counts[source],
    value: () => counts.notifications > 0 || counts.messages > 0 ? 'dot' as const : undefined,
  }
}
