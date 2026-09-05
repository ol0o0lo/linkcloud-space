import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamSettingsPage from './index';

const { mockListTeams, mockListSettings, mockPutSetting, mockDeleteSetting } =
  vi.hoisted(() => ({
    mockListTeams: vi.fn(),
    mockListSettings: vi.fn(),
    mockPutSetting: vi.fn(),
    mockDeleteSetting: vi.fn(),
  }));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({
    title,
    extra,
    children,
  }: {
    title: string;
    extra?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section>
      <div>
        <h1>{title}</h1>
        {extra}
      </div>
      {children}
    </section>
  ),
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'acme',
    queryClient: { invalidateQueries: vi.fn() },
  }),
}));

vi.mock('@/services/openapi/teams', () => ({
  appsTeamsApiListTeams: mockListTeams,
}));

vi.mock('@/services/openapi/teamSettings', () => ({
  appsSettingsApiListTeamSettings: mockListSettings,
  appsSettingsApiPutTeamSetting: mockPutSetting,
  appsSettingsApiDeleteTeamSettingView: mockDeleteSetting,
}));

describe('TeamSettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockListTeams.mockResolvedValue({
      items: [
        { id: 3, name: 'Growth', members: [11, 12, 13], member_details: [] },
      ],
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
        category: 'property_rental',
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
          floor_plan: { mode: 'off', label: '户型图' },
          video: { mode: 'off', label: '视频', min_count: 1 },
        },
        value_type: 'json',
        widget: 'json_editor',
        ui: {},
        description: '团队发布规则',
        category: 'property_rental',
        is_customized: true,
      },
      {
        key: 'review.required',
        label: '需要审核',
        value: false,
        value_type: 'boolean',
        widget: 'switch',
        ui: {},
        description: '需要审核',
        category: 'general',
        is_customized: true,
      },
    ]);
    mockPutSetting.mockResolvedValue({});
    mockDeleteSetting.mockResolvedValue({});
  });

  it('renders team settings like organization settings and supports inline update / restore', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TeamSettingsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockListTeams).toHaveBeenCalledWith({ page: 1, page_size: 100 });
      expect(mockListSettings).toHaveBeenCalledWith({ team_id: 3 });
      expect(screen.getByText('房源租赁设置')).toBeInTheDocument();
      expect(screen.getByText('通用设置')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: '通用设置' }));
    const reviewSwitch = screen.getByRole('switch', { name: '需要审核' });
    fireEvent.click(reviewSwitch);

    await waitFor(() => {
      expect(mockPutSetting).toHaveBeenCalledWith(
        { team_id: 3, key: 'review.required' },
        { value: true },
      );
    });

    const reviewRow = reviewSwitch.closest('form')
      ?.parentElement as HTMLElement;
    fireEvent.click(
      within(reviewRow).getByRole('button', { name: '恢复默认' }),
    );
    expect(
      await screen.findByText('确认恢复该设置默认值？'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith({
        team_id: 3,
        key: 'review.required',
      });
    });
  });
});
