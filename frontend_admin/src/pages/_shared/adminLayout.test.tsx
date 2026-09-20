import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ResponsiveActions } from './adminLayout';

describe('ResponsiveActions', () => {
  it('将没有 href 的点击链接转换为可键盘操作的按钮', () => {
    const onClick = vi.fn();

    render(
      <ResponsiveActions>
        <a onClick={onClick}>详情</a>
      </ResponsiveActions>,
    );

    const action = screen.getByRole('button', { name: '详情' });
    fireEvent.click(action);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: '详情' })).not.toBeInTheDocument();
  });

  it('保留真正带 href 的跳转链接', () => {
    render(
      <ResponsiveActions>
        <a href="/orders">购买记录</a>
      </ResponsiveActions>,
    );

    expect(screen.getByRole('link', { name: '购买记录' })).toHaveAttribute(
      'href',
      '/orders',
    );
  });

  it('同样转换条件渲染片段中的点击链接', () => {
    render(
      <ResponsiveActions>
        <React.Fragment key="conditional-actions">
          <a onClick={vi.fn()}>接受</a>
          <a onClick={vi.fn()}>拒绝</a>
        </React.Fragment>
      </ResponsiveActions>,
    );

    expect(screen.getByRole('button', { name: '接受' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拒绝' })).toBeInTheDocument();
  });
});
