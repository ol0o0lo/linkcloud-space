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
  it('将所属小区作为可下钻入口并展示楼栋经营概览', async () => {
    mockUseTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'demo' });
    mockGetBuildingMapDetail.mockResolvedValue({
      id: 9,
      name: '1栋',
      estate: { id: 7, name: '云岸', display_name: '云岸花园' },
      address: '科技园 1 栋',
      floors: 20,
      lat: 22.5,
      lng: 113.9,
      counts: {
        total: 2,
        vacant: 1,
        listed: 0,
        rented: 1,
        renovating: 0,
      },
      houses: [],
    });
    mockGetBuilding.mockResolvedValue({
      id: 9,
      name: '1栋',
      estate: { id: 7, name: '云岸', display_name: '云岸花园' },
      address: '科技园 1 栋',
      floors: 20,
      elevator: true,
      tags: ['近地铁', '成熟配套'],
      images: [
        {
          media_id: 11,
          media_type: 'image',
          label: '楼栋正门',
          url: '/building.jpg',
          thumbnail: '/building-thumb.jpg',
        },
      ],
      lat: 22.5,
      lng: 113.9,
      counts: {
        total: 2,
        vacant: 1,
        listed: 0,
        rented: 1,
        renovating: 0,
      },
    });
    mockListHouses.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BuildingDetailPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 2, name: '1栋' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: '云岸花园' })[0],
    ).toHaveAttribute('href', '/rental/properties/estates/7');
    expect(screen.getByText('楼栋档案')).toBeInTheDocument();
    expect(screen.getByText('总房源')).toBeInTheDocument();
    expect(screen.getByText('已租')).toBeInTheDocument();
    expect(screen.getByText('当前出租率')).toBeInTheDocument();
    expect(screen.queryByText('管理待办')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /登记房源/ })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/new?building_id=9',
    );
    expect(screen.getByText('房源列表')).toBeInTheDocument();
    expect(screen.getByText('近地铁')).toBeInTheDocument();
    expect(screen.getByText('成熟配套')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '楼栋名片' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '运营仪表盘' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('档案状态')).not.toBeInTheDocument();
    expect(screen.getByAltText('楼栋正门')).toHaveAttribute(
      'src',
      '/building-thumb.jpg',
    );
    expect(screen.queryByText('楼栋图片待补充')).not.toBeInTheDocument();
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

    const houseLink = await screen.findByRole('link', { name: '1001' });
    expect(houseLink).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/91',
    );
    expect(houseLink).toHaveAttribute('target', '_blank');
    expect(screen.getByText('楼栋图片待补充')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '添加楼栋图片' })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/estates?view=buildings&building_edit=9',
    );
    expect(screen.getByText('采光好')).toBeInTheDocument();
    expect(screen.getByText('近地铁')).toBeInTheDocument();
    expect(mockListHouses).toHaveBeenCalledWith(
      expect.objectContaining({ building_id: 9, page: 1, page_size: 20 }),
    );
  });
});
