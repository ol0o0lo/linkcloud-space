// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Get configuration There are many configuration options that alter the functionality
and behavior of django-allauth, some of which can also impact the
frontend. Therefore, relevant configuration options are exposed via
this endpoint. The data returned is not user/authentication
dependent. Hence, it suffices to only fetch this data once at boot
time of your application.
 GET /api/allauth/browser/v1/config */
export async function getBrowserV1Config(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.getBrowserV1ConfigParams,
  options?: { [key: string]: any }
) {
  const { client: param0, ...queryParams } = params;
  return request<AllauthAPI.ConfigurationResponse>(
    "/api/allauth/browser/v1/config",
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
