import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LandlordCenterPage from '../personal-business/landlord';
import LandlordInvitationAcceptPage from './invitation-accept';
import PublicLandlordStorePage from './public-store';

const {
  mockAcceptInvitation,
  mockGetInvitation,
  mockGetPublicProfile,
  mockListLandlordHouses,
  mockListLandlordLeases,
  mockListPublicHouses,
  mockListRelationships,
  routeParams,
} = vi.hoisted(() => ({
  mockAcceptInvitation: vi.fn(),
  mockGetInvitation: vi.fn(),
  mockGetPublicProfile: vi.fn(),
  mockListLandlordHouses: vi.fn(),
  mockListLandlordLeases: vi.fn(),
  mockListPublicHouses: vi.fn(),
  mockListRelationships: vi.fn(),
  routeParams: {} as Record<string, string>,
}));

vi.mock('@umijs/max', () => ({
  history: { push: vi.fn() },
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useParams: () => routeParams,
}));

vi.mock('@/components/PageContainer', () => ({
  PageContainer: ({ children }: { children?: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('@/components/AppStatus', () => ({
  AppStatusTag: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    acceptLandlordInvitation: mockAcceptInvitation,
    getLandlordInvitation: mockGetInvitation,
    getPublicLandlordProfile: mockGetPublicProfile,
    listLandlordHouses: mockListLandlordHouses,
    listLandlordLeases: mockListLandlordLeases,
    listLandlordRelationships: mockListRelationships,
    listPublicLandlordHouses: mockListPublicHouses,
  },
}));

const renderPage = (page: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {page}
    </QueryClientProvider>,
  );

describe('房东邀请、切换与公开页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.keys(routeParams).forEach((key) => {
      delete routeParams[key];
    });
    mockListLandlordLeases.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    });
  });

  it('接受邀请后展示进入房东中心入口', async () => {
    routeParams.token = 'invite-token';
    mockGetInvitation.mockResolvedValue({
      organization_name: '甲中介',
      contact_name: '张房东',
      invitee_phone_masked: '+86****8001',
      expires_at: '2026-09-01T12:00:00+08:00',
    });
    mockAcceptInvitation.mockResolvedValue({
      contact_id: 1,
      organization_id: 1,
      organization_name: '甲中介',
      public_key: 'public-key',
    });

    renderPage(<LandlordInvitationAcceptPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '接受邀请并绑定' }),
    );

    expect(
      await screen.findByRole('button', { name: '进入房东中心' }),
    ).toBeInTheDocument();
    expect(mockAcceptInvitation).toHaveBeenCalledWith('invite-token');
  });

  it('切换中介关系后使用新的 contact_id 请求房源', async () => {
    mockListRelationships.mockResolvedValue([
      {
        contact_id: 1,
        organization_id: 1,
        organization_name: '甲中介',
        organization_slug: 'a',
        contact_name: '甲档案',
        house_count: 1,
        public_house_count: 1,
        public_key: 'key-a',
        public_url: 'http://example.test/a',
      },
      {
        contact_id: 2,
        organization_id: 2,
        organization_name: '乙中介',
        organization_slug: 'b',
        contact_name: '乙档案',
        house_count: 0,
        public_house_count: 0,
        public_key: 'key-b',
        public_url: 'http://example.test/b',
      },
    ]);
    mockListLandlordHouses.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    });

    renderPage(<LandlordCenterPage />);
    await waitFor(() =>
      expect(mockListLandlordHouses).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ page: 1, page_size: 10 }),
      ),
    );

    fireEvent.mouseDown(screen.getByLabelText('切换房东关系'));
    fireEvent.click(await screen.findByText('乙中介 · 乙档案'));

    await waitFor(() =>
      expect(mockListLandlordHouses).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ page: 1, page_size: 10 }),
      ),
    );
  });

  it('公开店铺展示房源并生成详情链接', async () => {
    routeParams.publicKey = 'public-key';
    mockGetPublicProfile.mockResolvedValue({
      public_key: 'public-key',
      name: '张房东',
      avatar: [],
      phone: '+8613800138001',
      organization: {
        slug: 'agency',
        name: '甲中介',
        logo: [],
        description: '',
      },
      house_count: 1,
    });
    mockListPublicHouses.mockResolvedValue({
      items: [
        {
          id: 8,
          room_number: '801',
          area: '42.00',
          asking_rent: '4200.00',
          bedrooms: 1,
          living_rooms: 0,
          has_elevator_access: true,
          images: [],
          tags: [],
          effective_tags: ['近地铁'],
          public_description: '',
          building: { id: 1, name: '1栋', address: '科技园路' },
          publisher: {
            slug: 'agency',
            name: '甲中介',
            logo: [],
            description: '',
          },
          updated_at: '2026-08-25T12:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 12,
    });

    renderPage(<PublicLandlordStorePage />);
    expect(await screen.findByText('单间 · 42.00 ㎡')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看详情' })).toHaveAttribute(
      'href',
      '/landlords/public-key/houses/8',
    );
  });
});
