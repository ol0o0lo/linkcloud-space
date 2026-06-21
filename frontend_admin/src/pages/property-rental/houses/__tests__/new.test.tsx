import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseNewPage from '../new';

const { mockPush, mockListEstates, mockListBuildings, mockGetDefaultBuilding, mockSetDefaultBuilding, mockListContacts, mockCreateBuilding, mockCreateHouse } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockGetDefaultBuilding: vi.fn(),
  mockSetDefaultBuilding: vi.fn(),
  mockListContacts: vi.fn(),
  mockCreateBuilding: vi.fn(),
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
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    getDefaultBuilding: mockGetDefaultBuilding,
    setDefaultBuilding: mockSetDefaultBuilding,
    listContacts: mockListContacts,
    createBuilding: mockCreateBuilding,
    createHouse: mockCreateHouse,
  },
}));

describe('House new page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: '星河湾' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 10, name: '1 栋', estate_id: 1 }], total: 1, page: 1, page_size: 100 });
    mockGetDefaultBuilding.mockResolvedValue({ id: 10, name: '1 栋', estate_id: 1, estate_name: '星河湾', floors: 20, address: '' });
    mockSetDefaultBuilding.mockResolvedValue({ id: 11, name: '2 栋', estate_id: 1, estate_name: '星河湾', floors: 28, address: '' });
    mockListContacts.mockResolvedValue({ items: [{ id: 20, name: '张房东', roles: ['landlord'] }], total: 1, page: 1, page_size: 100 });
    mockCreateBuilding.mockResolvedValue({ id: 11, name: '2 栋', estate_id: 1 });
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

  it('creates a building in a dialog and keeps the house form on one page', async () => {
    render(<QueryClientProvider client={new QueryClient()}><HouseNewPage /></QueryClientProvider>);

    expect(screen.queryByText('基础资料')).not.toBeInTheDocument();
    await screen.findByText('1 栋');

    fireEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    fireEvent.change(screen.getByLabelText('楼栋名'), { target: { value: '2 栋' } });
    fireEvent.change(screen.getByLabelText('楼层'), { target: { value: '28' } });
    fireEvent.click(screen.getByRole('button', { name: '保存楼栋' }));

    await waitFor(() => expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({
      estate_id: 1,
      name: '2 栋',
      floors: 28,
    })));
    expect(mockSetDefaultBuilding).toHaveBeenCalledWith(11);
    await screen.findByText('2 栋');
  });
});
