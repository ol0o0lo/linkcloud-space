// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取我的收藏 GET /api/users/me/favorite/ */
export async function appsFavoritesApiListFavorites(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsFavoritesApiListFavoritesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedFavoriteOut>("/api/users/me/favorite/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 收藏目标 PUT /api/users/me/favorite/ */
export async function appsFavoritesApiPutUserFavorite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsFavoritesApiPutUserFavoriteParams,
  options?: { [key: string]: any }
) {
  return request<API.FavoriteOut>("/api/users/me/favorite/", {
    method: "PUT",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 取消收藏目标 DELETE /api/users/me/favorite/ */
export async function appsFavoritesApiDeleteUserFavorite(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsFavoritesApiDeleteUserFavoriteParams,
  options?: { [key: string]: any }
) {
  return request<any>("/api/users/me/favorite/", {
    method: "DELETE",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取收藏目标类型 GET /api/users/me/favorite/type/ */
export async function appsFavoritesApiListFavoriteTargetTypes(options?: {
  [key: string]: any;
}) {
  return request<API.FavoriteTargetTypeOut[]>("/api/users/me/favorite/type/", {
    method: "GET",
    ...(options || {}),
  });
}
