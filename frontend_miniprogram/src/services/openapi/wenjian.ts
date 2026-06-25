/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 确认直传文件 在前端完成直传后登记媒体文件元数据，生成系统内媒体记录。 POST /api/media/confirm/ */
export function mediaConfirmUsingPost({
  body,
  options,
}: {
  body: API.MediaFileConfirmIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.MediaFileOut>('/api/media/confirm/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取上传凭证 为当前用户或当前租户生成直传 OSS 所需的临时上传凭证。 GET /api/media/oss-token/ */
export function mediaOssTokenUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.MediaOssTokenUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.OssTokenOut>('/api/media/oss-token/', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 服务端上传文件 通过服务端接收文件并上传存储，同时登记媒体文件记录。 POST /api/media/upload/ */
export function mediaUploadUsingPost({
  body,
  files,
  options,
}: {
  body: API.MediaUploadUsingPostBody;
  files?: globalThis.File[];
  options?: CustomRequestOptions_;
}) {
  const formData = new FormData();

  if (files) {
    files.forEach((f) => formData.append('files', f || ''));
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

  return request<API.MediaFileOut[]>('/api/media/upload/', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: formData,
    ...(options || {}),
  });
}
