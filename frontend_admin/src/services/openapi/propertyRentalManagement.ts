// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取待定位楼栋数量 GET /api/house/building-map-unlocated-count/ */
export async function appsHouseApiGetBuildingMapUnlocatedCount(options?: {
  [key: string]: any;
}) {
  return request<API.BuildingMapUnlocatedCountOut>(
    "/api/house/building-map-unlocated-count/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 获取待定位楼栋列表 GET /api/house/building-map-unlocated/ */
export async function appsHouseApiListBuildingMapUnlocated(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListBuildingMapUnlocatedParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedBuildingMapUnlocatedOut>(
    "/api/house/building-map-unlocated/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取楼栋房源地图标点 GET /api/house/building-map/ */
export async function appsHouseApiListBuildingMap(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListBuildingMapParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedBuildingMapMarkerOut>("/api/house/building-map/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取楼栋房源地图详情 GET /api/house/building-map/${param0}/ */
export async function appsHouseApiGetBuildingMapDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetBuildingMapDetailParams,
  options?: { [key: string]: any }
) {
  const { building_id: param0, ...queryParams } = params;
  return request<API.BuildingMapDetailOut>(
    `/api/house/building-map/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取楼栋列表 GET /api/house/buildings/ */
export async function appsHouseApiListBuildings(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListBuildingsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedBuildingInventoryOut>("/api/house/buildings/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建楼栋 POST /api/house/buildings/ */
export async function appsHouseApiCreateBuilding(
  body: API.BuildingIn,
  options?: { [key: string]: any }
) {
  return request<API.BuildingOut>("/api/house/buildings/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取楼栋详情 GET /api/house/buildings/${param0}/ */
export async function appsHouseApiGetBuilding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetBuildingParams,
  options?: { [key: string]: any }
) {
  const { building_id: param0, ...queryParams } = params;
  return request<API.BuildingInventoryOut>(`/api/house/buildings/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除楼栋 DELETE /api/house/buildings/${param0}/ */
export async function appsHouseApiDeleteBuildingEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiDeleteBuildingEndpointParams,
  options?: { [key: string]: any }
) {
  const { building_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/house/buildings/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新楼栋 PATCH /api/house/buildings/${param0}/ */
export async function appsHouseApiPatchBuilding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchBuildingParams,
  body: API.BuildingPatchIn,
  options?: { [key: string]: any }
) {
  const { building_id: param0, ...queryParams } = params;
  return request<API.BuildingOut>(`/api/house/buildings/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 检查楼栋删除关联资源 GET /api/house/buildings/${param0}/delete-check/ */
export async function appsHouseApiCheckBuildingDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCheckBuildingDeleteParams,
  options?: { [key: string]: any }
) {
  const { building_id: param0, ...queryParams } = params;
  return request<API.DeleteCheckOut>(
    `/api/house/buildings/${param0}/delete-check/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取联系人列表 GET /api/house/contacts/ */
export async function appsHouseApiListContacts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListContactsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedContactOut>("/api/house/contacts/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建联系人 POST /api/house/contacts/ */
export async function appsHouseApiCreateContact(
  body: API.ContactIn,
  options?: { [key: string]: any }
) {
  return request<API.ContactOut>("/api/house/contacts/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取联系人详情 GET /api/house/contacts/${param0}/ */
export async function appsHouseApiGetContact(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetContactParams,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.ContactOut>(`/api/house/contacts/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新联系人 PATCH /api/house/contacts/${param0}/ */
export async function appsHouseApiPatchContact(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchContactParams,
  body: API.ContactPatchIn,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.ContactOut>(`/api/house/contacts/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取默认楼栋 GET /api/house/default-building/ */
export async function appsHouseApiGetDefaultBuilding(options?: {
  [key: string]: any;
}) {
  return request<API.DefaultBuildingOut>("/api/house/default-building/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 设置默认楼栋 PUT /api/house/default-building/ */
export async function appsHouseApiPutDefaultBuilding(
  body: API.DefaultBuildingIn,
  options?: { [key: string]: any }
) {
  return request<API.DefaultBuildingOut>("/api/house/default-building/", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取小区房源地图聚合标点 GET /api/house/estate-map/ */
export async function appsHouseApiListEstateMap(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListEstateMapParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedEstateMapMarkerOut>("/api/house/estate-map/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取项目片区列表 GET /api/house/estates/ */
export async function appsHouseApiListEstates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListEstatesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedEstateDetailOut>("/api/house/estates/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建项目片区 POST /api/house/estates/ */
export async function appsHouseApiCreateEstate(
  body: API.EstateIn,
  options?: { [key: string]: any }
) {
  return request<API.EstateOut>("/api/house/estates/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取项目片区详情 GET /api/house/estates/${param0}/ */
export async function appsHouseApiGetEstate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetEstateParams,
  options?: { [key: string]: any }
) {
  const { estate_id: param0, ...queryParams } = params;
  return request<API.EstateDetailOut>(`/api/house/estates/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除项目片区 DELETE /api/house/estates/${param0}/ */
export async function appsHouseApiDeleteEstateEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiDeleteEstateEndpointParams,
  options?: { [key: string]: any }
) {
  const { estate_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/house/estates/${param0}/`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新项目片区 PATCH /api/house/estates/${param0}/ */
export async function appsHouseApiPatchEstate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchEstateParams,
  body: API.EstatePatchIn,
  options?: { [key: string]: any }
) {
  const { estate_id: param0, ...queryParams } = params;
  return request<API.EstateOut>(`/api/house/estates/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 检查项目片区删除关联资源 GET /api/house/estates/${param0}/delete-check/ */
export async function appsHouseApiCheckEstateDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiCheckEstateDeleteParams,
  options?: { [key: string]: any }
) {
  const { estate_id: param0, ...queryParams } = params;
  return request<API.DeleteCheckOut>(
    `/api/house/estates/${param0}/delete-check/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取房源列表 GET /api/house/houses/ */
export async function appsHouseApiListHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListHousesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedHouseOut>("/api/house/houses/", {
    method: "GET",
    params: {
      // ordering has a default value: building
      ordering: "building",
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建房源 POST /api/house/houses/ */
export async function appsHouseApiCreateHouse(
  body: API.HouseIn,
  options?: { [key: string]: any }
) {
  return request<API.HouseOut>("/api/house/houses/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取房源详情 GET /api/house/houses/${param0}/ */
export async function appsHouseApiGetHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetHouseParams,
  options?: { [key: string]: any }
) {
  const { house_id: param0, ...queryParams } = params;
  return request<API.HouseOut>(`/api/house/houses/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新房源 PATCH /api/house/houses/${param0}/ */
export async function appsHouseApiPatchHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchHouseParams,
  body: API.HousePatchIn,
  options?: { [key: string]: any }
) {
  const { house_id: param0, ...queryParams } = params;
  return request<API.HouseOut>(`/api/house/houses/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取租约列表 GET /api/house/leases/ */
export async function appsHouseApiListLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListLeasesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedLeaseOut>("/api/house/leases/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建租约 POST /api/house/leases/ */
export async function appsHouseApiCreateLease(
  body: API.LeaseIn,
  options?: { [key: string]: any }
) {
  return request<API.LeaseOut>("/api/house/leases/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租约详情 GET /api/house/leases/${param0}/ */
export async function appsHouseApiGetLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetLeaseParams,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.LeaseOut>(`/api/house/leases/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租约 PATCH /api/house/leases/${param0}/ */
export async function appsHouseApiPatchLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchLeaseParams,
  body: API.LeasePatchIn,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.LeaseOut>(`/api/house/leases/${param0}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取员工房源职责列表 GET /api/house/staff-responsibilities/ */
export async function appsHouseApiListStaffResponsibilities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListStaffResponsibilitiesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedPropertyResponsibilityMemberOut>(
    "/api/house/staff-responsibilities/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取员工房源职责 GET /api/house/staff-responsibilities/${param0}/ */
export async function appsHouseApiGetStaffResponsibility(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetStaffResponsibilityParams,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<API.PropertyResponsibilityMemberOut>(
    `/api/house/staff-responsibilities/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 替换员工房源职责 PUT /api/house/staff-responsibilities/${param0}/ */
export async function appsHouseApiReplaceStaffResponsibilities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiReplaceStaffResponsibilitiesParams,
  body: API.PropertyResponsibilityUpdateIn,
  options?: { [key: string]: any }
) {
  const { member_id: param0, ...queryParams } = params;
  return request<API.PropertyResponsibilityMemberOut>(
    `/api/house/staff-responsibilities/${param0}/`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取团队员工房源职责汇总 GET /api/house/staff-responsibilities/summary/ */
export async function appsHouseApiGetStaffResponsibilitySummary(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetStaffResponsibilitySummaryParams,
  options?: { [key: string]: any }
) {
  return request<API.PropertyResponsibilitySummaryOut>(
    "/api/house/staff-responsibilities/summary/",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取房源与楼栋标签快捷候选 GET /api/house/tag-suggestions/ */
export async function appsHouseApiGetPropertyRentalTagSuggestions(options?: {
  [key: string]: any;
}) {
  return request<API.TagSuggestionsOut>("/api/house/tag-suggestions/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 预览或执行房表空置同步 POST /api/house/vacancy-sync/ */
export async function appsHouseApiVacancySync(
  body: API.VacancySyncIn,
  options?: { [key: string]: any }
) {
  return request<API.VacancySyncOut>("/api/house/vacancy-sync/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取带看记录列表 GET /api/house/viewing-records/ */
export async function appsHouseApiListViewingRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiListViewingRecordsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedViewingRecordOut>("/api/house/viewing-records/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建带看记录 POST /api/house/viewing-records/ */
export async function appsHouseApiCreateViewingRecord(
  body: API.ViewingRecordIn,
  options?: { [key: string]: any }
) {
  return request<API.ViewingRecordOut>("/api/house/viewing-records/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取带看记录详情 GET /api/house/viewing-records/${param0}/ */
export async function appsHouseApiGetViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiGetViewingRecordParams,
  options?: { [key: string]: any }
) {
  const { record_id: param0, ...queryParams } = params;
  return request<API.ViewingRecordOut>(
    `/api/house/viewing-records/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新带看记录 PATCH /api/house/viewing-records/${param0}/ */
export async function appsHouseApiPatchViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPatchViewingRecordParams,
  body: API.ViewingRecordPatchIn,
  options?: { [key: string]: any }
) {
  const { record_id: param0, ...queryParams } = params;
  return request<API.ViewingRecordOut>(
    `/api/house/viewing-records/${param0}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
