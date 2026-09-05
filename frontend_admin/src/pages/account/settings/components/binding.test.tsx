import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BindingView from './binding';

const { mockQuerySocialBindings, mockStartSocialBinding } = vi.hoisted(() => ({
  mockQuerySocialBindings: vi.fn(),
  mockStartSocialBinding: vi.fn(),
}));

vi.mock('../service', () => ({
  querySocialBindings: mockQuerySocialBindings,
  startSocialBinding: mockStartSocialBinding,
}));

describe('BindingView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('starts provider binding when the bind action is clicked', async () => {
    mockQuerySocialBindings.mockResolvedValue({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: false },
      ],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BindingView />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '绑定GitHub' }));

    await waitFor(() => {
      expect(mockStartSocialBinding).toHaveBeenCalledWith('github');
    });
  });

  it('shows an error message when the bindings query fails', async () => {
    mockQuerySocialBindings.mockRejectedValue(new Error('boom'));

    render(
      <QueryClientProvider client={queryClient}>
        <BindingView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('账号绑定状态加载失败，请刷新重试'),
      ).toBeInTheDocument();
    });
  });
});
