interface GeneratedPage {
  path?: string
}

interface GeneratedSubpackage {
  root?: string
}

interface GeneratedPagesConfig {
  pages?: GeneratedPage[]
  subPackages?: GeneratedSubpackage[]
  [key: string]: unknown
}

export interface PruneGeneratedPagesOptions {
  excludedPagePaths?: readonly string[]
  excludedSubpackageRoots?: readonly string[]
}

/**
 * 生产构建只保留当前产品页面。
 *
 * uni-pages 会为跨平台增量构建保留旧平台页面，但不会自动移除已经停用的整个分包。
 * pages.json 是生成文件，因此在插件写入后将它归一化为当前生产构建的精确清单。
 */
export function pruneGeneratedPagesJson(source: string, options: PruneGeneratedPagesOptions): string {
  const config = JSON.parse(source.replace(/^\s*\/\/.*(?:\r?\n|$)/gm, '')) as GeneratedPagesConfig
  const excludedPagePaths = new Set(options.excludedPagePaths)
  const excludedSubpackageRoots = new Set(options.excludedSubpackageRoots)

  if (config.pages)
    config.pages = config.pages.filter(page => !page.path || !excludedPagePaths.has(page.path))

  if (config.subPackages)
    config.subPackages = config.subPackages.filter(subpackage => !subpackage.root || !excludedSubpackageRoots.has(subpackage.root))

  return `${JSON.stringify(config, null, 2)}\n`
}
