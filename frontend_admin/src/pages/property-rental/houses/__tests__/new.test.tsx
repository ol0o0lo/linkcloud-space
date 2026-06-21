import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseNewPage from '../new';

const { mockPush, mockListBuildings, mockListContacts, mockCreateHouse } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockCreateHouse: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: mockPush },
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    createHouse: mockCreateHouse,
  },
}));

describe('House new page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockListBuildings.mockResolvedValue({ items: [{ id: 10, name: '1 栋', estate_id: 1 }], total: 1, page: 1, page_size: 100 });
    mockListContacts.mockResolvedValue({ items: [{ id: 20, name: '张房东', roles: ['landlord'] }], total: 1, page: 1, page_size: 100 });
    mockCreateHouse.mockResolvedValue({ id: 99 });
  });

  it('creates a house with the first building and landlord as defaults', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    await waitFor(() => expect(mockListBuildings).toHaveBeenCalledTimes(1));
    await screen.findByText('1 栋');
    fireEvent.change(screen.getByLabelText('房号'), { target: { value: '1801' } });
    fireEvent.change(screen.getByLabelText('挂牌租金'), { target: { value: '4200' } });
    fireEvent.click(screen.getByRole('button', { name: '保存房源' }));

    await waitFor(() => expect(mockCreateHouse).toHaveBeenCalledWith(expect.objectContaining({
      building_id: 10,
      landlord_id: 20,
      room_number: '1801',
      asking_rent: '4200',
    })));
    expect(mockPush).toHaveBeenCalledWith('/property-rental/houses/99');
  });
});
