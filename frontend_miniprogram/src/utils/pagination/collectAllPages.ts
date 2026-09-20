export interface PageRequest {
  page: number
  pageSize: number
}

export interface PageResult<T> {
  items: T[]
  total: number
}

export interface CollectAllPagesOptions<T, TKey> {
  getKey?: (item: T) => TKey
  pageSize?: number
}

export async function collectAllPages<T, TKey = T>(
  loadPage: (request: PageRequest) => Promise<PageResult<T>>,
  options: CollectAllPagesOptions<T, TKey> = {},
): Promise<T[]> {
  const pageSize = options.pageSize || 100
  const items: T[] = []
  const seen = new Set<TKey>()
  let fetchedCount = 0
  let page = 1

  while (true) {
    const result = await loadPage({ page, pageSize })
    fetchedCount += result.items.length
    for (const item of result.items) {
      if (options.getKey) {
        const key = options.getKey(item)
        if (seen.has(key))
          continue
        seen.add(key)
      }
      items.push(item)
    }
    if (result.items.length === 0 || fetchedCount >= result.total)
      return items
    page += 1
  }
}
