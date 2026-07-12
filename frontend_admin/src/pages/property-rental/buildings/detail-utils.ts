export function safeMapReturnTo(value: string | null) {
  return value?.startsWith('/dashboard/property-rental/map') ? value : '/dashboard/property-rental/map';
}
