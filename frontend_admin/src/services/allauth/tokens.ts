// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** Refresh the access token
 Used to retrieve a new access token. Depending on `settings.HEADLESS_JWT_ROTATE_REFRESH_TOKEN`,
a new refresh token is returned as well.
 POST /api/allauth/app/v1/tokens/refresh */
export async function postAppV1TokensRefresh(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: AllauthAPI.postAppV1TokensRefreshParams,
  body: AllauthAPI.RefreshToken,
  options?: { [key: string]: any }
) {
  return request<{
    status: Record<string, any>;
    data: {
      access_token: AllauthAPI.AccessToken;
      refresh_token: AllauthAPI.RefreshToken;
    };
  }>("/api/allauth/app/v1/tokens/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...params },
    data: body,
    ...(options || {}),
  });
}
