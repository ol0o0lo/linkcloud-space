import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationDispatchCreateModal from './CreateNotificationDispatchModal';

const { mockListPreferences } = vi.hoisted(() => ({
  mockListPreferences: vi.fn(),
}));

vi.mock('@/services/manual/notificationDispatches', () => ({
  listNotificationDispatchTargets: vi.fn(),
}));

vi.mock('@/services/openapi/notificationDispatches', () => ({
  appsNotificationsApiCreateDispatch: vi.fn(),
}));

vi.mock('@/services/openapi/notifications', () => ({
  appsNotificationsApiListPreferences: mockListPreferences,
}));

function renderModal(isTenantMode: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationDispatchCreateModal
        open
        isTenantMode={isTenantMode}
        managementContext={isTenantMode ? 'tenant' : 'platform'}
        currentOrganization={
          isTenantMode ? { id: 7, name: 'LAN 空间' } : undefined
        }
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('NotificationDispatchCreateModal', () => {
  beforeEach(() => {
    mockListPreferences.mockResolvedValue([]);
  });

  it('限制租户管理员仅向当前空间及其团队或成员发送', () => {
    renderModal(true);

    expect(screen.getByRole('radio', { name: '空间全员' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '指定团队' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '指定成员' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: '全平台' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('目标空间')).not.toBeInTheDocument();
    expect(
      screen.getByText('将发送给「LAN 空间」的全部成员'),
    ).toBeInTheDocument();
    expect(screen.queryByText('发送后可查看投递结果')).not.toBeInTheDocument();
  });

  it('为超级管理员提供全平台、指定空间和指定用户的范围', () => {
    renderModal(false);

    expect(screen.getByRole('radio', { name: '全平台' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '指定空间' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '指定用户' })).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: '指定团队' }),
    ).not.toBeInTheDocument();
  });
});
