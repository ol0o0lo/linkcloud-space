import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamSettingsPage from './index';

const {
  mockListTeams,
  mockListSettings,
  mockGetSetting,
  mockPutSetting,
  mockDeleteSetting,
} = vi.hoisted(() => ({
  mockListTeams: vi.fn(),
  mockListSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockPutSetting: vi.fn(),
  mockDeleteSetting: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TenantSectionHint: ({ text }: { text: string }) => <div>{text}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'acme', queryClient: { invalidateQueries: vi.fn() } }),
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('@/services/openapi/teamSettings', () => ({
  appsSettingsApiListTeamSettings: mockListSettings,
  appsSettingsApiGetTeamSettingView: mockGetSetting,
  appsSettingsApiPutTeamSetting: mockPutSetting,
  appsSettingsApiDeleteTeamSettingView: mockDeleteSetting,
}));

describe('TeamSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListTeams.mockResolvedValue({ items: [{ id: 3, name: 'Growth' }], total: 1, page: 1, page_size: 100 });
    mockListSettings.mockResolvedValue([
      { key: 'review.required', label: '需要审核', value: false, value_type: 'boolean', widget: 'switch', ui: {}, description: '需要审核', is_customized: true },
    ]);
    mockGetSetting.mockResolvedValue({ key: 'review.required', label: '需要审核', value: false, value_type: 'boolean', widget: 'switch', ui: {}, description: '需要审核', is_customized: true });
    mockPutSetting.mockResolvedValue({});
    mockDeleteSetting.mockResolvedValue({});
  });

  it('loads team settings and triggers update / restore actions for the selected team', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TeamSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListSettings).toHaveBeenCalledWith({ team_id: 3 });
      expect(screen.getByText('review.required')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('编辑'));
    expect(screen.getByRole('switch')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith({ team_id: 3, key: 'review.required' }, { value: false });
    });

    fireEvent.click(screen.getByText('恢复默认'));
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith({ team_id: 3, key: 'review.required' });
    });
  });
});
