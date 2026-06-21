import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContactsPage from '../contacts';
import EstatesPage from '../estates';
import LeasesPage from '../leases';
import ViewingsPage from '../viewings';

const { mockListEstates, mockListBuildings, mockListContacts, mockListViewings, mockListLeases } = vi.hoisted(() => ({
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
}));

vi.mock('@/pages/tenant/shared', () => ({
  TenantSelectionGuard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org', queryClient: new QueryClient() }),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
  },
}));

const renderPage = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

describe('Property rental domain list pages', () => {
  beforeEach(() => {
    mockListEstates.mockResolvedValue({ items: [{ id: 1, name: '星河湾', city: '深圳', district: '南山', address: '科技路' }], total: 1, page: 1, page_size: 100 });
    mockListBuildings.mockResolvedValue({ items: [{ id: 2, estate_id: 1, name: '1 栋', floors: 32, elevator: true }], total: 1, page: 1, page_size: 100 });
    mockListContacts.mockResolvedValue({ items: [{ id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'] }], total: 1, page: 1, page_size: 100 });
    mockListViewings.mockResolvedValue({ items: [{ id: 4, house_id: 99, customer_name: '李客户', customer_phone: '13900000000', scheduled_at: '2026-07-01T10:00:00+08:00', status: 'scheduled' }], total: 1, page: 1, page_size: 100 });
    mockListLeases.mockResolvedValue({ items: [{ id: 5, house_id: 99, tenant_id: 6, start_date: '2026-07-01', end_date: '2027-06-30', monthly_rent: '4200.00', status: 'active', contract_files: [] }], total: 1, page: 1, page_size: 100 });
  });

  it('shows estate and building rows', async () => {
    renderPage(<EstatesPage />);

    expect(await screen.findByText('星河湾')).toBeInTheDocument();
    expect(await screen.findByText('1 栋')).toBeInTheDocument();
  });

  it('shows contact rows', async () => {
    renderPage(<ContactsPage />);

    expect(await screen.findByText('张房东')).toBeInTheDocument();
  });

  it('shows viewing rows', async () => {
    renderPage(<ViewingsPage />);

    expect(await screen.findByText('李客户')).toBeInTheDocument();
  });

  it('shows lease rows', async () => {
    renderPage(<LeasesPage />);

    expect(await screen.findByText('4200.00')).toBeInTheDocument();
  });
});
