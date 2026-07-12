import { act, fireEvent, render, screen } from '@testing-library/react';
import React, { lazy } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umijs/max', () => ({
  Link: ({
    children,
    className,
    onKeyDown,
    to,
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a className={className} href={to} onKeyDown={onKeyDown}>
      {children}
    </a>
  ),
}));

vi.mock('antd-style', () => ({
  createStyles: () => () => ({ styles: { link: 'entity-preview-link' } }),
}));

vi.mock('antd', () => ({
  Alert: ({ title }: { title: React.ReactNode }) => (
    <div role="alert">{title}</div>
  ),
  Button: ({
    children,
    onClick,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Skeleton: () => <div>正在加载</div>,
  Popover: ({
    children,
    content,
    mouseEnterDelay = 0,
    onOpenChange,
    open,
  }: any) => {
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    );
    return (
      <>
        {React.cloneElement(children, {
          onFocus: () => {
          timer.current = setTimeout(
            () => onOpenChange(true),
            mouseEnterDelay * 1000,
          );
          },
          onMouseEnter: () => {
          timer.current = setTimeout(
            () => onOpenChange(true),
            mouseEnterDelay * 1000,
          );
          },
          onMouseLeave: () => {
          clearTimeout(timer.current);
          onOpenChange(false);
          },
        })}
        {open ? <div data-testid="preview-panel">{content}</div> : null}
      </>
    );
  },
}));

import { EntityPreview } from '../EntityPreview';
import { entityPreviewRegistry } from '../registry';

const Panel = ({ id }: { id: number }) => <div>房源预览 {id}</div>;

function getPreviewTrigger() {
  const link = screen.getByRole('link');
  expect(link.parentElement?.tagName).toBe('SPAN');
  return link.parentElement as HTMLSpanElement;
}

describe('EntityPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    entityPreviewRegistry.house = {
      Panel: lazy(async () => ({ default: Panel })),
      getHref: (id) => `/property-rental/houses/${id}`,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const type of Object.keys(entityPreviewRegistry)) {
      delete entityPreviewRegistry[type as keyof typeof entityPreviewRegistry];
    }
  });

  it('id 为空时只显示普通文字', () => {
    render(
      <EntityPreview type="house" id={null}>
        无编号房源
      </EntityPreview>,
    );

    expect(screen.getByText('无编号房源')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preview-panel')).not.toBeInTheDocument();
  });

  it('使用注册定义生成链接', () => {
    render(
      <EntityPreview type="house" id={42}>
        春风里 2 号
      </EntityPreview>,
    );

    expect(screen.getByRole('link', { name: '春风里 2 号' })).toHaveAttribute(
      'href',
      '/property-rental/houses/42',
    );
  });

  it('悬停约 200ms 后才挂载 Panel 并传入 id', async () => {
    render(
      <EntityPreview type="house" id={42}>
        春风里 2 号
      </EntityPreview>,
    );

    fireEvent.mouseEnter(getPreviewTrigger());
    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByText('房源预览 42')).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByText('房源预览 42')).toBeInTheDocument();
  });

  it('Escape 关闭已打开的预览', async () => {
    render(
      <EntityPreview type="house" id={42}>
        春风里 2 号
      </EntityPreview>,
    );

    fireEvent.mouseEnter(getPreviewTrigger());
    await act(async () => vi.advanceTimersByTime(200));
    expect(screen.getByText('房源预览 42')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('link'), { key: 'Escape' });
    expect(screen.queryByText('房源预览 42')).not.toBeInTheDocument();
  });

  it('Panel 抛错时隔离异常并保留宿主内容', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const BrokenPanel = () => {
      throw new Error('broken panel');
    };
    entityPreviewRegistry.house = {
      Panel: lazy(async () => ({ default: BrokenPanel })),
      getHref: (id) => `/property-rental/houses/${id}`,
    };

    render(
      <div>
        <span>宿主仍可用</span>
        <EntityPreview type="house" id={42}>
          春风里 2 号
        </EntityPreview>
      </div>,
    );
    fireEvent.mouseEnter(getPreviewTrigger());
    await act(async () => vi.advanceTimersByTime(200));

    expect(screen.getByRole('alert')).toHaveTextContent('预览暂不可用');
    expect(screen.getByText('宿主仍可用')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('自定义 href 覆盖注册定义', () => {
    render(
      <EntityPreview type="house" id={42} href="/custom/house/42">
        春风里 2 号
      </EntityPreview>,
    );

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/custom/house/42',
    );
  });
});
