import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityView from './security';

const { mockListAuthenticators, mockQueryCurrent } = vi.hoisted(() => ({
  mockListAuthenticators: vi.fn(),
  mockQueryCurrent: vi.fn(),
}));

vi.mock('../service', () => ({
  listAuthenticators: mockListAuthenticators,
  queryCurrent: mockQueryCurrent,
}));

vi.mock('./security.modals', () => ({
  SecurityModals: ({ activeModal }: { activeModal: string | null }) => (
    <div data-testid="security-modal-state">{activeModal || 'closed'}</div>
  ),
}));

describe('SecurityView', () => {
  beforeEach(() => {
    mockListAuthenticators.mockResolvedValue([]);
    mockQueryCurrent.mockResolvedValue({
      data: {
        email: 'user@example.com',
        phone_country_code: '+86',
        phone_national_number: '13800138000',
      },
    });
  });

  it('安全设置操作使用可聚焦按钮并能打开对应弹窗', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SecurityView />
      </QueryClientProvider>,
    );

    const passwordTitle = await screen.findByText('账户密码');
    const passwordItem = passwordTitle.closest('.ant-list-item');
    expect(passwordItem).not.toBeNull();
    const action = within(passwordItem as HTMLElement).getByRole('button', {
      name: '修改',
    });
    expect(action).toHaveAttribute('type', 'button');

    fireEvent.click(action);
    expect(screen.getByTestId('security-modal-state')).toHaveTextContent(
      'password',
    );
  });
});
