import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
  it('使用统一详情布局展示小区概览、资料与楼栋经营状态', async () => {
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

    expect(
      await screen.findByRole('heading', { level: 2, name: '云岸花园' }),
    ).toBeInTheDocument();
    const metrics = screen.getByRole('region', { name: '小区经营指标' });
    expect(within(metrics).getByText('70%')).toBeInTheDocument();
    expect(within(metrics).getByText('出租率')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: '项目档案' }),
    ).toBeInTheDocument();
    expect(screen.getByText('小区项目总览')).toBeInTheDocument();
    expect(screen.getByText('楼栋经营')).toBeInTheDocument();
    expect(screen.queryByText('档案状态')).not.toBeInTheDocument();
    expect(screen.getByTestId('estate-no-image-state')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /编辑资料/ })).toHaveAttribute(
      'href',
      '/dashboard/rental/properties/estates?estate_edit=7',
    );
    expect(screen.getByRole('link', { name: '1栋' })).toHaveAttribute(
      'href',
      '/rental/properties/buildings/9',
    );
    expect(screen.getByText('近地铁')).toBeInTheDocument();
    expect(mockListBuildings).toHaveBeenCalledWith({
      estate_id: 7,
      page: 1,
      page_size: 20,
    });
  });
});
