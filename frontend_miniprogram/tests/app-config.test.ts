import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAppConfig } from '../src/core/config/app-config.ts'

test('H5 生产环境显式支持同源 API 模式', () => {
  const config = parseAppConfig({
    platform: 'h5',
    buildMode: 'production',
    env: {
      VITE_APP_TITLE: '链云空间',
      VITE_API_MODE: 'same-origin',
      VITE_API_BASE_URL: '/api',
    },
  })

  assert.equal(config.appTitle, '链云空间')
  assert.equal(config.api.mode, 'same-origin')
  assert.equal(config.api.baseUrl, '/api')
})

test('微信生产环境要求绝对 HTTPS API 地址', () => {
  const config = parseAppConfig({
    platform: 'mp-weixin',
    buildMode: 'production',
    env: {
      VITE_APP_TITLE: '链云空间',
      VITE_API_MODE: 'absolute',
      VITE_API_BASE_URL__WEIXIN_RELEASE: 'https://api.example.com/',
    },
    weixinEnvVersion: 'release',
  })

  assert.equal(config.api.baseUrl, 'https://api.example.com')
  assert.throws(() => parseAppConfig({
    platform: 'mp-weixin',
    buildMode: 'production',
    env: {
      VITE_APP_TITLE: '链云空间',
      VITE_API_MODE: 'same-origin',
      VITE_API_BASE_URL: '/api',
    },
    weixinEnvVersion: 'release',
  }), /微信小程序生产环境必须配置绝对 HTTPS API 地址/)
})

test('微信本地开发允许 HTTP 地址但仍拒绝空配置', () => {
  assert.equal(parseAppConfig({
    platform: 'mp-weixin',
    buildMode: 'development',
    env: {
      VITE_APP_TITLE: '链云空间',
      VITE_API_MODE: 'absolute',
      VITE_API_BASE_URL__WEIXIN_DEVELOP: 'http://localhost:18000',
    },
    weixinEnvVersion: 'develop',
  }).api.baseUrl, 'http://localhost:18000')

  assert.throws(() => parseAppConfig({
    platform: 'mp-weixin',
    buildMode: 'development',
    env: {
      VITE_APP_TITLE: '链云空间',
      VITE_API_MODE: 'absolute',
    },
    weixinEnvVersion: 'develop',
  }), /API 地址未配置/)
})

test('同一份环境文件可以分别声明 H5 与微信地址模式', () => {
  const env = {
    VITE_APP_TITLE: '链云空间',
    VITE_API_MODE: 'same-origin',
    VITE_API_BASE_URL: '/api',
    VITE_API_MODE__WEIXIN: 'absolute',
    VITE_API_BASE_URL__WEIXIN_DEVELOP: 'http://localhost:18000',
  }

  assert.equal(parseAppConfig({ platform: 'h5', buildMode: 'development', env }).api.mode, 'same-origin')
  assert.equal(parseAppConfig({ platform: 'mp-weixin', buildMode: 'development', env, weixinEnvVersion: 'develop' }).api.mode, 'absolute')
})
