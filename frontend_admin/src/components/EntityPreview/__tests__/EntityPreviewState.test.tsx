import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityPreviewError } from '../EntityPreviewState';

describe('EntityPreviewState', () => {
  it('403 显示权限提示', () => {
    render(
      <EntityPreviewError
        error={{ response: { status: 403 } }}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('暂无权限查看详情')).toBeInTheDocument();
  });

  it('404 显示记录不存在提示', () => {
    render(<EntityPreviewError error={{ status: 404 }} onRetry={vi.fn()} />);

    expect(screen.getByText('该记录已不存在')).toBeInTheDocument();
  });

  it('通用错误允许重新加载', () => {
    const onRetry = vi.fn();
    render(
      <EntityPreviewError error={new Error('network')} onRetry={onRetry} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
