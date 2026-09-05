import { request } from '@umijs/max';
import type { LeaseAllocation } from './allocation';
import {
  appsHouseApiCreateBuilding,
  appsHouseApiCreateContact,
  appsHouseApiCreateEstate,
  appsHouseApiCreateHouse,
  appsHouseApiCreateLease,
  appsHouseApiCreateViewingRecord,
  appsHouseApiCheckBuildingDelete,
  appsHouseApiCheckEstateDelete,
  appsHouseApiDeleteBuildingEndpoint,
  appsHouseApiDeleteEstateEndpoint,
  appsHouseApiGetBuilding,
  appsHouseApiGetBuildingMapDetail,
  appsHouseApiGetBuildingMapUnlocatedCount,
  appsHouseApiGetContact,
  appsHouseApiGetDefaultBuilding,
  appsHouseApiGetEstate,
  appsHouseApiGetHouse,
  appsHouseApiGetLease,
  appsHouseApiGetPropertyRentalTagSuggestions,
  appsHouseApiGetStaffResponsibility,
  appsHouseApiGetViewingRecord,
  appsHouseApiListBuildings,
  appsHouseApiListBuildingMap,
  appsHouseApiListBuildingMapUnlocated,
  appsHouseApiListContacts,
  appsHouseApiListEstateMap,
  appsHouseApiListEstates,
  appsHouseApiListHouses,
  appsHouseApiListLeases,
  appsHouseApiListStaffResponsibilities,
  appsHouseApiListViewingRecords,
  appsHouseApiPatchBuilding,
  appsHouseApiPatchContact,
  appsHouseApiPatchEstate,
  appsHouseApiPatchHouse,
  appsHouseApiPatchLease,
  appsHouseApiPatchViewingRecord,
  appsHouseApiPutDefaultBuilding,
  appsHouseApiReplaceStaffResponsibilities,
  appsHouseApiVacancySync,
} from '@/services/openapi/propertyRentalManagement';

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type InventoryCounts = {
  total: number;
  vacant: number;
  listed: number;
  rented: number;
  renovating: number;
};

export type EstateOut = API.EstateOut & {
  building_count?: number;
  counts?: InventoryCounts;
  property_type__mapping?: string;
};
export type BuildingOut = API.BuildingOut & {
  counts?: InventoryCounts;
};
export type BuildingMapMarkerOut = API.BuildingMapMarkerOut;
export type BuildingMapDetailOut = API.BuildingMapDetailOut;
export type EstateMapMarkerOut = API.EstateMapMarkerOut;
export type BuildingMapUnlocatedOut = API.BuildingMapUnlocatedOut;
export type DefaultBuildingOut = API.DefaultBuildingOut;
export type DeleteCheckOut = API.DeleteCheckOut;
export type ContactOut = API.ContactOut & {
  landlord_binding_status?: 'unbound' | 'invited' | 'bound' | null;
  landlord_invite_expires_at?: string | null;
  public_key?: string | null;
  roles__mapping?: string[];
  user_id?: number | null;
};
export type HouseOut = API.HouseOut;
export type HouseCreateInput = API.HouseIn;
export type HouseListParams = API.appsHouseApiListHousesParams;
export type HousePatchInput = API.HousePatchIn;
export type ViewingRecordOut = API.ViewingRecordOut & {
  status__mapping?: string;
};
export type LeaseOut = API.LeaseOut & {
  status__mapping?: string;
};
export type PropertyResponsibilityOut = API.PropertyResponsibilityMemberOut;
export type PropertyResponsibilityUpdateIn = API.PropertyResponsibilityUpdateIn;
export type VacancySyncInput = API.VacancySyncIn;
export type VacancySyncResult = API.VacancySyncOut;
export type VacancySyncBlock = API.VacancySyncBlockOut;
export type VacancySyncLine = API.VacancySyncLineOut;

export type HouseMatchMode = 'manual' | 'dynamic';

export type HouseMatchCriteria = {
  keyword?: string;
  province?: string;
  city?: string;
  district?: string;
  min_rent?: number;
  max_rent?: number;
  min_area?: number;
  max_area?: number;
  bedrooms?: number;
  living_rooms?: number;
  decoration?: string;
  has_elevator_access?: boolean;
  tags?: string[];
  sort?: 'latest' | 'rent_asc' | 'rent_desc' | 'area_asc' | 'area_desc';
};

export type HouseMatchShareCreateInput = {
  title: string;
  remark?: string;
  mode: HouseMatchMode;
  house_ids?: number[];
  criteria?: HouseMatchCriteria;
  expires_at?: string | null;
};

export type HouseMatchShareCreateResult = {
  share_key: string;
  share_url: string;
  expires_at: string | null;
  created_at: string;
};

export type HouseMatchShareStatus = 'active' | 'expired' | 'revoked';

export type HouseMatchShareListItem = {
  id: number;
  share_key: string;
  share_url: string;
  title: string;
  mode: HouseMatchMode;
  status: HouseMatchShareStatus;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_accessed_at: string | null;
  created_at: string;
};

export type HouseMatchShareExtendInput = {
  expires_at: string;
};

export type LandlordInvitation = {
  organization_name: string;
  contact_name: string;
  invitee_phone_masked: string;
  expires_at: string;
  action_url?: string | null;
};

export type LandlordInvitationDelivery = 'sms' | 'manual';

export type LandlordInvitationAcceptResult = {
  contact_id: number;
  organization_id: number;
  organization_name: string;
  public_key: string;
};

export type LandlordRelationship = {
  contact_id: number;
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  contact_name: string;
  house_count: number;
  public_house_count: number;
  public_key: string;
  public_url: string;
};

export type LandlordHouse = {
  id: number;
  building_id: number;
  building: {
    id: number;
    name: string;
    address: string;
    estate?: {
      id: number;
      name: string;
      display_name?: string;
    } | null;
  };
  landlord_id?: number | null;
  room_number: string;
  floor?: number | null;
  area?: string | number | null;
  interior_area?: string | number | null;
  asking_rent?: string | number | null;
  deposit_amount?: string | number | null;
  bedrooms?: number | null;
  living_rooms?: number | null;
  bathrooms?: number | null;
  kitchens?: number | null;
  balconies?: number | null;
  orientation?: string | null;
  orientation__mapping?: string;
  decoration?: string | null;
  decoration__mapping?: string;
  has_elevator_access: boolean;
  status: string;
  status__mapping?: string;
  images: PublicMediaRef[];
  videos: PublicMediaRef[];
  tags: string[];
  effective_tags: string[];
  public_description: string;
};

export type PublicMediaRef = {
  media_id?: number;
  url?: string;
  thumbnail?: string | null;
  original_filename?: string;
};

export type PublicLandlordProfile = {
  public_key: string;
  name: string;
  avatar: PublicMediaRef[];
  phone: string;
  organization: {
    slug: string;
    name: string;
    logo: PublicMediaRef[];
    description: string;
  };
  house_count: number;
};

export type PublicLandlordHouse = {
  id: number;
  room_number: string;
  floor?: number | null;
  area?: string | number | null;
  interior_area?: string | number | null;
  asking_rent?: string | number | null;
  deposit_amount?: string | number | null;
  bedrooms?: number | null;
  living_rooms?: number | null;
  bathrooms?: number | null;
  kitchens?: number | null;
  balconies?: number | null;
  orientation?: string | null;
  orientation__mapping?: string;
  decoration?: string | null;
  decoration__mapping?: string;
  has_elevator_access: boolean;
  images: PublicMediaRef[];
  videos?: PublicMediaRef[];
  tags: string[];
  effective_tags: string[];
  public_description: string;
  building: {
    id: number;
    name: string;
    address: string;
    lat?: string | number | null;
    lng?: string | number | null;
    estate?: {
      id: number;
      name: string;
      display_name: string;
      province: string;
      city: string;
      district: string;
      address: string;
    } | null;
  };
  publisher: PublicLandlordProfile['organization'];
  updated_at: string;
};

type QueryParams = Record<string, unknown>;
type Payload = Record<string, unknown>;

export type DealSigningTenantInput =
  | { tenant_id: number; tenant_identity?: never }
  | {
      tenant_id?: never;
      tenant_identity: { name: string; phone: string };
    };

export type DealSigningCreateInput = {
  lease: DealSigningTenantInput & {
    house_id: number;
    source_viewing_record_id?: number | null;
    sign_at?: string | null;
    start_date: string;
    end_date: string;
    monthly_rent: string;
    deposit?: string | null;
    payment_day: number;
    contract_files?: Record<string, unknown>[];
    notes?: string;
    extra?: Record<string, unknown>;
  };
  team_id?: number | null;
  beneficiary_user_ids: number[];
};

export const houseApi = {
  listEstates: (params?: QueryParams) =>
    appsHouseApiListEstates((params ?? {}) as API.appsHouseApiListEstatesParams) as Promise<PageResult<EstateOut>>,
  getEstate: (estateId: number) => appsHouseApiGetEstate({ estate_id: estateId }) as Promise<EstateOut>,
  createEstate: (data: Payload) => appsHouseApiCreateEstate(data as API.EstateIn) as Promise<EstateOut>,
  patchEstate: (estateId: number, data: Payload) =>
    appsHouseApiPatchEstate({ estate_id: estateId }, data as API.EstatePatchIn) as Promise<EstateOut>,
  checkEstateDelete: (estateId: number) => appsHouseApiCheckEstateDelete({ estate_id: estateId }) as Promise<DeleteCheckOut>,
  deleteEstate: (estateId: number) => appsHouseApiDeleteEstateEndpoint({ estate_id: estateId }, { skipErrorHandler: true }),

  listBuildings: (params?: QueryParams) =>
    appsHouseApiListBuildings((params ?? {}) as API.appsHouseApiListBuildingsParams) as Promise<PageResult<BuildingOut>>,
  getBuilding: (buildingId: number) => appsHouseApiGetBuilding({ building_id: buildingId }) as Promise<BuildingOut>,
  createBuilding: (data: Payload) => appsHouseApiCreateBuilding(data as API.BuildingIn) as Promise<BuildingOut>,
  patchBuilding: (buildingId: number, data: Payload) =>
    appsHouseApiPatchBuilding({ building_id: buildingId }, data as API.BuildingPatchIn) as Promise<BuildingOut>,
  checkBuildingDelete: (buildingId: number) => appsHouseApiCheckBuildingDelete({ building_id: buildingId }) as Promise<DeleteCheckOut>,
  deleteBuilding: (buildingId: number) => appsHouseApiDeleteBuildingEndpoint({ building_id: buildingId }, { skipErrorHandler: true }),
  getDefaultBuilding: () => appsHouseApiGetDefaultBuilding() as Promise<DefaultBuildingOut>,
  setDefaultBuilding: (buildingId: number) =>
    appsHouseApiPutDefaultBuilding({ building_id: buildingId }) as Promise<DefaultBuildingOut>,
  listBuildingMap: (params?: QueryParams) =>
    appsHouseApiListBuildingMap((params ?? {}) as API.appsHouseApiListBuildingMapParams) as Promise<PageResult<BuildingMapMarkerOut>>,
  listEstateMap: (params?: QueryParams) =>
    appsHouseApiListEstateMap((params ?? {}) as API.appsHouseApiListEstateMapParams) as Promise<PageResult<EstateMapMarkerOut>>,
  getBuildingMapDetail: (buildingId: number) => appsHouseApiGetBuildingMapDetail({ building_id: buildingId }) as Promise<BuildingMapDetailOut>,
  getBuildingMapUnlocatedCount: () => appsHouseApiGetBuildingMapUnlocatedCount() as Promise<API.BuildingMapUnlocatedCountOut>,
  listBuildingMapUnlocated: (params?: QueryParams) =>
    appsHouseApiListBuildingMapUnlocated((params ?? {}) as API.appsHouseApiListBuildingMapUnlocatedParams) as Promise<PageResult<BuildingMapUnlocatedOut>>,
  getTagSuggestions: () => appsHouseApiGetPropertyRentalTagSuggestions() as Promise<API.TagSuggestionsOut>,
  vacancySync: (data: VacancySyncInput) => appsHouseApiVacancySync(data) as Promise<VacancySyncResult>,

  listContacts: (params?: QueryParams) =>
    appsHouseApiListContacts((params ?? {}) as API.appsHouseApiListContactsParams) as Promise<PageResult<ContactOut>>,
  getContact: (contactId: number) => appsHouseApiGetContact({ contact_id: contactId }) as Promise<ContactOut>,
  createContact: (data: Payload) => appsHouseApiCreateContact(data as API.ContactIn) as Promise<ContactOut>,
  patchContact: (contactId: number, data: Payload) =>
    appsHouseApiPatchContact({ contact_id: contactId }, data as API.ContactPatchIn) as Promise<ContactOut>,
  inviteLandlord: (
    contactId: number,
    deliveryMethod: LandlordInvitationDelivery = 'sms',
  ) =>
    request<LandlordInvitation>(
      `/api/house/contacts/${contactId}/landlord-invite/`,
      { method: 'POST', params: { delivery_method: deliveryMethod } },
    ),

  getLandlordInvitation: (token: string) =>
    request<LandlordInvitation>(
      `/api/house/landlord/invites/${encodeURIComponent(token)}/`,
    ),
  acceptLandlordInvitation: (token: string) =>
    request<LandlordInvitationAcceptResult>(
      `/api/house/landlord/invites/${encodeURIComponent(token)}/accept/`,
      { method: 'POST' },
    ),
  listLandlordRelationships: () =>
    request<LandlordRelationship[]>('/api/house/landlord/relationships/'),
  listLandlordHouses: (contactId: number, params?: QueryParams) =>
    request<PageResult<LandlordHouse>>(
      `/api/house/landlord/contacts/${contactId}/houses/`,
      { params },
    ),
  listLandlordLeases: (contactId: number, params?: QueryParams) =>
    request<PageResult<LeaseOut>>(
      `/api/house/landlord/contacts/${contactId}/leases/`,
      { params },
    ),
  getPublicLandlordProfile: (publicKey: string) =>
    request<PublicLandlordProfile>(
      `/api/public/landlords/${encodeURIComponent(publicKey)}/`,
    ),
  listPublicLandlordHouses: (publicKey: string, params?: QueryParams) =>
    request<PageResult<PublicLandlordHouse>>(
      `/api/public/landlords/${encodeURIComponent(publicKey)}/houses/`,
      { params },
    ),
  getPublicLandlordHouse: (publicKey: string, houseId: number) =>
    request<PublicLandlordHouse>(
      `/api/public/landlords/${encodeURIComponent(publicKey)}/houses/${houseId}/`,
    ),

  listStaffResponsibilities: (params?: QueryParams) =>
    appsHouseApiListStaffResponsibilities((params ?? {}) as API.appsHouseApiListStaffResponsibilitiesParams) as Promise<PageResult<PropertyResponsibilityOut>>,
  getStaffResponsibility: (memberId: number) =>
    appsHouseApiGetStaffResponsibility({ member_id: memberId }) as Promise<PropertyResponsibilityOut>,
  replaceStaffResponsibilities: (
    memberId: number,
    data: PropertyResponsibilityUpdateIn,
  ) =>
    appsHouseApiReplaceStaffResponsibilities(
      { member_id: memberId },
      data,
    ) as Promise<PropertyResponsibilityOut>,

  listHouses: (params: HouseListParams = {}) => appsHouseApiListHouses(params),
  getHouse: (houseId: number) => appsHouseApiGetHouse({ house_id: houseId }) as Promise<HouseOut>,
  createHouse: (data: HouseCreateInput) => appsHouseApiCreateHouse(data),
  patchHouse: (houseId: number, data: HousePatchInput) => appsHouseApiPatchHouse({ house_id: houseId }, data),
  createHouseMatchShare: (data: HouseMatchShareCreateInput) =>
    request<HouseMatchShareCreateResult>('/api/house-match-shares/', {
      method: 'POST',
      data,
    }),
  listHouseMatchShares: (params: { page?: number; page_size?: number } = {}) =>
    request<PageResult<HouseMatchShareListItem>>('/api/house-match-shares/', {
      method: 'GET',
      params,
    }),
  extendHouseMatchShare: (
    shareId: number,
    data: HouseMatchShareExtendInput,
  ) =>
    request<HouseMatchShareListItem>(
      `/api/house-match-shares/${shareId}/extend/`,
      { method: 'POST', data },
    ),
  revokeHouseMatchShare: (shareId: number) =>
    request<HouseMatchShareListItem>(
      `/api/house-match-shares/${shareId}/revoke/`,
      { method: 'POST' },
    ),

  listViewingRecords: (params?: QueryParams) =>
    appsHouseApiListViewingRecords(
      (params ?? {}) as API.appsHouseApiListViewingRecordsParams,
    ) as Promise<PageResult<ViewingRecordOut>>,
  getViewingRecord: (recordId: number) => appsHouseApiGetViewingRecord({ record_id: recordId }) as Promise<ViewingRecordOut>,
  createViewingRecord: (data: Payload) => appsHouseApiCreateViewingRecord(data as API.ViewingRecordIn) as Promise<ViewingRecordOut>,
  patchViewingRecord: (recordId: number, data: Payload) =>
    appsHouseApiPatchViewingRecord(
      { record_id: recordId },
      data as API.ViewingRecordPatchIn,
    ) as Promise<ViewingRecordOut>,

  listLeases: (params?: QueryParams) =>
    appsHouseApiListLeases((params ?? {}) as API.appsHouseApiListLeasesParams) as Promise<PageResult<LeaseOut>>,
  getLease: (leaseId: number) => appsHouseApiGetLease({ lease_id: leaseId }) as Promise<LeaseOut>,
  createLease: (data: Payload) => appsHouseApiCreateLease(data as API.LeaseIn) as Promise<LeaseOut>,
  createDealSigning: (data: DealSigningCreateInput) =>
    request<LeaseAllocation>('/api/house/leases/deal-signing/', {
      method: 'POST',
      data,
    }),
  patchLease: (leaseId: number, data: Payload) =>
    appsHouseApiPatchLease({ lease_id: leaseId }, data as API.LeasePatchIn) as Promise<LeaseOut>,
};
