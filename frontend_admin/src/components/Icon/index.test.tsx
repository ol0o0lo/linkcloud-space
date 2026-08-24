import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './index';

describe('Icon', () => {
  it('通过静态名称渲染构建期生成的离线图标', () => {
    render(
      <Icon data-testid="offline-icon" icon="solar:city-outline" width={24} />,
    );

    const icon = screen.getByTestId('offline-icon');
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.innerHTML).not.toBe('');
    expect(icon).toHaveAttribute('width', '24');
  });
});
