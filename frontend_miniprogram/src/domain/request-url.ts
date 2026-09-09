export function prependRequestUrlPrefix(url: string, prefix: string): string {
  if (!prefix || url.startsWith('http'))
    return url

  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const normalizedPath = url.startsWith('/') ? url : `/${url}`

  if (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`))
    return normalizedPath

  return `${normalizedPrefix}${normalizedPath}`
}
