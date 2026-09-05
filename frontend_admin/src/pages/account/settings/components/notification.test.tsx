import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listPreferences: vi.fn(),
  patchPreference: vi.fn(),
}));

vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListPreferences: mocks.listPreferences,
  appsNotificationsApiPatchPreference: mocks.patchPreference,
}));

import NotificationView from './notification';

const preferences: API.NotificationPreferenceOut[] = [
  {
    key: 'billing',
    label: '账单提醒',
    description: '订单和续费状态变化。',
    default_channels: ['in_app'],
    default_channels__mapping: ['站内信'],
    required_channels: ['in_app'],
    required_channels__mapping: ['站内信'],
    in_app: true,
    email: false,
  },
  {
    key: 'security',
    label: '安全提醒',
    description: '登录和账号安全事件。',
    default_channels: ['in_app', 'email'],
    default_channels__mapping: ['站内信', '邮件'],
    required_channels: [],
    required_channels__mapping: [],
    in_app: true,
    email: true,
  },
];

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationView />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('通知偏好设置', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listPreferences.mockResolvedValue(preferences);
  });

  it('加载服务端类别并锁定必选渠道', async () => {
    renderView();

    expect(await screen.findByText('账单提醒')).toBeInTheDocument();
    expect(screen.getByText('安全提醒')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: '账单提醒-站内信' }),
    ).toBeChecked();
    expect(
      screen.getByRole('switch', { name: '账单提醒-站内信' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: '账单提醒-邮件' }),
    ).not.toBeChecked();
  });

  it('切换单个渠道时 PATCH 当前类别并采用服务端响应', async () => {
    mocks.patchPreference.mockResolvedValueOnce({
      ...preferences[0],
      email: true,
    });
    renderView();

    const emailSwitch = await screen.findByRole('switch', {
      name: '账单提醒-邮件',
    });
    fireEvent.click(emailSwitch);

    await waitFor(() =>
      expect(mocks.patchPreference).toHaveBeenCalledWith(
        { category: 'billing' },
        { email: true },
      ),
    );
    expect(emailSwitch).toBeChecked();
  });

  it('保存失败时恢复旧值并显示错误', async () => {
    mocks.patchPreference.mockRejectedValueOnce(new Error('network failed'));
    renderView();

    const emailSwitch = await screen.findByRole('switch', {
      name: '安全提醒-邮件',
    });
    fireEvent.click(emailSwitch);

    expect(
      await screen.findByText('通知偏好保存失败，请重试。'),
    ).toBeInTheDocument();
    await waitFor(() => expect(emailSwitch).toBeChecked());
  });
});
