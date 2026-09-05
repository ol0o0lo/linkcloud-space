// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 生成配房分享链接 POST /api/house-match-shares/ */
export async function appsHouseMatchApiCreateShare(
  body: API.HouseMatchShareCreateIn,
  options?: { [key: string]: any }
) {
  return request<API.HouseMatchShareCreateOut>("/api/house-match-shares/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}
