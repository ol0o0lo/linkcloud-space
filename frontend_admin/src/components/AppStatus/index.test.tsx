import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AppIcon,
  defineAppIconDefinitions,
  registerAppIconDefinitions,
} from '@/components/AppIcon';
import {
  APP_STATUS_DEFINITIONS,
  type CoreAppStatusName,
  defineAppStatusDefinitions,
  registerAppStatusDefinitions,
  resolveAppStatusDefinition,
} from './index';

describe('AppStatus', () => {
  it.each(
    Object.entries(APP_STATUS_DEFINITIONS).flatMap(([name, definition]) =>
      Object.keys(definition.states).map((state) => [name, state] as const),
    ) as ReadonlyArray<readonly [CoreAppStatusName, string]>,
  )('渲染 %s.%s 状态图标', (name, state) => {
    render(
      <AppIcon
        data-testid={`status-icon-${name}-${state}`}
        name={name}
        state={state}
      />,
    );

    const icon = screen.getByTestId(`status-icon-${name}-${state}`);
    expect(icon.innerHTML).not.toBe('');
    expect(icon).toHaveAttribute('data-app-status-name', name);
    expect(icon).toHaveAttribute('data-app-status-state', state);
  });

  it.each([
    ['vacant', 'error'],
    ['listed', 'info'],
    ['rented', 'success'],
    ['renovating', 'warning'],
    ['inactive', 'disabled'],
  ] as const)('使用符合经营含义的房源 %s 状态色', (state, tone) => {
    expect(resolveAppStatusDefinition('house', state).tone).toBe(tone);
  });

  it.each([
    ['vacant', '当前为空置状态'],
    ['listed', '当前正在对外招租'],
    ['rented', '当前已有生效租约'],
    ['renovating', '当前处于装修状态'],
    ['inactive', '当前已停用'],
  ] as const)('提供房源 %s 状态的管理说明', (state, description) => {
    expect(resolveAppStatusDefinition('house', state).description).toContain(
      description,
    );
  });

  it('允许插件分别注册图标与状态', () => {
    const unregisterIcons = registerAppIconDefinitions(
      'inspection-plugin',
      defineAppIconDefinitions({
        'inspection.order': { icon: 'solar:document-text-outline' },
        'inspection.order.completed': { icon: 'solar:key-outline' },
      }),
    );
    const unregisterStatuses = registerAppStatusDefinitions(
      'inspection-plugin',
      defineAppStatusDefinitions({
        'inspection.order': {
          states: {
            completed: {
              icon: 'inspection.order.completed',
              tone: 'success',
            },
          },
        },
      }),
    );

    expect(
      resolveAppStatusDefinition('inspection.order', 'completed'),
    ).toMatchObject({
      icon: 'inspection.order.completed',
      matched: true,
      source: 'inspection-plugin',
      tone: 'success',
    });

    unregisterStatuses();
    unregisterIcons();
    expect(
      resolveAppStatusDefinition('inspection.order', 'completed').matched,
    ).toBe(false);
  });
});
