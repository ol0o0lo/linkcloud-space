export interface PollingTimer {
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  cancel: (timer: ReturnType<typeof setTimeout>) => void
}

/** 请求完成后再计时；停止或重新开始时，旧任务不能复活旧定时器。 */
export function createSerialPoller(task: () => Promise<void>, interval: number, clock: PollingTimer = { schedule: (callback, delay) => setTimeout(callback, delay), cancel: timer => clearTimeout(timer) }) {
  let active = false
  let revision = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let requested = false
  let failures = 0

  function clearTimer() {
    if (timer !== undefined)
      clock.cancel(timer)
    timer = undefined
  }

  async function refresh() {
    clearTimer()
    if (running) {
      requested = true
      return running
    }
    const snapshot = revision
    running = (async () => {
      try {
        await task()
        if (snapshot === revision)
          failures = 0
      }
      catch {
        if (snapshot === revision)
          failures += 1
      }
      finally {
        running = undefined
        if (active) {
          const delay = requested || snapshot !== revision ? 0 : failures ? Math.min(3000 * 2 ** (failures - 1), 30000) : interval
          requested = false
          timer = clock.schedule(() => void refresh(), delay)
        }
      }
    })()
    return running
  }

  function start() {
    if (active)
      return
    active = true
    revision += 1
    failures = 0
    void refresh()
  }

  function stop() {
    active = false
    revision += 1
    requested = false
    clearTimer()
  }

  return { start, stop, refresh }
}

let foreground = true
const foregroundListeners = new Set<(value: boolean) => void>()

export function setMessagingForeground(value: boolean) {
  foreground = value
  foregroundListeners.forEach(listener => listener(value))
}

export function observeMessagingForeground(listener: (value: boolean) => void): () => void {
  foregroundListeners.add(listener)
  listener(foreground)
  return () => foregroundListeners.delete(listener)
}
