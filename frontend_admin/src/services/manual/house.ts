import {
  appsHouseApiCreateBuilding,
  appsHouseApiCreateContact,
  appsHouseApiCreateEstate,
  appsHouseApiCreateHouse,
  appsHouseApiCreateLease,
  appsHouseApiCreateViewingRecord,
  appsHouseApiGetBuilding,
  appsHouseApiGetContact,
  appsHouseApiGetDefaultBuilding,
  appsHouseApiGetEstate,
  appsHouseApiGetHouse,
  appsHouseApiGetLease,
  appsHouseApiGetViewingRecord,
  appsHouseApiListBuildings,
  appsHouseApiListContacts,
  appsHouseApiListEstates,
  appsHouseApiListHouses,
  appsHouseApiListLeases,
  appsHouseApiListViewingRecords,
  appsHouseApiPatchBuilding,
  appsHouseApiPatchContact,
  appsHouseApiPatchEstate,
  appsHouseApiPatchHouse,
  appsHouseApiPatchLease,
  appsHouseApiPatchViewingRecord,
  appsHouseApiPutDefaultBuilding,
} from '@/services/openapi/propertyRentalManagement';

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type EstateOut = API.EstateOut & {
  property_type__mapping?: string;
};
export type BuildingOut = API.BuildingOut;
export type DefaultBuildingOut = API.DefaultBuildingOut;
export type ContactOut = API.ContactOut & {
  roles__mapping?: string[];
};
export type HouseOut = API.HouseOut & {
  orientation__mapping?: string;
  decoration__mapping?: string;
  status__mapping?: string;
  publish_status__mapping?: string;
};
export type ViewingRecordOut = API.ViewingRecordOut & {
  status__mapping?: string;
};
export type LeaseOut = API.LeaseOut & {
  status__mapping?: string;
};

type QueryParams = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const houseApi = {
  listEstates: (params?: QueryParams) =>
    appsHouseApiListEstates((params ?? {}) as API.appsHouseApiListEstatesParams) as Promise<PageResult<EstateOut>>,
  getEstate: (estateId: number) => appsHouseApiGetEstate({ estate_id: estateId }) as Promise<EstateOut>,
  createEstate: (data: Payload) => appsHouseApiCreateEstate(data as API.EstateIn) as Promise<EstateOut>,
  patchEstate: (estateId: number, data: Payload) =>
    appsHouseApiPatchEstate({ estate_id: estateId }, data as API.EstatePatchIn) as Promise<EstateOut>,

  listBuildings: (params?: QueryParams) =>
    appsHouseApiListBuildings((params ?? {}) as API.appsHouseApiListBuildingsParams) as Promise<PageResult<BuildingOut>>,
  getBuilding: (buildingId: number) => appsHouseApiGetBuilding({ building_id: buildingId }) as Promise<BuildingOut>,
  createBuilding: (data: Payload) => appsHouseApiCreateBuilding(data as API.BuildingIn) as Promise<BuildingOut>,
  patchBuilding: (buildingId: number, data: Payload) =>
    appsHouseApiPatchBuilding({ building_id: buildingId }, data as API.BuildingPatchIn) as Promise<BuildingOut>,
  getDefaultBuilding: () => appsHouseApiGetDefaultBuilding() as Promise<DefaultBuildingOut>,
  setDefaultBuilding: (buildingId: number) =>
    appsHouseApiPutDefaultBuilding({ building_id: buildingId }) as Promise<DefaultBuildingOut>,

  listContacts: (params?: QueryParams) =>
    appsHouseApiListContacts((params ?? {}) as API.appsHouseApiListContactsParams) as Promise<PageResult<ContactOut>>,
  getContact: (contactId: number) => appsHouseApiGetContact({ contact_id: contactId }) as Promise<ContactOut>,
  createContact: (data: Payload) => appsHouseApiCreateContact(data as API.ContactIn) as Promise<ContactOut>,
  patchContact: (contactId: number, data: Payload) =>
    appsHouseApiPatchContact({ contact_id: contactId }, data as API.ContactPatchIn) as Promise<ContactOut>,

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
