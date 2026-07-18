import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EntityPreviewError,
  EntityPreviewSkeleton,
} from '../EntityPreviewState';

describe('EntityPreviewState', () => {
  it('图片实体的 Popover 骨架填满宿主宽度并固定媒体高度', () => {
    render(<EntityPreviewSkeleton variant="popover" withMedia />);

    const skeleton = screen.getByRole('status', { name: '正在加载预览' });
    expect(skeleton).toHaveStyle({ width: '100%' });
    expect(skeleton.lastElementChild).toHaveStyle({ padding: '12px' });
    expect(screen.getByTestId('entity-preview-skeleton-media')).toHaveStyle({
      flex: '0 0 124px',
      height: '124px',
    });
  });

  it('信息实体的 Popover 骨架不渲染媒体区', () => {
    render(<EntityPreviewSkeleton variant="popover" />);

    expect(screen.getByRole('status', { name: '正在加载预览' })).toHaveStyle({
      width: '100%',
    });
    expect(
      screen.queryByTestId('entity-preview-skeleton-media'),
    ).not.toBeInTheDocument();
  });

  it('Drawer 加载态保留原有 320px 普通骨架', () => {
    render(<EntityPreviewSkeleton variant="drawer" withMedia />);

    expect(screen.getByRole('status', { name: '正在加载预览' })).toHaveStyle({
      width: '320px',
    });
    expect(
      screen.queryByTestId('entity-preview-skeleton-media'),
    ).not.toBeInTheDocument();
  });

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
