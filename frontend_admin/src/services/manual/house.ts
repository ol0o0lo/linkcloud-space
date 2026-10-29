import { request } from '@umijs/max';
import {
  appsHouseApiPropertiesCreateBuilding,
  appsHouseApiContactsCreateContact,
  appsHouseApiPropertiesCreateEstate,
  appsHouseApiPropertiesCreateHouse,
  appsHouseApiLeasesCreateLease,
  appsHouseApiViewingsCreateViewingRecord,
  appsHouseApiPropertiesCheckBuildingDelete,
  appsHouseApiPropertiesCheckEstateDelete,
  appsHouseApiPropertiesDeleteBuildingEndpoint,
  appsHouseApiPropertiesDeleteEstateEndpoint,
  appsHouseApiPropertiesGetBuilding,
  appsHouseApiMapsGetBuildingMapDetail,
  appsHouseApiMapsGetBuildingMapUnlocatedCount,
  appsHouseApiContactsGetContact,
  appsHouseApiPropertiesGetDefaultBuilding,
  appsHouseApiPropertiesGetEstate,
  appsHouseApiPropertiesGetHouse,
  appsHouseApiLeasesGetLease,
  appsHouseApiPropertiesGetPropertyRentalTagSuggestions,
  appsHouseApiResponsibilitiesGetStaffResponsibility,
  appsHouseApiViewingsGetViewingRecord,
  appsHouseApiPropertiesListBuildings,
  appsHouseApiMapsListBuildingMap,
  appsHouseApiMapsListBuildingMapUnlocated,
  appsHouseApiContactsListContacts,
  appsHouseApiMapsListEstateMap,
  appsHouseApiPropertiesListEstates,
  appsHouseApiPropertiesListHouses,
  appsHouseApiLeasesListLeases,
  appsHouseApiResponsibilitiesListStaffResponsibilities,
  appsHouseApiViewingsListViewingRecords,
  appsHouseApiPropertiesPatchBuilding,
  appsHouseApiContactsPatchContact,
  appsHouseApiPropertiesPatchEstate,
  appsHouseApiPropertiesPatchHouse,
  appsHouseApiLeasesPatchLease,
  appsHouseApiViewingsPatchViewingRecord,
  appsHouseApiPropertiesPutDefaultBuilding,
  appsHouseApiResponsibilitiesReplaceStaffResponsibilities,
  appsHouseApiPropertiesVacancySync,
} from '@/services/openapi/propertyRentalManagement';

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type InventoryCounts = {
  total: number;
  paused: number;
  listed: number;
  rented: number;

};

export type EstateOut = API.EstateOut & {
  building_count?: number;
  counts?: InventoryCounts;
  property_type__mapping?: string;
};
export type BuildingOut = API.BuildingOut & {
  counts?: InventoryCounts;
  migration_media?: (MigrationMediaRef | Record<string, unknown>)[];
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
export type MigrationMediaRef = { id: string; field: string; position: number; url: string | null; media_type: string; status: string; media_file_id?: number | null; source_meta?: { field_path?: string; related_field?: string } };
export type MigrationMediaSource = { migration_media?: (MigrationMediaRef | Record<string, unknown>)[] };
export type HouseOut = API.HouseOut & MigrationMediaSource;
function withoutMigrationMedia({ migration_media: _migrationMedia, ...data }: Record<string, unknown>) {
  return data;
}
export type HouseAIInsightState = 'not_generated' | 'fresh' | 'expired';
export type HouseAIInsightFact = {
  id: string;
  label: string;
  value: string;
};
export type HouseAIInsightText = {
  text: string;
  fact_ids: string[];
};
export type HouseAIInsightSignal = {
  label: string;
  value: string;
  tone: 'positive' | 'neutral' | 'caution';
  fact_ids: string[];
};
export type HouseAIInsightViewingQuestion = {
  text: string;
  fact_ids: string[];
  missing_field_keys: string[];
};
export type HouseAIInsightResult = {
  schema_version: number;
  conclusion: HouseAIInsightText;
  signals: HouseAIInsightSignal[];
  appeal_points: HouseAIInsightText[];
  viewing_questions: HouseAIInsightViewingQuestion[];
  missing_fields: Array<{ key: string; label: string }>;
  facts: HouseAIInsightFact[];
};
export type HouseAIInsightResponse = {
  state: HouseAIInsightState;
  insight: HouseAIInsightResult | null;
  generated_at: string | null;
  expires_at: string | null;
  source_changed: boolean;
};
export type HouseCreateInput = API.HouseIn;
export type HouseListParams = API.appsHouseApiPropertiesListHousesParams;
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
  migration_media?: MigrationMediaRef[];
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
  is_active: boolean;

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
  migration_media?: MigrationMediaRef[];
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
  distance_m?: number | null;
  building: {
    id: number;
    name: string;
    address: string;
    location?: {
      latitude: number;
      longitude: number;
      coordinate_system: 'gcj02';
    } | null;
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
  client_request_id?: string;
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
};

export const houseApi = {
  getCustomerCapabilities: () => request<{ can_manage: boolean }>('/api/house/customer-capabilities/'),
  listCorrectionTeams: () => request<PageResult<{ id: number; name: string }>>('/api/teams/', { params: { page: 1, page_size: 500 } }),
  listEstates: (params?: QueryParams) =>
    appsHouseApiPropertiesListEstates((params ?? {}) as API.appsHouseApiPropertiesListEstatesParams) as Promise<PageResult<EstateOut>>,
  getEstate: (estateId: number) => appsHouseApiPropertiesGetEstate({ estate_id: estateId }) as Promise<EstateOut>,
  createEstate: (data: Payload) => appsHouseApiPropertiesCreateEstate(data as API.EstateIn) as Promise<EstateOut>,
  patchEstate: (estateId: number, data: Payload) =>
    appsHouseApiPropertiesPatchEstate({ estate_id: estateId }, data as API.EstatePatchIn) as Promise<EstateOut>,
  checkEstateDelete: (estateId: number) => appsHouseApiPropertiesCheckEstateDelete({ estate_id: estateId }) as Promise<DeleteCheckOut>,
  deleteEstate: (estateId: number) => appsHouseApiPropertiesDeleteEstateEndpoint({ estate_id: estateId }, { skipErrorHandler: true }),

  listBuildings: (params?: QueryParams) =>
    appsHouseApiPropertiesListBuildings((params ?? {}) as API.appsHouseApiPropertiesListBuildingsParams) as Promise<PageResult<BuildingOut>>,
  getBuilding: (buildingId: number) => appsHouseApiPropertiesGetBuilding({ building_id: buildingId }) as Promise<BuildingOut>,
  createBuilding: (data: Payload) => appsHouseApiPropertiesCreateBuilding(withoutMigrationMedia(data) as API.BuildingIn) as Promise<BuildingOut>,
  patchBuilding: (buildingId: number, data: Payload) =>
    appsHouseApiPropertiesPatchBuilding({ building_id: buildingId }, withoutMigrationMedia(data) as API.BuildingPatchIn) as Promise<BuildingOut>,
  checkBuildingDelete: (buildingId: number) => appsHouseApiPropertiesCheckBuildingDelete({ building_id: buildingId }) as Promise<DeleteCheckOut>,
  deleteBuilding: (buildingId: number) => appsHouseApiPropertiesDeleteBuildingEndpoint({ building_id: buildingId }, { skipErrorHandler: true }),
  getDefaultBuilding: () => appsHouseApiPropertiesGetDefaultBuilding() as Promise<DefaultBuildingOut>,
  setDefaultBuilding: (buildingId: number) =>
    appsHouseApiPropertiesPutDefaultBuilding({ building_id: buildingId }) as Promise<DefaultBuildingOut>,
  listBuildingMap: (params?: QueryParams) =>
    appsHouseApiMapsListBuildingMap((params ?? {}) as API.appsHouseApiMapsListBuildingMapParams) as Promise<PageResult<BuildingMapMarkerOut>>,
  listEstateMap: (params?: QueryParams) =>
    appsHouseApiMapsListEstateMap((params ?? {}) as API.appsHouseApiMapsListEstateMapParams) as Promise<PageResult<EstateMapMarkerOut>>,
  getBuildingMapDetail: (buildingId: number) => appsHouseApiMapsGetBuildingMapDetail({ building_id: buildingId }) as Promise<BuildingMapDetailOut>,
  getBuildingMapUnlocatedCount: () => appsHouseApiMapsGetBuildingMapUnlocatedCount() as Promise<API.BuildingMapUnlocatedCountOut>,
  listBuildingMapUnlocated: (params?: QueryParams) =>
    appsHouseApiMapsListBuildingMapUnlocated((params ?? {}) as API.appsHouseApiMapsListBuildingMapUnlocatedParams) as Promise<PageResult<BuildingMapUnlocatedOut>>,
  getTagSuggestions: () => appsHouseApiPropertiesGetPropertyRentalTagSuggestions() as Promise<API.TagSuggestionsOut>,
  vacancySync: (data: VacancySyncInput) => appsHouseApiPropertiesVacancySync(data) as Promise<VacancySyncResult>,

  listContacts: (params?: QueryParams) =>
    appsHouseApiContactsListContacts((params ?? {}) as API.appsHouseApiContactsListContactsParams) as Promise<PageResult<ContactOut>>,
  getContact: (contactId: number) => appsHouseApiContactsGetContact({ contact_id: contactId }) as Promise<ContactOut>,
  createContact: (data: Payload) => appsHouseApiContactsCreateContact(data as API.ContactIn) as Promise<ContactOut>,
  patchContact: (contactId: number, data: Payload) =>
    appsHouseApiContactsPatchContact({ contact_id: contactId }, data as API.ContactPatchIn) as Promise<ContactOut>,
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
    appsHouseApiResponsibilitiesListStaffResponsibilities((params ?? {}) as API.appsHouseApiResponsibilitiesListStaffResponsibilitiesParams) as Promise<PageResult<PropertyResponsibilityOut>>,
  getStaffResponsibility: (memberId: number) =>
    appsHouseApiResponsibilitiesGetStaffResponsibility({ member_id: memberId }) as Promise<PropertyResponsibilityOut>,
  replaceStaffResponsibilities: (
    memberId: number,
    data: PropertyResponsibilityUpdateIn,
  ) =>
    appsHouseApiResponsibilitiesReplaceStaffResponsibilities(
      { member_id: memberId },
      data,
    ) as Promise<PropertyResponsibilityOut>,

  listHouses: (params: HouseListParams = {}) => appsHouseApiPropertiesListHouses(params),
  getHouse: (houseId: number) => appsHouseApiPropertiesGetHouse({ house_id: houseId }) as Promise<HouseOut>,
  getHouseAIInsight: (houseId: number) =>
    request<HouseAIInsightResponse>(`/api/house/houses/${houseId}/ai-insight/`, {
      skipErrorHandler: true,
    }),
  generateHouseAIInsight: (houseId: number) =>
    request<HouseAIInsightResponse>(`/api/house/houses/${houseId}/ai-insight/generate/`, {
      method: 'POST',
      skipErrorHandler: true,
    }),
  createHouse: (data: HouseCreateInput) => appsHouseApiPropertiesCreateHouse(withoutMigrationMedia(data) as HouseCreateInput),
  patchHouse: (houseId: number, data: HousePatchInput) => appsHouseApiPropertiesPatchHouse({ house_id: houseId }, withoutMigrationMedia(data) as HousePatchInput),
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
    appsHouseApiViewingsListViewingRecords(
      (params ?? {}) as API.appsHouseApiViewingsListViewingRecordsParams,
    ) as Promise<PageResult<ViewingRecordOut>>,
  getViewingRecord: (recordId: number) => appsHouseApiViewingsGetViewingRecord({ record_id: recordId }) as Promise<ViewingRecordOut>,
  createViewingRecord: (data: Payload) => appsHouseApiViewingsCreateViewingRecord(data as API.ViewingRecordIn) as Promise<ViewingRecordOut>,
  patchViewingRecord: (recordId: number, data: Payload) =>
    appsHouseApiViewingsPatchViewingRecord(
      { record_id: recordId },
      data as API.ViewingRecordPatchIn,
    ) as Promise<ViewingRecordOut>,

  listLeases: (params?: QueryParams) =>
    appsHouseApiLeasesListLeases((params ?? {}) as API.appsHouseApiLeasesListLeasesParams) as Promise<PageResult<LeaseOut>>,
  getLease: (leaseId: number) => appsHouseApiLeasesGetLease({ lease_id: leaseId }) as Promise<LeaseOut>,
  createLease: (data: Payload) => appsHouseApiLeasesCreateLease(data as API.LeaseIn) as Promise<LeaseOut>,
  createDealSigning: (data: DealSigningCreateInput) =>
    request<LeaseOut>('/api/house/leases/register-signing/', {
      method: 'POST',
      data: { lease: { ...data.lease, ...(data.lease.sign_at && /^\d{4}-\d{2}-\d{2}$/.test(data.lease.sign_at) ? { sign_at: new Date(`${data.lease.sign_at}T12:00:00+08:00`).toISOString() } : {}) }, team_id: data.team_id, client_request_id: data.client_request_id || `signing-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    }).then((lease) => ({ lease })),
  patchLease: (leaseId: number, data: Payload) =>
    appsHouseApiLeasesPatchLease({ lease_id: leaseId }, data as API.LeasePatchIn) as Promise<LeaseOut>,
};
