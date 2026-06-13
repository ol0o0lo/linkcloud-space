import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityView from './security';

const serviceMocks = vi.hoisted(() => ({
  mockQueryCurrent: vi.fn(),
  mockListAuthenticators: vi.fn(),
}));

vi.mock('../service', () => ({
  queryCurrent: serviceMocks.mockQueryCurrent,
  listAuthenticators: serviceMocks.mockListAuthenticators,
}));

vi.mock('./security.modals', () => ({
  SecurityModals: ({ activeModal }: { activeModal: string | null }) => (
    <div data-testid="security-modal-state">{activeModal || 'closed'}</div>
  ),
}));

describe('SecurityView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.mockQueryCurrent.mockResolvedValue({
      data: {
        id: 7,
        email: 'member@example.com',
        phoneCountryCode: '+86',
        phoneNationalNumber: '13800138001',
      },
    });
    serviceMocks.mockListAuthenticators.mockResolvedValue({
      data: [{ type: 'totp' }, { type: 'recovery_codes' }],
    });
  });

  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <SecurityView />
      </QueryClientProvider>,
    );
  }

  it('renders four real security items and removes security question row', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('账户密码')).toBeInTheDocument();
    });

    expect(screen.getByText('密保手机')).toBeInTheDocument();
    expect(screen.getByText('邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('MFA 设备')).toBeInTheDocument();
    expect(screen.queryByText('密保问题')).not.toBeInTheDocument();
    expect(screen.getByText('已启用 TOTP 和恢复码')).toBeInTheDocument();
  });

  it('shows unbound copy for empty phone and email', async () => {
    serviceMocks.mockQueryCurrent.mockResolvedValue({
      data: {
        id: 7,
        email: '',
        phoneCountryCode: '',
        phoneNationalNumber: '',
      },
    });
    serviceMocks.mockListAuthenticators.mockResolvedValue({ data: [] });

    renderView();

    expect(await screen.findByText('未绑定手机号')).toBeInTheDocument();
    expect(screen.getByText('未绑定邮箱')).toBeInTheDocument();
    expect(screen.getByText('未启用')).toBeInTheDocument();
  });

  it('opens matching modal state when action is clicked', async () => {
    renderView();

    await screen.findByText('账户密码');
    fireEvent.click(screen.getAllByText('修改')[0]);

    expect(screen.getByTestId('security-modal-state')).toHaveTextContent(
      'password',
    );
  });
});
