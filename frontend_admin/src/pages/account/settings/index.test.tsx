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
        <button key={item.key} type="button" onClick={() => onClick({ key: item.key })}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./components/base', () => ({ default: () => <div>基本设置内容</div> }));
vi.mock('./components/security', () => ({ default: () => <div>安全设置内容</div> }));
vi.mock('./components/binding', () => ({ default: () => <div>账号绑定内容</div> }));
vi.mock('./components/notification', () => ({ default: () => <div>消息通知内容</div> }));
vi.mock('./style.style', () => ({
  default: () => ({
    styles: { main: 'main', leftMenu: 'leftMenu', right: 'right', title: 'title' },
  }),
}));

describe('Settings page tab sync', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/account/settings?tab=binding');
  });

  it('opens binding view when the url tab param is binding', () => {
    render(<Settings />);

    expect(screen.getByRole('button', { name: '账号绑定' })).toBeInTheDocument();
    expect(screen.getByText('账号绑定内容')).toBeInTheDocument();
  });

  it('writes the selected tab back to the url', () => {
    window.history.replaceState({}, '', '/account/settings');
    render(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: '账号绑定' }));

    expect(window.location.search).toContain('tab=binding');
  });
});
