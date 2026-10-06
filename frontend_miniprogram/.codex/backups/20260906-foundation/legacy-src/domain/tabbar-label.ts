export function resolveTabbarLabel(label: string, translate: (key: string) => string): string {
  const match = label.match(/^%(.+)%$/)
  return match ? translate(match[1]) : label
}
