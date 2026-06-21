import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseDetailPage from '../detail';

const { mockUseParams, mockGetHouse, mockPatchHouse } = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockGetHouse: vi.fn(),
  mockPatchHouse: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useParams: mockUseParams,
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getHouse: mockGetHouse,
    patchHouse: mockPatchHouse,
  },
}));

const completeHouse = {
  id: 99,
  building_id: 10,
  landlord_id: 20,
  room_number: '1801',
  asking_rent: '4200.00',
  deposit_amount: '4200.00',
  available_from: '2026-07-01',
  area: '80.00',
  images: [
    { media_id: 1, media_type: 'image', image_role: 'cover', url: '/cover.jpg' },
    { media_id: 2, media_type: 'image', image_role: 'floor_plan', url: '/plan.jpg' },
    { media_id: 3, media_type: 'image', image_role: 'bedroom', url: '/room.jpg' },
  ],
  videos: [],
  status: 'vacant',
  publish_status: 'draft',
};

describe('House detail page', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: '99' });
    mockGetHouse.mockReset();
    mockPatchHouse.mockResolvedValue({ ...completeHouse, publish_status: 'published' });
  });

  it('shows missing publish requirements', async () => {
    mockGetHouse.mockResolvedValue({ ...completeHouse, landlord_id: null, images: [] });

    render(<QueryClientProvider client={new QueryClient()}><HouseDetailPage /></QueryClientProvider>);

    expect(await screen.findByText('发布检查')).toBeInTheDocument();
    expect(await screen.findByText('补充房东')).toBeInTheDocument();
    expect(screen.getByText('设置封面')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '发布房源' })).toBeDisabled();
  });

  it('publishes a complete house', async () => {
    mockGetHouse.mockResolvedValue(completeHouse);

    render(<QueryClientProvider client={new QueryClient()}><HouseDetailPage /></QueryClientProvider>);

    await screen.findAllByText('1801');
    fireEvent.click(screen.getByRole('button', { name: '发布房源' }));

    await waitFor(() => expect(mockPatchHouse).toHaveBeenCalledWith(99, { publish_status: 'published' }));
  });
});
