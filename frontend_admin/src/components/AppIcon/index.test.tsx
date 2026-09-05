import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  APP_ICON_DEFINITIONS,
  AppIcon,
  type CoreAppIconName,
  defineAppIconDefinitions,
  registerAppIconDefinitions,
  resolveAppIconDefinition,
} from './index';

describe('AppIcon', () => {
  it.each(
    Object.keys(APP_ICON_DEFINITIONS) as CoreAppIconName[],
  )('从离线子集渲染 %s 业务图标', (name) => {
    render(<AppIcon data-testid={`app-icon-${name}`} name={name} />);

    const icon = screen.getByTestId(`app-icon-${name}`);
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.innerHTML).not.toBe('');
  });

  it.each([
    ['vacant', 'tabler:home-exclamation'],
    ['listed', 'tabler:home-dollar'],
    ['rented', 'tabler:home-check'],
    ['renovating', 'tabler:home-cog'],
    ['inactive', 'tabler:home-off'],
  ] as const)('使用 Tabler 房屋图标表示 %s 房态', (state, iconName) => {
    const name = `house.${state}`;
    render(<AppIcon data-testid={name} name={name} />);

    expect(screen.getByTestId(name)).toHaveAttribute(
      'data-app-icon-name',
      name,
    );
    expect(resolveAppIconDefinition(name).icon).toBe(iconName);
  });

  it('允许插件注册自己的语义图标', () => {
    const pluginDefinitions = defineAppIconDefinitions({
      'inspection.order': {
        icon: 'solar:document-text-outline',
      },
      'inspection.order.completed': { icon: 'solar:key-outline' },
    });
    const unregister = registerAppIconDefinitions(
      'inspection-plugin',
      pluginDefinitions,
    );

    expect(
      resolveAppIconDefinition('inspection.order.completed'),
    ).toMatchObject({
      icon: 'solar:key-outline',
      matched: true,
      source: 'inspection-plugin',
    });

    unregister();
    expect(resolveAppIconDefinition('inspection.order').matched).toBe(false);
  });
});
