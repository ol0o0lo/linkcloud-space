export function getLeaseContractFile(file: Record<string, unknown>) {
  const url = typeof file.url === 'string' ? file.url : ''
  const name = String(file.original_filename || file.name || '租约合同')
  const extension = name.split('.').pop()?.toLowerCase() || ''
  return { url, name, extension }
}
