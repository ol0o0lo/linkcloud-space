export interface WaterfallEntry<T> {
  item: T
  index: number
  weight: number
}

export interface WaterfallColumn<T> {
  items: WaterfallEntry<T>[]
  weight: number
}

function normalizeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 1
}

export function distributeWaterfallItems<T>(items: T[], columnCount = 2, itemWeight: (item: T, index: number) => number = () => 1): WaterfallColumn<T>[] {
  const safeColumnCount = Math.max(1, Math.floor(columnCount) || 1)
  const columns = Array.from({ length: safeColumnCount }, () => ({ items: [] as WaterfallEntry<T>[], weight: 0 }))

  items.forEach((item, index) => {
    const weight = normalizeWeight(itemWeight(item, index))
    const target = columns.reduce((shortest, column) => column.weight < shortest.weight ? column : shortest, columns[0])
    target.items.push({ item, index, weight })
    target.weight += weight
  })

  return columns
}
