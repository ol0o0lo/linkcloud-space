// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 查询旧版历史档案 GET /api/data-migration/archives/ */
export async function appsDataMigrationApiArchives(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiArchivesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedRecordOut>("/api/data-migration/archives/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 查看历史档案详情 GET /api/data-migration/archives/${param0}/ */
export async function appsDataMigrationApiArchiveDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiArchiveDetailParams,
  options?: { [key: string]: any }
) {
  const { record_id: param0, ...queryParams } = params;
  return request<API.RecordOut>(`/api/data-migration/archives/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重试、修正来源或补传迁移资源 POST /api/data-migration/assets/${param0}/retry/ */
export async function appsDataMigrationApiRetryAsset(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiRetryAssetParams,
  body: API.AssetRetryIn,
  options?: { [key: string]: any }
) {
  const { asset_id: param0, ...queryParams } = params;
  return request<API.AssetOut>(`/api/data-migration/assets/${param0}/retry/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 迁移任务列表 GET /api/data-migration/batches/ */
export async function appsDataMigrationApiListBatches(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiListBatchesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedBatchOut>("/api/data-migration/batches/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 上传 Uhome 迁移包 POST /api/data-migration/batches/ */
export async function appsDataMigrationApiUploadBatch(
  body: {},
  file?: File,
  options?: { [key: string]: any }
) {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === "object" && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ""));
        } else {
          formData.append(
            ele,
            new Blob([JSON.stringify(item)], { type: "application/json" })
          );
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<API.BatchOut>("/api/data-migration/batches/", {
    method: "POST",
    data: formData,
    requestType: "form",
    ...(options || {}),
  });
}

/** 迁移任务详情 GET /api/data-migration/batches/${param0}/ */
export async function appsDataMigrationApiBatchDetail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiBatchDetailParams,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.BatchOut>(`/api/data-migration/batches/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 查看媒体迁移进度及异常 GET /api/data-migration/batches/${param0}/assets/ */
export async function appsDataMigrationApiAssets(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiAssetsParams,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.PagedAssetOut>(
    `/api/data-migration/batches/${param0}/assets/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 确认预检并开始后台导入 POST /api/data-migration/batches/${param0}/confirm/ */
export async function appsDataMigrationApiConfirm(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiConfirmParams,
  body: API.ConfirmIn,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.BatchOut>(
    `/api/data-migration/batches/${param0}/confirm/`,
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

/** 补全资料并重新预检 POST /api/data-migration/batches/${param0}/preview/ */
export async function appsDataMigrationApiPreview(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiPreviewParams,
  body: API.PreviewIn,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.BatchOut>(
    `/api/data-migration/batches/${param0}/preview/`,
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

/** 查看来源记录及处理结果 GET /api/data-migration/batches/${param0}/records/ */
export async function appsDataMigrationApiRecords(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiRecordsParams,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.PagedRecordOut>(
    `/api/data-migration/batches/${param0}/records/`,
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 迁移核对报告 GET /api/data-migration/batches/${param0}/report/ */
export async function appsDataMigrationApiReport(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiReportParams,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/data-migration/batches/${param0}/report/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 恢复迁移任务及失败资源 POST /api/data-migration/batches/${param0}/retry/ */
export async function appsDataMigrationApiRetryBatch(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsDataMigrationApiRetryBatchParams,
  options?: { [key: string]: any }
) {
  const { batch_id: param0, ...queryParams } = params;
  return request<API.BatchOut>(`/api/data-migration/batches/${param0}/retry/`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 迁移组织和成员选项 GET /api/data-migration/options/ */
export async function appsDataMigrationApiOptions(options?: {
  [key: string]: any;
}) {
  return request<Record<string, any>>("/api/data-migration/options/", {
    method: "GET",
    ...(options || {}),
  });
}
