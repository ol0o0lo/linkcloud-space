import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BuildingDetailPage from './detail';

const { mockGetBuilding, mockGetBuildingMapDetail, mockListHouses, mockUseTenantWorkspace } = vi.hoisted(() => ({
  mockGetBuilding: vi.fn(),
  mockGetBuildingMapDetail: vi.fn(),
  mockListHouses: vi.fn(),
  mockUseTenantWorkspace: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useParams: () => ({ id: '9' }),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: { getBuilding: mockGetBuilding, getBuildingMapDetail: mockGetBuildingMapDetail, listHouses: mockListHouses },
}));

describe('BuildingDetailPage', () => {
  it('将所属小区作为可下钻入口并展示库存概览', async () => {
    mockUseTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'demo' });
    mockGetBuildingMapDetail.mockResolvedValue({
      id: 9,
      name: '1栋',
      estate: { id: 7, name: '云岸', display_name: '云岸花园' },
      address: '科技园 1 栋',
      floors: 20,
      lat: 22.5,
      lng: 113.9,
      counts: { total: 2, vacant: 1, rented: 1, renovating: 0, locked: 0, published: 1 },
      houses: [],
    });
    mockGetBuilding.mockResolvedValue({
      id: 9,
      name: '1栋',
      estate: { id: 7, name: '云岸', display_name: '云岸花园' },
      address: '科技园 1 栋',
      floors: 20,
      elevator: true,
      lat: 22.5,
      lng: 113.9,
      counts: { total: 2, vacant: 1, rented: 1, renovating: 0, locked: 0, published: 1 },
    });
    mockListHouses.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BuildingDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('1栋')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '云岸花园' })).toHaveAttribute('href', '/property-rental/estates/7');
    expect(screen.getByText('经营概览')).toBeInTheDocument();
    expect(screen.getByText('总房源')).toBeInTheDocument();
    expect(screen.getByText('已租')).toBeInTheDocument();
  });

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
      counts: { total: 1, vacant: 1, rented: 0, renovating: 0, locked: 0, published: 0 },
    });
    mockListHouses.mockResolvedValue({
      items: [{ id: 91, room_number: '1001', floor: 10, asking_rent: '4500.00', status: 'vacant', status__mapping: '空置' }],
      total: 1,
      page: 1,
      page_size: 20,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BuildingDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('link', { name: '1001' })).toHaveAttribute('href', '/property-rental/houses/91');
    expect(mockListHouses).toHaveBeenCalledWith(expect.objectContaining({ building_id: 9, page: 1, page_size: 20 }));
  });
});
