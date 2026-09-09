export function createSingleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let currentTask: Promise<T> | null = null

  return function run() {
    if (currentTask)
      return currentTask
    currentTask = task().finally(() => {
      currentTask = null
    })
    return currentTask
  }
}
