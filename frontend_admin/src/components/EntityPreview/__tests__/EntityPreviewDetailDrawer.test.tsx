import { fireEvent, render, screen } from '@testing-library/react';
import React, { lazy } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityPreviewDetailDrawer } from '../EntityPreviewDetailDrawer';
import { entityPreviewRegistry } from '../registry';

vi.mock('antd', () => ({
  Drawer: ({ children, onClose, open, title }: any) =>
    open ? (
      <section aria-label={title}>
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          关闭
        </button>
        {children}
      </section>
    ) : null,
  Skeleton: () => <div>加载中</div>,
}));

const Panel = ({
  id,
  variant,
}: {
  id: number;
  variant: 'popover' | 'drawer';
}) => (
  <div>
    {variant} 只读内容 {id}
  </div>
);

describe('EntityPreviewDetailDrawer', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/rental/customers?preview=7');
    entityPreviewRegistry.contact = {
      getHref: (id) => `/rental/customers?preview=${id}`,
      Panel: lazy(async () => ({ default: Panel })),
      popoverMedia: false,
      popoverWidth: 390,
    };
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('根据 preview 参数打开只读详情，并在关闭时只清理该参数', async () => {
    render(
      <EntityPreviewDetailDrawer
        searchParam="preview"
        title="联系人详情"
        type="contact"
      />,
    );

    expect(await screen.findByText('drawer 只读内容 7')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '保存' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(window.location.search).toBe('');
    expect(
      screen.queryByRole('region', { name: '联系人详情' }),
    ).not.toBeInTheDocument();
  });
});
