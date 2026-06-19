import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PersonalCenterPage } from './personal-center-page';

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

vi.mock('../settings/style.style', () => ({
  default: () => ({
    styles: { main: 'main', leftMenu: 'leftMenu', right: 'right', title: 'title' },
  }),
}));

// Mock content views
vi.mock('../settings/components/base', () => ({ default: () => <div>个人资料内容</div> }));
vi.mock('../settings/components/security', () => ({ default: () => <div>安全设置内容</div> }));
vi.mock('../settings/components/binding', () => ({ default: () => <div>账号绑定内容</div> }));
vi.mock('../settings/components/notification', () => ({ default: () => <div>通知设置内容</div> }));

describe('PersonalCenterPage', () => {
  it('renders four personal center sections', () => {
    render(<PersonalCenterPage />);

    expect(screen.getByRole('menuitem', { name: '个人资料' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '账号安全' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '偏好设置' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '通知设置' })).toBeInTheDocument();
  });

  it('defaults to profile tab when no tab param is present', () => {
    window.history.replaceState({}, '', '/account/center');
    render(<PersonalCenterPage />);

    expect(screen.getByText('个人资料内容')).toBeInTheDocument();
  });

  it('opens security tab when url contains tab=security', () => {
    window.history.replaceState({}, '', '/account/center?tab=security');
    render(<PersonalCenterPage />);

    expect(screen.getByText('安全设置内容')).toBeInTheDocument();
  });

  it('updates url when switching tabs', () => {
    window.history.replaceState({}, '', '/account/center');
    render(<PersonalCenterPage />);

    fireEvent.click(screen.getByRole('menuitem', { name: '通知设置' }));

    expect(window.location.search).toContain('tab=notifications');
  });
});
