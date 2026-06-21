import { request } from '@umijs/max';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface EstateOut {
  id: number;
  name: string;
  display_name: string;
  property_type: string;
  province: string;
  city: string;
  district: string;
  address: string;
  lat?: string | null;
  lng?: string | null;
  images: Record<string, unknown>[];
  description?: string;
  is_active: boolean;
}

export interface BuildingOut {
  id: number;
  estate_id: number;
  name: string;
  floors: number;
  under_floors?: number | null;
  year_built?: number | null;
  elevator: boolean;
  lat?: string | null;
  lng?: string | null;
  address: string;
  is_active: boolean;
}

export interface ContactOut {
  id: number;
  name: string;
  phone: string;
  email: string;
  roles: string[];
  user_id?: number | null;
  notes: string;
  is_active: boolean;
}

export interface HouseOut {
  id: number;
  building_id: number;
  landlord_id?: number | null;
  room_number: string;
  floor?: number | null;
  area?: string | null;
  interior_area?: string | null;
  asking_rent?: string | null;
  deposit_amount?: string | null;
  available_from?: string | null;
  bedrooms?: number | null;
  living_rooms?: number | null;
  bathrooms?: number | null;
  kitchens?: number | null;
  balconies?: number | null;
  orientation?: string | null;
  decoration?: string | null;
  has_elevator_access: boolean;
  status: string;
  publish_status: string;
  images: Record<string, unknown>[];
  videos: Record<string, unknown>[];
  tags: string[];
  public_description: string;
  internal_notes: string;
  extra: Record<string, unknown>;
  is_active: boolean;
}

export interface ViewingRecordOut {
  id: number;
  house_id: number;
  contact_id?: number | null;
  customer_name: string;
  customer_phone: string;
  scheduled_at: string;
  viewed_at?: string | null;
  status: string;
  assigned_to_id?: number | null;
  notes: string;
  extra?: Record<string, unknown>;
  is_active: boolean;
}

export interface LeaseOut {
  id: number;
  house_id: number;
  tenant_id: number;
  source_viewing_record_id?: number | null;
  sign_at?: string | null;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  deposit?: string | null;
  payment_day: number;
  status: string;
  contract_files: Record<string, unknown>[];
  notes: string;
  extra?: Record<string, unknown>;
}

const list = <T>(url: string, params?: Record<string, unknown>) => request<PageResult<T>>(url, { method: 'GET', params });
const create = <T>(url: string, data: Record<string, unknown>) => request<T>(url, { method: 'POST', data });
const patch = <T>(url: string, data: Record<string, unknown>) => request<T>(url, { method: 'PATCH', data });

export const houseApi = {
  listEstates: (params?: Record<string, unknown>) => list<EstateOut>('/api/house/estates/', params),
  getEstate: (estateId: number) => request<EstateOut>(`/api/house/estates/${estateId}/`, { method: 'GET' }),
  createEstate: (data: Record<string, unknown>) => create<EstateOut>('/api/house/estates/', data),
  patchEstate: (estateId: number, data: Record<string, unknown>) => patch<EstateOut>(`/api/house/estates/${estateId}/`, data),
  listBuildings: (params?: Record<string, unknown>) => list<BuildingOut>('/api/house/buildings/', params),
  getBuilding: (buildingId: number) => request<BuildingOut>(`/api/house/buildings/${buildingId}/`, { method: 'GET' }),
  createBuilding: (data: Record<string, unknown>) => create<BuildingOut>('/api/house/buildings/', data),
  patchBuilding: (buildingId: number, data: Record<string, unknown>) => patch<BuildingOut>(`/api/house/buildings/${buildingId}/`, data),
  listContacts: (params?: Record<string, unknown>) => list<ContactOut>('/api/house/contacts/', params),
  getContact: (contactId: number) => request<ContactOut>(`/api/house/contacts/${contactId}/`, { method: 'GET' }),
  createContact: (data: Record<string, unknown>) => create<ContactOut>('/api/house/contacts/', data),
  patchContact: (contactId: number, data: Record<string, unknown>) => patch<ContactOut>(`/api/house/contacts/${contactId}/`, data),
  listHouses: (params?: Record<string, unknown>) => list<HouseOut>('/api/house/houses/', params),
  getHouse: (houseId: number) => request<HouseOut>(`/api/house/houses/${houseId}/`, { method: 'GET' }),
  createHouse: (data: Record<string, unknown>) => create<HouseOut>('/api/house/houses/', data),
  patchHouse: (houseId: number, data: Record<string, unknown>) => patch<HouseOut>(`/api/house/houses/${houseId}/`, data),
  listViewingRecords: (params?: Record<string, unknown>) => list<ViewingRecordOut>('/api/house/viewing-records/', params),
  createViewingRecord: (data: Record<string, unknown>) => create<ViewingRecordOut>('/api/house/viewing-records/', data),
  patchViewingRecord: (recordId: number, data: Record<string, unknown>) => patch<ViewingRecordOut>(`/api/house/viewing-records/${recordId}/`, data),
  listLeases: (params?: Record<string, unknown>) => list<LeaseOut>('/api/house/leases/', params),
  getLease: (leaseId: number) => request<LeaseOut>(`/api/house/leases/${leaseId}/`, { method: 'GET' }),
  createLease: (data: Record<string, unknown>) => create<LeaseOut>('/api/house/leases/', data),
  patchLease: (leaseId: number, data: Record<string, unknown>) => patch<LeaseOut>(`/api/house/leases/${leaseId}/`, data),
};
