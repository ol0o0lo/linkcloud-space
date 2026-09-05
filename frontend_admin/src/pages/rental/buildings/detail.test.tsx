import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuildingDetailPage from './detail';

const {
  mockGetBuilding,
  mockGetBuildingMapDetail,
  mockListHouses,
  mockUseTenantWorkspace,
} = vi.hoisted(() => ({
  mockGetBuilding: vi.fn(),
  mockGetBuildingMapDetail: vi.fn(),
  mockListHouses: vi.fn(),
  mockUseTenantWorkspace: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => ({ id: '9' }),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getBuilding: mockGetBuilding,
    getBuildingMapDetail: mockGetBuildingMapDetail,
    listHouses: mockListHouses,
  },
}));

describe('BuildingDetailPage', () => {
  it('按楼栋条件分页加载房源列表', async () => {
    mockUseTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'demo' });
    mockGetBuilding.mockResolvedValue({
      id: 9,
      name: '1栋',
      estate: { id: 7, name: '云岸', display_name: '云岸花园' },
      address: '科技园 1 栋',
      floors: 20,
      elevator: true,
      lat: 22.5,
      lng: 113.9,
      counts: {
        total: 1,
        vacant: 1,
        listed: 0,
        rented: 0,
        renovating: 0,
      },
    });
    mockListHouses.mockResolvedValue({
      items: [
        {
          id: 91,
          room_number: '1001',
          floor: 10,
          asking_rent: '4500.00',
          status: 'vacant',
          status__mapping: '空置',
          effective_tags: ['采光好', '近地铁'],
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BuildingDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByRole('link', { name: '1001' });
    expect(mockListHouses).toHaveBeenCalledWith(
      expect.objectContaining({ building_id: 9, page: 1, page_size: 20 }),
    );
    expect(screen.getByRole('link', { name: /编辑资料/ })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?building_id=9&asset_tab=profile&asset_action=edit-building',
    );
    expect(screen.getByRole('link', { name: '返回房源管理' })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?building_id=9',
    );
  });
});
