export interface MenuButtonRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CustomNavigationLayoutInput {
  windowWidth: number
  statusBarHeight?: number
  menuButton?: MenuButtonRect
}

export interface CustomNavigationLayout {
  topInset: number
  rightInset: number
  height: number
}

export type NavigationScrollMode = 'flow' | 'sticky' | 'adaptive' | 'fade'
export type NavigationContentOpacityMode = 'manual' | 'always' | 'fade-out' | 'fade-in'

const DEFAULT_NAVIGATION_HEIGHT = 44
const NAVIGATION_BOTTOM_GAP = 8
const NAVIGATION_SIDE_GAP = 12
const DEFAULT_PAGE_GUTTER = 24

export const DEFAULT_NAVIGATION_SCROLL_THRESHOLD = 8
export const DEFAULT_NAVIGATION_FADE_DISTANCE = 64

export function resolveCustomNavigationLayout(input: CustomNavigationLayoutInput): CustomNavigationLayout {
  const topInset = Math.max(0, input.statusBarHeight || 0)
  const menuButton = input.menuButton

  if (!menuButton || !input.windowWidth) {
    return {
      topInset,
      rightInset: DEFAULT_PAGE_GUTTER,
      height: topInset + DEFAULT_NAVIGATION_HEIGHT,
    }
  }

  return {
    topInset,
    rightInset: Math.max(DEFAULT_PAGE_GUTTER, input.windowWidth - menuButton.left + NAVIGATION_SIDE_GAP),
    height: Math.max(topInset + DEFAULT_NAVIGATION_HEIGHT, menuButton.top + menuButton.height + NAVIGATION_BOTTOM_GAP),
  }
}

export function isNavigationScrolled(scrollTop: number, threshold = DEFAULT_NAVIGATION_SCROLL_THRESHOLD): boolean {
  return scrollTop >= threshold
}

export function getNavigationFadeOpacity(scrollTop: number, fadeDistance = DEFAULT_NAVIGATION_FADE_DISTANCE): number {
  if (fadeDistance <= 0)
    return scrollTop > 0 ? 0 : 1
  const progress = Math.min(1, Math.max(scrollTop / fadeDistance, 0))
  return 1 - progress
}

export function resolveNavigationContentOpacity(mode: NavigationContentOpacityMode, scrollProgress: number, manualOpacity = 1): number {
  const progress = Math.min(1, Math.max(0, scrollProgress))
  const opacity = Math.min(1, Math.max(0, manualOpacity))

  if (mode === 'always')
    return 1
  if (mode === 'fade-out')
    return 1 - progress
  if (mode === 'fade-in')
    return progress
  return opacity
}
