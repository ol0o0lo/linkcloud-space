import uniHelper from '@uni-helper/eslint-config'

export default uniHelper({
  unocss: true,
  vue: true,
  markdown: false,
  ignores: [
    // 忽略uni_modules目录
    '**/uni_modules/',
    // 本地可恢复备份不参与工程检查
    '.codex/backups/**',
    // 浏览器与视觉验收产物不参与源码检查
    '.codex/audits/**',
    'dist',
    // unplugin-auto-import 生成的类型文件，每次提交都改变，所以加入这里吧，与 .gitignore 配合使用
    'auto-import.d.ts',
    // vite-plugin-uni-pages 生成的类型文件，每次切换分支都一堆不同的，所以直接 .gitignore
    'uni-pages.d.ts',
    // 插件生成的文件
    'src/pages.json',
    'src/manifest.json',
    // OpenAPI 生成目录由生成器负责格式与类型
    'src/services/openapi/**',
  ],
  // https://eslint-config.antfu.me/rules
  rules: {
    'no-useless-return': 'off',
    'no-console': 'off',
    'no-unused-vars': 'off',
    'vue/no-unused-refs': 'off',
    'unused-imports/no-unused-vars': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
    'jsdoc/check-param-names': 'off',
    'jsdoc/require-returns-description': 'off',
    'ts/no-empty-object-type': 'off',
    'no-extend-native': 'off',
    // uni 条件编译注释可能包裹 import，自动排序会破坏平台条件边界
    'perfectionist/sort-imports': 'off',
    // 领域逻辑测试使用 Node 内置 runner，避免仅为轻量单测引入额外运行时
    'test/no-import-node-test': 'off',
    'vue/singleline-html-element-content-newline': [
      'error',
      {
        externalIgnores: ['text'],
      },
    ],
    // vue SFC 调换顺序改这里
    'vue/block-order': ['error', {
      order: [['script', 'template'], 'style'],
    }],
  },
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks in Vue
     * By default uses Prettier
     */
    css: true,
    /**
     * Format HTML files
     * By default uses Prettier
     */
    html: true,
  },
}, {
  files: [
    'src/pages/**/*.{ts,vue}',
    'src/pages-*/**/*.{ts,vue}',
    'src/features/**/*.{ts,vue}',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/services/openapi', '@/services/openapi/**'],
        message: '页面和 feature 必须通过手写 service 访问 OpenAPI，不能直接依赖生成目录。',
      }],
    }],
    'no-restricted-syntax': ['error', {
      selector: 'CallExpression[callee.object.name=\'uni\'][callee.property.name=\'request\']',
      message: '页面和 feature 必须通过统一 HTTP 客户端发起请求。',
    }, {
      selector: 'CallExpression[callee.object.name=\'uni\'][callee.property.name=\'uploadFile\']',
      message: '页面和 feature 必须通过统一上传模块上传文件。',
    }, {
      selector: 'CallExpression[callee.object.name=\'uni\'][callee.property.name=\'login\']',
      message: '页面和 feature 必须通过平台认证适配器登录。',
    }],
  },
})
