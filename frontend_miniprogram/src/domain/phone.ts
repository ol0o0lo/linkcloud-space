export function formatPhoneDisplay(phone?: string | null): string {
  return (phone || '').trim().replace(/^\+86\s*/, '')
}
