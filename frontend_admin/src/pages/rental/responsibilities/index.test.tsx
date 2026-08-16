import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffResponsibilitiesPage from './index';

const {
  mockListBuildings,
  mockListContacts,
  mockListEstates,
  mockListHouses,
  mockListStaffResponsibilities,
  mockReplaceStaffResponsibilities,
  mockUseTenantWorkspace,
} = vi.hoisted(() => ({
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListEstates: vi.fn(),
  mockListHouses: vi.fn(),
  mockListStaffResponsibilities: vi.fn(),
  mockReplaceStaffResponsibilities: vi.fn(),
  mockUseTenantWorkspace: vi.fn(),
}));

vi.mock('@/pages/space/shared', () => ({
  formatPersonLabel: (user: { name?: string; username: string }) =>
    user.name || user.username,
  TenantSelectionGuard: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listEstates: mockListEstates,
    listHouses: mockListHouses,
    listStaffResponsibilities: mockListStaffResponsibilities,
    replaceStaffResponsibilities: mockReplaceStaffResponsibilities,
  },
}));

vi.mock('@ant-design/pro-components', () => ({
  ProTable: ({
    columns,
    dataSource = [],
    toolBarRender,
  }: {
    columns: Array<{
      dataIndex: string;
      render?: (value: unknown, record: Record<string, unknown>) => React.ReactNode;
      title: React.ReactNode;
    }>;
    dataSource: Array<Record<string, unknown>>;
    toolBarRender?: () => React.ReactNode[];
  }) => (
    <div>
      {toolBarRender?.()}
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.dataIndex}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.map((record) => (
            <tr key={String(record.member_id || record.id)}>
              {columns.map((column) => (
                <td key={column.dataIndex}>
                  {column.render
                    ? column.render(record[column.dataIndex], record)
                    : String(record[column.dataIndex] || '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

describe('员工分工页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenantWorkspace.mockReturnValue({
      selectedOrgSlug: 'test-org',
      queryClient: new QueryClient(),
    });
    mockListStaffResponsibilities.mockResolvedValue({
      items: [
        {
          member_id: 1,
          user: {
            avatar_url: undefined,
            email: 'li@example.com',
            name: '李琳',
            username: 'lilin',
          },
          is_owner: false,
          landlords: [{ id: 7, name: '张房东' }],
          buildings: [],
          estates: [{ id: 8, display_name: '云栖花园', name: '云栖花园' }],
          responsible_house_count: 3,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    mockListContacts.mockResolvedValue({
      items: [{ id: 7, name: '张房东', phone: '13800000000' }],
    });
    mockListBuildings.mockResolvedValue({ items: [] });
    mockListEstates.mockResolvedValue({
      items: [{ id: 8, display_name: '云栖花园', name: '云栖花园' }],
    });
    mockListHouses.mockResolvedValue({ items: [] });
    mockReplaceStaffResponsibilities.mockResolvedValue({});
  });

  it('展示分层范围，并在确认后才整体替换分工', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StaffResponsibilitiesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('李琳')).toBeInTheDocument();
    expect(screen.getByText('负责范围')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'edit 配置分工' }),
    );

    expect(await screen.findByText('房东范围')).toBeInTheDocument();
    expect(screen.getByText('分配顺序')).toBeInTheDocument();
    expect(
      screen.getByText('同一房源会归属至最先命中的范围；保存前还可再次确认。'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存分工' }));

    const confirmationDialog = await waitFor(() => {
      const dialog = screen
        .getAllByRole('dialog')
        .find((element) => element.textContent?.includes('确认替换分工'));
      expect(dialog).toBeDefined();
      return dialog as HTMLElement;
    });
    expect(mockReplaceStaffResponsibilities).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirmationDialog).getByRole('button', {
        name: '确认替换分工',
      }),
    );
    await waitFor(() =>
      expect(mockReplaceStaffResponsibilities).toHaveBeenCalledWith(1, {
        landlord_ids: [7],
        building_ids: [],
        estate_ids: [8],
      }),
    );
  });
});
