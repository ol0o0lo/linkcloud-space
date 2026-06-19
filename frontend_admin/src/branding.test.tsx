import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import defaultSettings from '../config/defaultSettings';
import enUSPages from './locales/en-US/pages';
import zhCNPages from './locales/zh-CN/pages';
import Welcome from './pages/Welcome';

vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: {
      currentUser: {
        username: 'tester',
        email: 'tester@example.com',
        is_staff: false,
        is_superuser: false,
      },
    },
  }),
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ title, content, children }: { title: string; content?: React.ReactNode; children: React.ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {content ? <p>{content}</p> : null}
      {children}
    </section>
  ),
}));

describe('branding copy', () => {
  it('uses the Chinese brand name in zh-CN surfaces while keeping en-US unchanged', () => {
    expect(defaultSettings.title).toBe('链云空间');
    expect(zhCNPages['pages.layouts.userLayout.title']).toBe('链云空间后台管理');
    expect(enUSPages['pages.layouts.userLayout.title']).toBe('LinkCloud Space Admin');

    render(<Welcome />);

    expect(screen.getByText('链云空间 已接入 Django 后端会话，当前页面展示真实登录用户信息。')).toBeInTheDocument();
  });
});
