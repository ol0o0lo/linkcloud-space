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
  mockListOrgSettings,
  mockListTeamRoles,
  mockListTeamBindings,
} = vi.hoisted(() => ({
  mockListTeams: vi.fn(),
  mockListSettings: vi.fn(),
  mockGetSetting: vi.fn(),
  mockPutSetting: vi.fn(),
  mockDeleteSetting: vi.fn(),
  mockListOrgSettings: vi.fn(),
  mockListTeamRoles: vi.fn(),
  mockListTeamBindings: vi.fn(),
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

vi.mock('@/services/openapi/organizationSettings', () => ({
  appsSettingsApiListOrgSettings: mockListOrgSettings,
}));

vi.mock('@/services/openapi/accessTeamRoles', () => ({
  appsAccessApiListTeamRoles: mockListTeamRoles,
}));

vi.mock('@/services/openapi/accessTeamBindings', () => ({
  appsAccessApiListTeamBindingsView: mockListTeamBindings,
}));

describe('TeamSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockListTeams.mockResolvedValue({
      items: [{ id: 3, name: 'Growth', members: [11, 12, 13], member_details: [] }],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListSettings.mockResolvedValue([
      {
        key: 'property_rental.default_building_id',
        label: '默认楼栋',
        value: 10,
        value_type: 'integer',
        widget: 'input_number',
        ui: {},
        description: '团队默认承接楼栋',
        is_customized: false,
      },
      {
        key: 'property_rental.publish_rules',
        label: '房源发布规则',
        value: {
          landlord: { mode: 'required', label: '房东' },
          rent: { mode: 'required', label: '租金' },
          cover: { mode: 'warn', label: '封面图' },
          images: { mode: 'warn', label: '图片', min_count: 6 },
          layout_images: { mode: 'off', label: '户型图', min_count: 1 },
          video: { mode: 'off', label: '视频', min_count: 1 },
        },
        value_type: 'json',
        widget: 'json_editor',
        ui: {},
        description: '团队发布规则',
        is_customized: true,
      },
      { key: 'review.required', label: '需要审核', value: false, value_type: 'boolean', widget: 'switch', ui: {}, description: '需要审核', is_customized: true },
    ]);
    mockListOrgSettings.mockResolvedValue([
      { key: 'property_rental.default_building_id', label: '默认楼栋', value: 8, value_type: 'integer', widget: 'input_number', ui: {}, description: '空间默认楼栋', is_customized: false },
      {
        key: 'property_rental.publish_rules',
        label: '房源发布规则',
        value: {
          landlord: { mode: 'required', label: '房东' },
          rent: { mode: 'required', label: '租金' },
          cover: { mode: 'warn', label: '封面图' },
          images: { mode: 'off', label: '图片', min_count: 6 },
          layout_images: { mode: 'off', label: '户型图', min_count: 1 },
          video: { mode: 'off', label: '视频', min_count: 1 },
        },
        value_type: 'json',
        widget: 'json_editor',
        ui: {},
        description: '空间发布规则',
        is_customized: false,
      },
    ]);
    mockListTeamRoles.mockResolvedValue([
      { id: 1, name: '团队运营', permission_keys: ['house.publish'], is_active: true, is_system: false },
      { id: 2, name: '团队主管', permission_keys: ['house.publish', 'house.audit'], is_active: true, is_system: true },
    ]);
    mockListTeamBindings.mockResolvedValue([
      { id: 9, user: { id: 11, username: 'alice' }, role: { id: 1, name: '团队运营' }, created_at: '2026-06-24T00:00:00Z' },
      { id: 10, user: { id: 12, username: 'bob' }, role: { id: 2, name: '团队主管' }, created_at: '2026-06-24T00:00:00Z' },
    ]);
    mockGetSetting.mockResolvedValue({ key: 'review.required', label: '需要审核', value: false, value_type: 'boolean', widget: 'switch', ui: {}, description: '需要审核', is_customized: true });
    mockPutSetting.mockResolvedValue({});
    mockDeleteSetting.mockResolvedValue({});
  });

  it('renders team governance sections and still supports update / restore actions', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TeamSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListSettings).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListOrgSettings).toHaveBeenCalledWith();
      expect(mockListTeamRoles).toHaveBeenCalledWith({ team_id: 3 });
      expect(mockListTeamBindings).toHaveBeenCalledWith({ team_id: 3 });
      expect(screen.getByText('review.required')).toBeInTheDocument();
    });

    expect(screen.getByText('策略概览')).toBeInTheDocument();
    expect(screen.getByText('策略继承与覆盖')).toBeInTheDocument();
    expect(screen.queryByText('关键提醒')).not.toBeInTheDocument();
    expect(screen.getByText('团队覆盖设置项')).toBeInTheDocument();
    expect(screen.getByText('团队成员')).toBeInTheDocument();
    expect(screen.getAllByText('房源发布规则').length).toBeGreaterThan(0);
    expect(screen.queryByText('空间继承')).not.toBeInTheDocument();
    expect(screen.queryByText('权限编组')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('编辑').at(-1)!);
    expect(screen.getByRole('switch')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith({ team_id: 3, key: 'review.required' }, { value: false });
    });

    fireEvent.click(screen.getAllByText('恢复默认').at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'OK' }).at(-1)!);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith({ team_id: 3, key: 'review.required' });
    });
  });
});
