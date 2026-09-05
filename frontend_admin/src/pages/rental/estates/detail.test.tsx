import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EstateDetailPage from './detail';

const { mockGetEstate, mockListBuildings, mockUseTenantWorkspace } = vi.hoisted(
  () => ({
    mockGetEstate: vi.fn(),
    mockListBuildings: vi.fn(),
    mockUseTenantWorkspace: vi.fn(),
  }),
);

vi.mock('@umijs/max', () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ id: '7' }),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getEstate: mockGetEstate,
    listBuildings: mockListBuildings,
  },
}));

describe('EstateDetailPage', () => {
  it('按小区条件分页加载楼栋列表', async () => {
    mockUseTenantWorkspace.mockReturnValue({ selectedOrgSlug: 'demo' });
    mockGetEstate.mockResolvedValue({
      id: 7,
      name: '云岸',
      display_name: '云岸花园',
      property_type: 'residential',
      property_type__mapping: '住宅',
      province: '广东省',
      city: '广州市',
      district: '天河区',
      address: '科技园路 1 号',
      lat: '23.135120',
      lng: '113.361210',
      images: [],
      building_count: 1,
      counts: {
        total: 10,
        vacant: 2,
        listed: 1,
        rented: 7,
        renovating: 0,
      },
    });
    mockListBuildings.mockResolvedValue({
      items: [
        {
          id: 9,
          name: '1栋',
          address: '科技园路 1 号 1栋',
          floors: 20,
          elevator: true,
          tags: ['近地铁'],
          counts: {
            total: 10,
            vacant: 2,
            listed: 1,
            rented: 7,
            renovating: 0,
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <EstateDetailPage />
      </QueryClientProvider>,
    );

    await screen.findByRole('link', { name: '1栋' });
    expect(mockListBuildings).toHaveBeenCalledWith({
      estate_id: 7,
      page: 1,
      page_size: 20,
    });
    expect(screen.getByRole('link', { name: /编辑资料/ })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?estate_id=7&asset_tab=profile&asset_action=edit-estate',
    );
    expect(screen.getByRole('link', { name: '返回房源管理' })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?estate_id=7',
    );
    expect(screen.getByRole('link', { name: '查看全部楼栋' })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?estate_id=7&asset_tab=structure',
    );
    expect(screen.getByRole('link', { name: /新建楼栋/ })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/list?estate_id=7&asset_tab=structure&asset_action=create-building',
    );
  });
});
