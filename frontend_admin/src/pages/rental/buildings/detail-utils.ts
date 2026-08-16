export function safeMapReturnTo(value: string | null) {
  return value?.startsWith('/dashboard/rental/properties/map') ? value : '/dashboard/rental/properties/map';
}
