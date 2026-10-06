import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  DEFAULT_NAVIGATION_FADE_DISTANCE,
  DEFAULT_NAVIGATION_SCROLL_THRESHOLD,
  getNavigationFadeOpacity,
  isNavigationScrolled,
  resolveCustomNavigationLayout,
  resolveNavigationContentOpacity,
} from '../src/components/utils/navigation.ts'

test('微信胶囊按钮为自定义导航栏预留右侧空间', () => {
  assert.deepEqual(resolveCustomNavigationLayout({
    windowWidth: 390,
    statusBarHeight: 47,
    menuButton: { left: 278, top: 54, width: 87, height: 32 },
  }), {
    height: 94,
    rightInset: 124,
    topInset: 47,
  })
})

test('没有胶囊按钮信息时使用安全的默认导航高度', () => {
  assert.deepEqual(resolveCustomNavigationLayout({
    windowWidth: 390,
    statusBarHeight: 24,
  }), {
    height: 68,
    rightInset: 24,
    topInset: 24,
  })
})

test('导航栏滚动状态统一使用 8px 阈值和 64px 渐隐距离', () => {
  assert.equal(DEFAULT_NAVIGATION_SCROLL_THRESHOLD, 8)
  assert.equal(isNavigationScrolled(0), false)
  assert.equal(isNavigationScrolled(7.99), false)
  assert.equal(isNavigationScrolled(8), true)
  assert.equal(isNavigationScrolled(20), true)
  assert.equal(isNavigationScrolled(20, 24), false)

  assert.equal(DEFAULT_NAVIGATION_FADE_DISTANCE, 64)
  assert.equal(getNavigationFadeOpacity(-10), 1)
  assert.equal(getNavigationFadeOpacity(0), 1)
  assert.equal(getNavigationFadeOpacity(16), 0.75)
  assert.equal(getNavigationFadeOpacity(32), 0.5)
  assert.equal(getNavigationFadeOpacity(64), 0)
  assert.equal(getNavigationFadeOpacity(100), 0)
  assert.equal(getNavigationFadeOpacity(50, 100), 0.5)
})

test('导航栏内容透明度支持手动、常显、滚动淡出和滚动淡入', () => {
  assert.equal(resolveNavigationContentOpacity('manual', 0.5, 0.35), 0.35)
  assert.equal(resolveNavigationContentOpacity('always', 0.5, 0.35), 1)
  assert.equal(resolveNavigationContentOpacity('fade-out', 0.25), 0.75)
  assert.equal(resolveNavigationContentOpacity('fade-in', 0.25), 0.25)
  assert.equal(resolveNavigationContentOpacity('fade-in', 2), 1)
  assert.equal(resolveNavigationContentOpacity('manual', 0, -1), 0)
})

test('自定义导航栏支持流式、吸顶、自适应和滚动淡出模式', () => {
  const source = readFileSync(new URL('../src/components/app/AppCustomNavigation.vue', import.meta.url), 'utf8')
  const navigationSource = readFileSync(new URL('../src/components/utils/navigation.ts', import.meta.url), 'utf8')
  const composableSource = readFileSync(new URL('../src/hooks/useNavigationScrollState.ts', import.meta.url), 'utf8')

  assert.match(navigationSource, /'flow' \| 'sticky' \| 'adaptive' \| 'fade'/)
  assert.match(source, /app-custom-navigation--scrolled/)
  assert.match(source, /app-custom-navigation--transparent/)
  assert.match(source, /app-custom-navigation--fade/)
  assert.match(source, /immersive\?: boolean/)
  assert.match(source, /app-custom-navigation--immersive/)
  assert.match(source, /app-custom-navigation--immersive[\s\S]*position:\s*fixed;/)
  assert.match(source, /app-custom-navigation--immersive \.app-custom-navigation__back[\s\S]*color:\s*#fff;/)
  assert.match(source, /contentOpacity/)
  assert.match(source, /contentOpacityMode/)
  assert.match(source, /scrolledContentOpacity/)
  assert.match(source, /scrolledContentOpacityMode/)
  assert.match(source, /scrollProgress/)
  assert.match(source, /resolveNavigationContentOpacity/)
  assert.match(source, /scrolledBackground/)
  assert.match(source, /scrolledBackground:\s*'var\(--app-navigation-fade-background\)'/)
  assert.match(source, /navigationContentStyle/)
  assert.match(source, /--app-navigation-scrolled-background/)
  assert.match(source, /:style="navigationContentStyle"/)
  assert.match(source, /pointer-events:\s*none;/)
  assert.match(source, /<slot name="icon">/)
  assert.match(source, /<slot name="scrolled-content"/)
  assert.match(source, /position: sticky;/)
  assert.match(source, /app-custom-navigation__content--center[\s\S]*right:\s*var\(--app-navigation-right-inset\);[\s\S]*left:\s*var\(--app-navigation-right-inset\);/)
  assert.match(source, /app-custom-navigation__fade-background/)
  assert.match(source, /--app-navigation-background/)
  assert.match(source, /#ifdef MP-WEIXIN[\s\S]*defineOptions\(\{[\s\S]*virtualHost:\s*true/)
  assert.match(composableSource, /function handleNavigationScroll/)
  assert.doesNotMatch(composableSource, /onPageScroll\(/)
  assert.match(composableSource, /isNavigationScrolled/)
  assert.match(composableSource, /navigationProgress/)
})

test('fade 导航背景由滚动进度渐变而不是由 scrolled 类直接切换', () => {
  const source = readFileSync(new URL('../src/components/app/AppCustomNavigation.vue', import.meta.url), 'utf8')
  const tokenSource = readFileSync(new URL('../src/style/theme/tokens.scss', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /app-custom-navigation--fade\.app-custom-navigation--scrolled\s*\{[\s\S]*?background:/)
  assert.match(source, /app-custom-navigation__fade-background/)
  assert.match(source, /:style="navigationBackgroundStyle"/)
  assert.match(source, /opacity:\s*String\(normalizedScrollProgress\.value\)/)
  assert.match(source, /background:\s*var\(--app-navigation-scrolled-background\);/)
  assert.match(source, /-webkit-backdrop-filter:\s*var\(--app-navigation-backdrop-filter\);/)
  assert.match(source, /backdrop-filter:\s*var\(--app-navigation-backdrop-filter\);/)
  assert.match(source, /app-custom-navigation__fade-tail/)
  assert.match(source, /height:\s*24rpx;/)
  assert.match(source, /linear-gradient\([\s\S]*var\(--app-navigation-scrolled-background\)[\s\S]*transparent 100%/)
  assert.match(tokenSource, /--app-navigation-fade-background:\s*rgb\(245 248 252 \/ 80%\);/)
  assert.match(tokenSource, /--app-navigation-backdrop-filter:\s*blur\(12rpx\) saturate\(1\.08\);/)
  assert.match(tokenSource, /app-provider--visual-effects-reduced[\s\S]*--app-navigation-fade-background:\s*var\(--app-bg-page\);[\s\S]*--app-navigation-backdrop-filter:\s*none;/)
})

test('导航内容占满状态栏以下区域并垂直居中', () => {
  const source = readFileSync(new URL('../src/components/app/AppCustomNavigation.vue', import.meta.url), 'utf8')
  const contentRule = source.match(/\.app-custom-navigation__content\s*\{([^}]*)\}/)?.[1] || ''

  assert.match(contentRule, /top:\s*var\(--app-navigation-top-inset\);/)
  assert.match(contentRule, /bottom:\s*0;/)
  assert.doesNotMatch(contentRule, /bottom:\s*8px;/)
})

test('房源详情导航标题同样相对屏幕居中', () => {
  const source = readFileSync(new URL('../src/components/house/HouseDetailNavigation.vue', import.meta.url), 'utf8')
  const pageSource = readFileSync(new URL('../src/components/house/HouseDetailPage.vue', import.meta.url), 'utf8')
  const publicDetailSource = readFileSync(new URL('../src/pages-housing/detail/index.vue', import.meta.url), 'utf8')
  const organizationDetailSource = readFileSync(new URL('../src/pages-org-rental/houses/detail.vue', import.meta.url), 'utf8')
  const backRule = source.match(/\.house-detail-navigation__back\s*\{([^}]*)\}/)?.[1] || ''
  const titleRule = source.match(/\.house-detail-navigation__title\s*\{([^}]*)\}/)?.[1] || ''

  assert.match(source, /house-detail-navigation__title[\s\S]*right:\s*var\(--house-detail-navigation-right-inset\);[\s\S]*left:\s*var\(--house-detail-navigation-right-inset\);/)
  assert.match(source, /house-detail-navigation__back[\s\S]*position:\s*absolute;/)
  assert.match(source, /--house-detail-navigation-control-top/)
  assert.match(backRule, /top:\s*var\(--house-detail-navigation-control-top\);/)
  assert.doesNotMatch(backRule, /bottom:\s*8px;/)
  assert.match(titleRule, /top:\s*var\(--house-detail-navigation-top-inset\);/)
  assert.match(titleRule, /bottom:\s*0;/)
  assert.doesNotMatch(titleRule, /bottom:\s*8px;/)
  assert.match(source, /#ifdef MP-WEIXIN[\s\S]*defineOptions\(\{[\s\S]*virtualHost:\s*true/)
  assert.match(source, /class="house-detail-navigation__badge"/)
  assert.doesNotMatch(source, /house-detail-navigation__title\s*>\s*text/)
  assert.match(source, /scrollProgress\?: number/)
  assert.match(source, /effectiveScrollProgress/)
  assert.match(source, /house-detail-navigation__hero-background/)
  assert.match(source, /house-detail-navigation__scrolled-background/)
  assert.doesNotMatch(source, /house-detail-navigation--scrolled\s*\{[\s\S]*?background:\s*#fff/)
  assert.match(pageSource, /scrollProgress\?: number/)
  assert.match(pageSource, /:scroll-progress="error \? 1 : scrollProgress"/)

  for (const detailSource of [publicDetailSource, organizationDetailSource]) {
    assert.match(detailSource, /useNavigationScrollState/)
    assert.match(detailSource, /useNavigationScrollState\(\{ threshold: 190, fadeDistance: 190 \}\)/)
    assert.match(detailSource, /onPageScroll\(handleNavigationScroll\)/)
    assert.match(detailSource, /:scroll-progress="navigationProgress"/)
  }
})

test('所有主 Tab 在页面作用域监听滚动，我的页在左上角显示身份切换', () => {
  const sources = [
    '../src/pages/index/index.vue',
    '../src/pages/houses/index.vue',
    '../src/pages/favorites/index.vue',
    '../src/pages/messages/index.vue',
    '../src/pages/me/me.vue',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))

  const [homeSource, housesSource, favoritesSource, messagesSource, meSource] = sources

  for (const source of [homeSource, favoritesSource, messagesSource, meSource]) {
    assert.match(source, /<AppCustomNavigation[\s\S]{0,260}title=""/)
    assert.doesNotMatch(source, /<AppCustomNavigation[^>]*:title="tabbarTitle"/)
  }
  assert.match(housesSource, /:title="currentMode === 'organization' \? '工作台' : ''"/)

  for (const source of [favoritesSource, messagesSource]) {
    assert.match(source, /useNavigationScrollState/)
    assert.match(source, /const \{ navigationScrolled, navigationProgress, handleNavigationScroll \} = useNavigationScrollState\(\)/)
    assert.match(source, /onPageScroll\(handleNavigationScroll\)/)
    assert.match(source, /scroll-mode="fade"/)
    assert.match(source, /:scrolled="navigationScrolled"/)
    assert.match(source, /content-opacity-mode="fade-in"/)
    assert.match(source, /:scroll-progress="navigationProgress"/)
  }

  assert.match(meSource, /useNavigationScrollState/)
  assert.match(meSource, /const \{ navigationScrolled, navigationProgress, handleNavigationScroll \} = useNavigationScrollState\(\)/)
  assert.match(meSource, /onPageScroll\(handleNavigationScroll\)/)
  assert.match(meSource, /<AppCustomNavigation title="" align="start" scroll-mode="fade" :scrolled="navigationScrolled" :scroll-progress="navigationProgress">/)
  assert.match(meSource, /<template #content>[\s\S]*AppModeSwitcher[^>]*variant="navigation"/)
  assert.doesNotMatch(meSource, /content-opacity-mode="fade-in"/)

  assert.match(housesSource, /useNavigationScrollState/)
  assert.match(housesSource, /const \{ navigationScrolled, navigationProgress, navigationScrollTop: pageScrollTop, handleNavigationScroll \} = useNavigationScrollState\(\)/)
  assert.match(housesSource, /navigationSearchThreshold = Math\.round\(144 \* navigationRpxScale\)/)
  assert.match(housesSource, /navigationContentFadeDistance = Math\.round\(288 \* navigationRpxScale\)/)
  assert.match(housesSource, /pageScrollTop\.value \/ navigationContentFadeDistance/)
  assert.match(housesSource, /function handlePageScroll[\s\S]*handleNavigationScroll\(event\)/)
  assert.match(housesSource, /onPageScroll\(handlePageScroll\)/)
  assert.match(housesSource, /scroll-mode="fade"/)
  assert.match(housesSource, /:scrolled="isPublicHouseMode \? navigationSearchVisible : navigationScrolled"/)
  assert.match(housesSource, /:content-opacity-mode="isPublicHouseMode \? 'fade-out' : 'manual'"/)
  assert.match(housesSource, /scrolled-content-opacity-mode="fade-in"/)
  assert.match(housesSource, /scrolled-align="start"/)
  assert.match(housesSource, /:scroll-progress="navigationContentProgress"/)
  assert.doesNotMatch(housesSource, /scrolled-background=/)
  assert.match(housesSource, /<template #content>[\s\S]*PublicHouseRegionTrigger/)
  assert.doesNotMatch(housesSource, /navigation-title/)
  assert.match(housesSource, /<template v-if="isPublicHouseMode" #scrolled-content>[\s\S]*navigation-search-bar/)

  assert.match(homeSource, /useNavigationScrollState/)
  assert.match(homeSource, /const \{ navigationScrolled, navigationProgress, handleNavigationScroll \} = useNavigationScrollState\(\)/)
  assert.match(homeSource, /onPageScroll\(handleNavigationScroll\)/)
  assert.match(homeSource, /<AppCustomNavigation title="" align="start" scroll-mode="fade" :scrolled="navigationScrolled" :scroll-progress="navigationProgress">/)
  assert.match(homeSource, /<template #content>[\s\S]*PublicHouseRegionTrigger[\s\S]*home-navigation__search/)
  assert.doesNotMatch(homeSource, /home-navigation__map/)
  assert.doesNotMatch(homeSource, /title="链云空间"/)
  assert.doesNotMatch(homeSource, /:align="navigationAlign"/)
})
