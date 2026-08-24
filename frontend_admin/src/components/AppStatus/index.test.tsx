import { render, screen } from '@testing-library/react';
import { theme } from 'antd';
import { describe, expect, it } from 'vitest';
import {
  AppIcon,
  defineAppIconDefinitions,
  registerAppIconDefinitions,
} from '@/components/AppIcon';
import {
  APP_STATUS_DEFINITIONS,
  AppStatusTag,
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
    ['vacant', '收益中断'],
    ['listed', '正常经营'],
    ['rented', '经营健康'],
    ['renovating', '待跟进'],
    ['inactive', '已退出日常管理'],
  ] as const)('提供房源 %s 状态的管理说明', (state, description) => {
    expect(resolveAppStatusDefinition('house', state).description).toContain(
      description,
    );
  });

  it('用统一模块输出状态文字、图标和颜色', () => {
    render(
      <AppStatusTag data-testid="rented-status" name="house" state="rented">
        已出租
      </AppStatusTag>,
    );

    const tag = screen.getByTestId('rented-status');
    expect(tag).toHaveTextContent('已出租');
    expect(tag).toHaveClass('ant-tag-success');
    expect(tag).toHaveAttribute('title', '经营健康：房源已出租并处于有效占用');
    expect(tag).toHaveStyle({
      alignItems: 'center',
      display: 'inline-flex',
      whiteSpace: 'nowrap',
    });
    expect(tag.querySelector('svg')).toHaveAttribute(
      'data-app-status-state',
      'rented',
    );
    expect(tag.querySelector('svg')).toHaveStyle({
      color: theme.getDesignToken().colorTextLightSolid,
    });
    expect(tag.querySelector('svg')).toHaveAttribute('width', '16');
    expect(tag.querySelector('svg')).toHaveAttribute('height', '16');
  });

  it('将已停用房源弱化为不可操作状态', () => {
    render(
      <AppStatusTag data-testid="inactive-status" name="house" state="inactive">
        已停用
      </AppStatusTag>,
    );

    const tag = screen.getByTestId('inactive-status');
    const token = theme.getDesignToken();
    expect(tag).toHaveStyle({
      backgroundColor: token.colorFillTertiary,
      borderColor: token.colorBorder,
      color: token.colorTextDisabled,
    });
    expect(tag.querySelector('svg')).toHaveAttribute(
      'data-app-status-tone',
      'disabled',
    );
  });

  it('使用深色图标呈现已到期租约', () => {
    render(
      <AppStatusTag data-testid="expired-status" name="lease" state="expired">
        已到期
      </AppStatusTag>,
    );

    const icon = screen.getByTestId('expired-status').querySelector('svg');
    expect(icon).toHaveStyle({
      color: theme.getDesignToken().colorTextSecondary,
    });
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
