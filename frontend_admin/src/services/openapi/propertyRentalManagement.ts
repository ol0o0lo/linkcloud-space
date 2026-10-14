// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取待定位楼栋数量 GET /api/house/building-map-unlocated-count/ */
export async function appsHouseApiMapsGetBuildingMapUnlocatedCount(options?: {
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
export async function appsHouseApiMapsListBuildingMapUnlocated(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMapsListBuildingMapUnlocatedParams,
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
export async function appsHouseApiMapsListBuildingMap(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMapsListBuildingMapParams,
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
export async function appsHouseApiMapsGetBuildingMapDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMapsGetBuildingMapDetailParams,
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
export async function appsHouseApiPropertiesListBuildings(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesListBuildingsParams,
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
export async function appsHouseApiPropertiesCreateBuilding(
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
export async function appsHouseApiPropertiesGetBuilding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesGetBuildingParams,
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
export async function appsHouseApiPropertiesDeleteBuildingEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesDeleteBuildingEndpointParams,
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
export async function appsHouseApiPropertiesPatchBuilding(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesPatchBuildingParams,
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
export async function appsHouseApiPropertiesCheckBuildingDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesCheckBuildingDeleteParams,
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
export async function appsHouseApiContactsListContacts(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiContactsListContactsParams,
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
export async function appsHouseApiContactsCreateContact(
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
export async function appsHouseApiContactsGetContact(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiContactsGetContactParams,
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
export async function appsHouseApiContactsPatchContact(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiContactsPatchContactParams,
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

/** 邀请房东绑定账号 POST /api/house/contacts/${param0}/landlord-invite/ */
export async function appsHouseApiContactsInviteLandlordContact(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiContactsInviteLandlordContactParams,
  options?: { [key: string]: any }
) {
  const { contact_id: param0, ...queryParams } = params;
  return request<API.LandlordInvitationOut>(
    `/api/house/contacts/${param0}/landlord-invite/`,
    {
      method: "POST",
      params: {
        // delivery_method has a default value: sms
        delivery_method: "sms",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 获取默认楼栋 GET /api/house/default-building/ */
export async function appsHouseApiPropertiesGetDefaultBuilding(options?: {
  [key: string]: any;
}) {
  return request<API.DefaultBuildingOut>("/api/house/default-building/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 设置默认楼栋 PUT /api/house/default-building/ */
export async function appsHouseApiPropertiesPutDefaultBuilding(
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
export async function appsHouseApiMapsListEstateMap(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiMapsListEstateMapParams,
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
export async function appsHouseApiPropertiesListEstates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesListEstatesParams,
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
export async function appsHouseApiPropertiesCreateEstate(
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
export async function appsHouseApiPropertiesGetEstate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesGetEstateParams,
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
export async function appsHouseApiPropertiesDeleteEstateEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesDeleteEstateEndpointParams,
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
export async function appsHouseApiPropertiesPatchEstate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesPatchEstateParams,
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
export async function appsHouseApiPropertiesCheckEstateDelete(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesCheckEstateDeleteParams,
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
export async function appsHouseApiPropertiesListHouses(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesListHousesParams,
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
export async function appsHouseApiPropertiesCreateHouse(
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
export async function appsHouseApiPropertiesGetHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesGetHouseParams,
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
export async function appsHouseApiPropertiesPatchHouse(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesPatchHouseParams,
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

/** 获取房源 AI 洞察 GET /api/house/houses/${param0}/ai-insight/ */
export async function appsHouseApiPropertiesGetHouseAiInsightEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesGetHouseAiInsightEndpointParams,
  options?: { [key: string]: any }
) {
  const { house_id: param0, ...queryParams } = params;
  return request<API.HouseAIInsightOut>(
    `/api/house/houses/${param0}/ai-insight/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 生成房源 AI 洞察 POST /api/house/houses/${param0}/ai-insight/generate/ */
export async function appsHouseApiPropertiesGenerateHouseAiInsightEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiPropertiesGenerateHouseAiInsightEndpointParams,
  options?: { [key: string]: any }
) {
  const { house_id: param0, ...queryParams } = params;
  return request<API.HouseAIInsightOut>(
    `/api/house/houses/${param0}/ai-insight/generate/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取租约收益分配申请列表 GET /api/house/lease-allocations/ */
export async function appsHouseApiLeasesListLeaseAllocations(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesListLeaseAllocationsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedLeaseAllocationOut>("/api/house/lease-allocations/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取租约列表 GET /api/house/leases/ */
export async function appsHouseApiLeasesListLeases(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesListLeasesParams,
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
export async function appsHouseApiLeasesCreateLease(
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
export async function appsHouseApiLeasesGetLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesGetLeaseParams,
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
export async function appsHouseApiLeasesPatchLease(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesPatchLeaseParams,
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

/** 获取租约收益分配申请 GET /api/house/leases/${param0}/allocation/ */
export async function appsHouseApiLeasesGetLeaseAllocationRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesGetLeaseAllocationRequestParams,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.LeaseAllocationOut>(
    `/api/house/leases/${param0}/allocation/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 审核租约收益分配申请 POST /api/house/leases/${param0}/allocation/review/ */
export async function appsHouseApiLeasesReviewLeaseAllocationRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesReviewLeaseAllocationRequestParams,
  body: API.LeaseAllocationReviewIn,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.AllocationRequestOut>(
    `/api/house/leases/${param0}/allocation/review/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 作废租约收益分配申请 POST /api/house/leases/${param0}/allocation/void/ */
export async function appsHouseApiLeasesVoidLeaseAllocationRequest(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiLeasesVoidLeaseAllocationRequestParams,
  body: API.LeaseAllocationVoidIn,
  options?: { [key: string]: any }
) {
  const { lease_id: param0, ...queryParams } = params;
  return request<API.AllocationRequestOut>(
    `/api/house/leases/${param0}/allocation/void/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 登记签约并提交收益分配申请 POST /api/house/leases/deal-signing/ */
export async function appsHouseApiLeasesDealSigning(
  body: API.DealSigningWithAllocationIn,
  options?: { [key: string]: any }
) {
  return request<API.LeaseAllocationOut>("/api/house/leases/deal-signing/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取员工房源职责列表 GET /api/house/staff-responsibilities/ */
export async function appsHouseApiResponsibilitiesListStaffResponsibilities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiResponsibilitiesListStaffResponsibilitiesParams,
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
export async function appsHouseApiResponsibilitiesGetStaffResponsibility(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiResponsibilitiesGetStaffResponsibilityParams,
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
export async function appsHouseApiResponsibilitiesReplaceStaffResponsibilities(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiResponsibilitiesReplaceStaffResponsibilitiesParams,
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
export async function appsHouseApiResponsibilitiesGetStaffResponsibilitySummary(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiResponsibilitiesGetStaffResponsibilitySummaryParams,
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
export async function appsHouseApiPropertiesGetPropertyRentalTagSuggestions(options?: {
  [key: string]: any;
}) {
  return request<API.TagSuggestionsOut>("/api/house/tag-suggestions/", {
    method: "GET",
    ...(options || {}),
  });
}

/** 预览或执行房表空置同步 POST /api/house/vacancy-sync/ */
export async function appsHouseApiPropertiesVacancySync(
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
export async function appsHouseApiViewingsListViewingRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiViewingsListViewingRecordsParams,
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
export async function appsHouseApiViewingsCreateViewingRecord(
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
export async function appsHouseApiViewingsGetViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiViewingsGetViewingRecordParams,
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
export async function appsHouseApiViewingsPatchViewingRecord(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsHouseApiViewingsPatchViewingRecordParams,
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
