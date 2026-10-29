/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 查询旧版历史档案 GET /api/data-migration/archives/ */
export function dataMigrationArchivesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationArchivesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedRecordOut>('/api/data-migration/archives/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 查看历史档案详情 GET /api/data-migration/archives/${param0}/ */
export function dataMigrationArchivesRecordIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationArchivesRecordIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { record_id: param0, ...queryParams } = params;

  return request<API.RecordOut>(`/api/data-migration/archives/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重试、修正来源或补传迁移资源 POST /api/data-migration/assets/${param0}/retry/ */
export function dataMigrationAssetsAssetIdRetryUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationAssetsAssetIdRetryUsingPostParams;
  body: API.AssetRetryIn;
  options?: CustomRequestOptions_;
}) {
  const { asset_id: param0, ...queryParams } = params;

  return request<API.AssetOut>(`/api/data-migration/assets/${param0}/retry/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 迁移任务列表 GET /api/data-migration/batches/ */
export function dataMigrationBatchesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedBatchOut>('/api/data-migration/batches/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 上传 Uhome 迁移包 POST /api/data-migration/batches/ */
export function dataMigrationBatchesUsingPost({
  body,
  file,
  options,
}: {
  body: API.DataMigrationBatchesUsingPostBody;
  file?: globalThis.File;
  options?: CustomRequestOptions_;
}) {
  const formData = new FormData();

  if (file) {
    formData.append('file', file);
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as { [key: string]: any })[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === 'object' && !(item instanceof globalThis.File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ''));
        } else {
          formData.append(ele, JSON.stringify(item));
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<API.BatchOut>('/api/data-migration/batches/', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: formData,
    ...(options || {}),
  });
}

/** 迁移任务详情 GET /api/data-migration/batches/${param0}/ */
export function dataMigrationBatchesBatchIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.BatchOut>(`/api/data-migration/batches/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 查看媒体迁移进度及异常 GET /api/data-migration/batches/${param0}/assets/ */
export function dataMigrationBatchesBatchIdAssetsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdAssetsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.PagedAssetOut>(
    `/api/data-migration/batches/${param0}/assets/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 确认预检并开始后台导入 POST /api/data-migration/batches/${param0}/confirm/ */
export function dataMigrationBatchesBatchIdConfirmUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdConfirmUsingPostParams;
  body: API.ConfirmIn;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.BatchOut>(
    `/api/data-migration/batches/${param0}/confirm/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 补全资料并重新预检 POST /api/data-migration/batches/${param0}/preview/ */
export function dataMigrationBatchesBatchIdPreviewUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdPreviewUsingPostParams;
  body: API.PreviewIn;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.BatchOut>(
    `/api/data-migration/batches/${param0}/preview/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 查看来源记录及处理结果 GET /api/data-migration/batches/${param0}/records/ */
export function dataMigrationBatchesBatchIdRecordsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdRecordsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.PagedRecordOut>(
    `/api/data-migration/batches/${param0}/records/`,
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 迁移核对报告 GET /api/data-migration/batches/${param0}/report/ */
export function dataMigrationBatchesBatchIdReportUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdReportUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/data-migration/batches/${param0}/report/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 恢复迁移任务及失败资源 POST /api/data-migration/batches/${param0}/retry/ */
export function dataMigrationBatchesBatchIdRetryUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.DataMigrationBatchesBatchIdRetryUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { batch_id: param0, ...queryParams } = params;

  return request<API.BatchOut>(`/api/data-migration/batches/${param0}/retry/`, {
    method: 'POST',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 迁移组织和成员选项 GET /api/data-migration/options/ */
export function dataMigrationOptionsUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<Record<string, unknown>>('/api/data-migration/options/', {
    method: 'GET',
    ...(options || {}),
  });
}
