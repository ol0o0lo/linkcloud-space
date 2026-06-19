import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from './index';

vi.mock('@ant-design/pro-components', () => ({
  GridContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
  Menu: ({ items, onClick }: any) => (
    <div>
      {items.map((item: any) => (
        <button key={item.key} type="button" role="menuitem" onClick={() => onClick({ key: item.key })}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./components/base', () => ({ default: () => <div>个人资料内容</div> }));
vi.mock('./components/security', () => ({ default: () => <div>安全设置内容</div> }));
vi.mock('./components/binding', () => ({ default: () => <div>账号绑定内容</div> }));
vi.mock('./components/notification', () => ({ default: () => <div>通知设置内容</div> }));
vi.mock('./style.style', () => ({
  default: () => ({
    styles: { main: 'main', leftMenu: 'leftMenu', right: 'right', title: 'title' },
  }),
}));

describe('Settings page (兼容路由) tab sync', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/account/settings?tab=security');
  });

  it('opens security view when the url tab param is security', () => {
    render(<Settings />);

    expect(screen.getByRole('menuitem', { name: '账号安全' })).toBeInTheDocument();
    expect(screen.getByText('安全设置内容')).toBeInTheDocument();
    expect(screen.getByText('账号绑定内容')).toBeInTheDocument();
  });

  it('has four personal center tabs', () => {
    window.history.replaceState({}, '', '/account/settings');
    render(<Settings />);

    expect(screen.getByRole('menuitem', { name: '个人资料' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '账号安全' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '偏好设置' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '通知设置' })).toBeInTheDocument();
  });

  it('writes the selected tab back to the url', () => {
    window.history.replaceState({}, '', '/account/settings');
    render(<Settings />);

    fireEvent.click(screen.getByRole('menuitem', { name: '通知设置' }));

    expect(window.location.search).toContain('tab=notifications');
  });
});
