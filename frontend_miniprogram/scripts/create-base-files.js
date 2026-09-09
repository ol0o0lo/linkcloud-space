// pages.json 与 manifest.json 是配置插件生成的构建产物。
// 每次构建前重置为最小结构，避免已经移除的页面或平台残留在合并结果中。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const manifest = {}
const pages = {
  pages: [
    {
      path: 'pages/index/index',
      type: 'home',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '首页',
      },
    },
    {
      path: 'pages/me/me',
      type: 'page',
      style: {
        navigationBarTitleText: '我的',
      },
    },
  ],
  subPackages: [],
}

const manifestPath = path.resolve(__dirname, '../src/manifest.json')
const pagesPath = path.resolve(__dirname, '../src/pages.json')

const srcDir = path.resolve(__dirname, '../src')
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true })
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
fs.writeFileSync(pagesPath, JSON.stringify(pages, null, 2))
