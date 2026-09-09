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

const DEFAULT_NAVIGATION_HEIGHT = 44
const NAVIGATION_BOTTOM_GAP = 8
const NAVIGATION_SIDE_GAP = 12
const DEFAULT_PAGE_GUTTER = 24

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
