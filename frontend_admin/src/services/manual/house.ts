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
  roles__mapping?: string[];
};
export type HouseOut = API.HouseOut & {
  building: API.HouseOut['building'] & { elevator: boolean };
  orientation__mapping?: string;
  decoration__mapping?: string;
  status__mapping?: string;
};
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

type QueryParams = Record<string, unknown>;
type Payload = Record<string, unknown>;

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

  listHouses: (params?: QueryParams) =>
    appsHouseApiListHouses((params ?? {}) as API.appsHouseApiListHousesParams) as Promise<PageResult<HouseOut>>,
  getHouse: (houseId: number) => appsHouseApiGetHouse({ house_id: houseId }) as Promise<HouseOut>,
  createHouse: (data: Payload) => appsHouseApiCreateHouse(data as API.HouseIn) as Promise<HouseOut>,
  patchHouse: (houseId: number, data: Payload) =>
    appsHouseApiPatchHouse({ house_id: houseId }, data as API.HousePatchIn) as Promise<HouseOut>,

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
  patchLease: (leaseId: number, data: Payload) =>
    appsHouseApiPatchLease({ lease_id: leaseId }, data as API.LeasePatchIn) as Promise<LeaseOut>,
};
