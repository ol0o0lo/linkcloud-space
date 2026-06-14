// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 确认直传文件 在前端完成直传后登记媒体文件元数据，生成系统内媒体记录。 POST /api/media/confirm/ */
export async function appsMediaApiConfirmUpload(
  body: API.MediaFileConfirmIn,
  options?: { [key: string]: any }
) {
  return request<API.MediaFileOut>("/api/media/confirm/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取上传凭证 为当前用户或当前租户生成直传 OSS 所需的临时上传凭证。 GET /api/media/oss-token/ */
export async function appsMediaApiOssToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsMediaApiOssTokenParams,
  options?: { [key: string]: any }
) {
  return request<API.OssTokenOut>("/api/media/oss-token/", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 服务端上传文件 通过服务端接收文件并上传存储，同时登记媒体文件记录。 POST /api/media/upload/ */
export async function appsMediaApiUploadFiles(
  body: {
    /** 资源类型，例如 avatar、org_logo。 */
    resource_type: string;
    /** 上传作用域，user 或 org。 */
    scope?: string;
  },
  files?: File[],
  options?: { [key: string]: any }
) {
  const formData = new FormData();

  if (files) {
    files.forEach((f) => formData.append("files", f || ""));
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

  return request<API.MediaFileOut[]>("/api/media/upload/", {
    method: "POST",
    data: formData,
    requestType: "form",
    ...(options || {}),
  });
}
