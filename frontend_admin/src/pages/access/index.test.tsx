import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AccessOverviewPage from './index';

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe('AccessOverviewPage', () => {
  it('renders only access entry links', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AccessOverviewPage />
      </QueryClientProvider>,
    );

    expect(screen.queryByText('权限概览')).not.toBeInTheDocument();
    expect(screen.queryByText('空间级治理')).not.toBeInTheDocument();
    expect(screen.queryByText('团队级治理')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '空间角色' })).toHaveAttribute(
      'href',
      '/dashboard/space/access/organization-roles',
    );
    expect(screen.getByRole('link', { name: '空间授权' })).toHaveAttribute(
      'href',
      '/dashboard/space/access/organization-bindings',
    );
    expect(screen.getByRole('link', { name: '团队角色' })).toHaveAttribute(
      'href',
      '/dashboard/space/access/team-roles',
    );
    expect(screen.getByRole('link', { name: '团队授权' })).toHaveAttribute(
      'href',
      '/dashboard/space/access/team-bindings',
    );
  });
});
