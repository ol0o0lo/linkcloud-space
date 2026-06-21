import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkbenchPage from './workbench';

const { mockListHouses, mockListViewings, mockListLeases } = vi.hoisted(() => ({
  mockListHouses: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
  },
}));

describe('Property rental workbench', () => {
  beforeEach(() => {
    mockListHouses.mockResolvedValue({
      items: [
        { id: 1, room_number: '101', landlord_id: null, images: [], videos: [], status: 'vacant', publish_status: 'draft' },
        { id: 2, room_number: '102', landlord_id: 5, images: [{ media_id: 1, media_type: 'image', image_role: 'cover' }], videos: [], status: 'vacant', publish_status: 'published' },
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });
    mockListViewings.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    mockListLeases.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('shows actionable house tasks', async () => {
    render(<QueryClientProvider client={new QueryClient()}><WorkbenchPage /></QueryClientProvider>);

    await waitFor(() => expect(mockListHouses).toHaveBeenCalledTimes(1));
    await screen.findByText('101');

    expect(screen.getByText('待补房东')).toBeInTheDocument();
    expect(screen.getByText('待补封面')).toBeInTheDocument();
    expect(screen.getByText('房源待办明细')).toBeInTheDocument();
    expect(screen.getAllByText('1')[0]).toBeInTheDocument();
  });
});
