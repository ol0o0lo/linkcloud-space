import { fireEvent, render, screen } from '@testing-library/react';
import { ConfigProvider, theme } from 'antd';
import type { ComponentRef } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AIButton from './index';

describe('AIButton', () => {
  it('复用 AI 图标并保留按钮文案、事件和 ref', () => {
    const onClick = vi.fn();
    const ref = createRef<ComponentRef<typeof AIButton>>();
    render(
      <AIButton className="custom-ai-action" ref={ref} onClick={onClick}>
        重新生成
      </AIButton>,
    );

    const button = screen.getByRole('button', { name: '重新生成' });
    expect(button).toHaveClass('custom-ai-action');
    expect(
      button.querySelector('svg[data-app-icon-name="ai"]'),
    ).toHaveAttribute('aria-hidden', 'true');
    expect(ref.current).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('生成中阻止重复操作，完成后恢复', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <AIButton loading onClick={onClick}>
        重新生成
      </AIButton>,
    );
    const button = screen.getByRole('button', { name: /重新生成/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <AIButton loading={false} onClick={onClick}>
        重新生成
      </AIButton>,
    );
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(
      button.querySelector('svg[data-app-icon-name="ai"]'),
    ).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.each([
    theme.defaultAlgorithm,
    theme.darkAlgorithm,
  ])('主题切换后保留禁用状态', (algorithm) => {
    const onClick = vi.fn();
    render(
      <ConfigProvider theme={{ algorithm }} componentDisabled>
        <AIButton onClick={onClick}>生成速览</AIButton>
      </ConfigProvider>,
    );
    const button = screen.getByRole('button', { name: '生成速览' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
