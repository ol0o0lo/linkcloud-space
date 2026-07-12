/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取当前裂变规则配置 GET /api/admin/referrals/config/ */
export function adminReferralsConfigUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.ReferralRuleConfigOut>('/api/admin/referrals/config/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 更新当前裂变规则配置 PATCH /api/admin/referrals/config/ */
export function adminReferralsConfigUsingPatch({
  body,
  options,
}: {
  body: API.ReferralRuleConfigPatchIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.ReferralRuleConfigOut>('/api/admin/referrals/config/', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取裂变邀请记录列表 GET /api/admin/referrals/records/ */
export function adminReferralsRecordsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminReferralsRecordsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedReferralRecordOut>('/api/admin/referrals/records/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 审核裂变奖励 POST /api/admin/referrals/records/${param0}/review/ */
export function adminReferralsRecordsRecordIdReviewUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminReferralsRecordsRecordIdReviewUsingPostParams;
  body: API.ReferralReviewIn;
  options?: CustomRequestOptions_;
}) {
  const { record_id: param0, ...queryParams } = params;

  return request<API.ReferralRecordOut>(
    `/api/admin/referrals/records/${param0}/review/`,
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

/** 获取后台用户列表 由超级管理员查看全量用户列表，用于后台账号生命周期管理。 GET /api/admin/users/ */
export function adminUsersUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAdminUserOut>('/api/admin/users/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建后台用户 由超级管理员创建用户，可同时设置角色、手机号和初始密码。 POST /api/admin/users/ */
export function adminUsersUsingPost({
  body,
  options,
}: {
  body: API.AdminUserCreateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.AdminUserOut>('/api/admin/users/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 更新后台用户 由超级管理员更新用户资料、角色与联系方式。 PATCH /api/admin/users/${param0}/ */
export function adminUsersUserIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdUsingPatchParams;
  body: API.AdminUserPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.AdminUserOut>(`/api/admin/users/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 强制用户退出登录 删除 allauth 记录的用户会话，使用户需要重新登录。 POST /api/admin/users/${param0}/force-logout/ */
export function adminUsersUserIdForceLogoutUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdForceLogoutUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.ForceLogoutOut>(
    `/api/admin/users/${param0}/force-logout/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 解绑用户手机号 清空用户手机号及验证状态。 DELETE /api/admin/users/${param0}/phone/ */
export function adminUsersUserIdPhoneUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdPhoneUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/admin/users/${param0}/phone/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 重置用户 MFA 删除用户已配置的 allauth MFA authenticators。 POST /api/admin/users/${param0}/reset-mfa/ */
export function adminUsersUserIdResetMfaUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdResetMfaUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.ResetMfaOut>(`/api/admin/users/${param0}/reset-mfa/`, {
    method: 'POST',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 设置用户密码 由超级管理员直接设置用户密码。 POST /api/admin/users/${param0}/set-password/ */
export function adminUsersUserIdSetPasswordUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdSetPasswordUsingPostParams;
  body: API.AdminUserPasswordIn;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.AdminUserOut>(`/api/admin/users/${param0}/set-password/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 启用或禁用用户 由超级管理员启用或禁用用户账号；禁止通过该接口禁用自己。 PATCH /api/admin/users/${param0}/status/ */
export function adminUsersUserIdStatusUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdStatusUsingPatchParams;
  body: API.UserStatusPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.AdminUserOut>(`/api/admin/users/${param0}/status/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 解绑用户微信账号 删除用户微信开放平台和小程序 social account 绑定。 DELETE /api/admin/users/${param0}/wechat/ */
export function adminUsersUserIdWechatUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminUsersUserIdWechatUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(
    `/api/admin/users/${param0}/wechat/`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取钱包账户列表 GET /api/admin/wallet/accounts/ */
export function adminWalletAccountsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminWalletAccountsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWalletAccountAdminOut>(
    '/api/admin/wallet/accounts/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取指定用户钱包流水 GET /api/admin/wallet/accounts/${param0}/ledger/ */
export function adminWalletAccountsUserIdLedgerUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminWalletAccountsUserIdLedgerUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { user_id: param0, ...queryParams } = params;

  return request<API.PagedWalletLedgerOut>(
    `/api/admin/wallet/accounts/${param0}/ledger/`,
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

/** 创建钱包调账 POST /api/admin/wallet/adjustments/ */
export function adminWalletAdjustmentsUsingPost({
  body,
  options,
}: {
  body: API.WalletAdjustmentIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.WalletLedgerOut>('/api/admin/wallet/adjustments/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取提现申请列表 GET /api/admin/wallet/withdrawals/ */
export function adminWalletWithdrawalsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminWalletWithdrawalsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWithdrawalOut>('/api/admin/wallet/withdrawals/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 发起提现代付 POST /api/admin/wallet/withdrawals/${param0}/payout/ */
export function adminWalletWithdrawalsWithdrawalIdPayoutUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminWalletWithdrawalsWithdrawalIdPayoutUsingPostParams;
  body: API.PayoutCreateIn;
  options?: CustomRequestOptions_;
}) {
  const { withdrawal_id: param0, ...queryParams } = params;

  return request<API.WithdrawalPayoutOut>(
    `/api/admin/wallet/withdrawals/${param0}/payout/`,
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

/** 审核提现申请 POST /api/admin/wallet/withdrawals/${param0}/review/ */
export function adminWalletWithdrawalsWithdrawalIdReviewUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.AdminWalletWithdrawalsWithdrawalIdReviewUsingPostParams;
  body: API.WithdrawalReviewIn;
  options?: CustomRequestOptions_;
}) {
  const { withdrawal_id: param0, ...queryParams } = params;

  return request<API.WithdrawalOut>(
    `/api/admin/wallet/withdrawals/${param0}/review/`,
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

/** 获取待定位楼栋数量 GET /api/house/building-map-unlocated-count/ */
export function houseBuildingMapUnlocatedCountUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.BuildingMapUnlocatedCountOut>(
    '/api/house/building-map-unlocated-count/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 获取楼栋房源地图标点 GET /api/house/building-map/ */
export function houseBuildingMapUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingMapUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedBuildingMapMarkerOut>('/api/house/building-map/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 获取楼栋房源地图详情 GET /api/house/building-map/${param0}/ */
export function houseBuildingMapBuildingIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingMapBuildingIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { building_id: param0, ...queryParams } = params;

  return request<API.BuildingMapDetailOut>(
    `/api/house/building-map/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取楼栋列表 GET /api/house/buildings/ */
export function houseBuildingsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedBuildingOut>('/api/house/buildings/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建楼栋 POST /api/house/buildings/ */
export function houseBuildingsUsingPost({
  body,
  options,
}: {
  body: API.BuildingIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.BuildingOut>('/api/house/buildings/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取楼栋详情 GET /api/house/buildings/${param0}/ */
export function houseBuildingsBuildingIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingsBuildingIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { building_id: param0, ...queryParams } = params;

  return request<API.BuildingOut>(`/api/house/buildings/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除楼栋 DELETE /api/house/buildings/${param0}/ */
export function houseBuildingsBuildingIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingsBuildingIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { building_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/house/buildings/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新楼栋 PATCH /api/house/buildings/${param0}/ */
export function houseBuildingsBuildingIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingsBuildingIdUsingPatchParams;
  body: API.BuildingPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { building_id: param0, ...queryParams } = params;

  return request<API.BuildingOut>(`/api/house/buildings/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 检查楼栋删除关联资源 GET /api/house/buildings/${param0}/delete-check/ */
export function houseBuildingsBuildingIdDeleteCheckUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseBuildingsBuildingIdDeleteCheckUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { building_id: param0, ...queryParams } = params;

  return request<API.DeleteCheckOut>(
    `/api/house/buildings/${param0}/delete-check/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取联系人列表 GET /api/house/contacts/ */
export function houseContactsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseContactsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedContactOut>('/api/house/contacts/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建联系人 POST /api/house/contacts/ */
export function houseContactsUsingPost({
  body,
  options,
}: {
  body: API.ContactIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.ContactOut>('/api/house/contacts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取联系人详情 GET /api/house/contacts/${param0}/ */
export function houseContactsContactIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseContactsContactIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.ContactOut>(`/api/house/contacts/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新联系人 PATCH /api/house/contacts/${param0}/ */
export function houseContactsContactIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseContactsContactIdUsingPatchParams;
  body: API.ContactPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { contact_id: param0, ...queryParams } = params;

  return request<API.ContactOut>(`/api/house/contacts/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取默认楼栋 GET /api/house/default-building/ */
export function houseDefaultBuildingUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.DefaultBuildingOut>('/api/house/default-building/', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 设置默认楼栋 PUT /api/house/default-building/ */
export function houseDefaultBuildingUsingPut({
  body,
  options,
}: {
  body: API.DefaultBuildingIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.DefaultBuildingOut>('/api/house/default-building/', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取项目片区列表 GET /api/house/estates/ */
export function houseEstatesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseEstatesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedEstateOut>('/api/house/estates/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建项目片区 POST /api/house/estates/ */
export function houseEstatesUsingPost({
  body,
  options,
}: {
  body: API.EstateIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.EstateOut>('/api/house/estates/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取项目片区详情 GET /api/house/estates/${param0}/ */
export function houseEstatesEstateIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseEstatesEstateIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { estate_id: param0, ...queryParams } = params;

  return request<API.EstateOut>(`/api/house/estates/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除项目片区 DELETE /api/house/estates/${param0}/ */
export function houseEstatesEstateIdUsingDelete({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseEstatesEstateIdUsingDeleteParams;
  options?: CustomRequestOptions_;
}) {
  const { estate_id: param0, ...queryParams } = params;

  return request<Record<string, unknown>>(`/api/house/estates/${param0}/`, {
    method: 'DELETE',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新项目片区 PATCH /api/house/estates/${param0}/ */
export function houseEstatesEstateIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseEstatesEstateIdUsingPatchParams;
  body: API.EstatePatchIn;
  options?: CustomRequestOptions_;
}) {
  const { estate_id: param0, ...queryParams } = params;

  return request<API.EstateOut>(`/api/house/estates/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 检查项目片区删除关联资源 GET /api/house/estates/${param0}/delete-check/ */
export function houseEstatesEstateIdDeleteCheckUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseEstatesEstateIdDeleteCheckUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { estate_id: param0, ...queryParams } = params;

  return request<API.DeleteCheckOut>(
    `/api/house/estates/${param0}/delete-check/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取房源列表 GET /api/house/houses/ */
export function houseHousesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseHousesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedHouseOut>('/api/house/houses/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建房源 POST /api/house/houses/ */
export function houseHousesUsingPost({
  body,
  options,
}: {
  body: API.HouseIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.HouseOut>('/api/house/houses/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取房源详情 GET /api/house/houses/${param0}/ */
export function houseHousesHouseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseHousesHouseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { house_id: param0, ...queryParams } = params;

  return request<API.HouseOut>(`/api/house/houses/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新房源 PATCH /api/house/houses/${param0}/ */
export function houseHousesHouseIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseHousesHouseIdUsingPatchParams;
  body: API.HousePatchIn;
  options?: CustomRequestOptions_;
}) {
  const { house_id: param0, ...queryParams } = params;

  return request<API.HouseOut>(`/api/house/houses/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取租约列表 GET /api/house/leases/ */
export function houseLeasesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLeasesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedLeaseOut>('/api/house/leases/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建租约 POST /api/house/leases/ */
export function houseLeasesUsingPost({
  body,
  options,
}: {
  body: API.LeaseIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.LeaseOut>('/api/house/leases/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取租约详情 GET /api/house/leases/${param0}/ */
export function houseLeasesLeaseIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLeasesLeaseIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { lease_id: param0, ...queryParams } = params;

  return request<API.LeaseOut>(`/api/house/leases/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 更新租约 PATCH /api/house/leases/${param0}/ */
export function houseLeasesLeaseIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseLeasesLeaseIdUsingPatchParams;
  body: API.LeasePatchIn;
  options?: CustomRequestOptions_;
}) {
  const { lease_id: param0, ...queryParams } = params;

  return request<API.LeaseOut>(`/api/house/leases/${param0}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 获取带看记录列表 GET /api/house/viewing-records/ */
export function houseViewingRecordsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseViewingRecordsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedViewingRecordOut>('/api/house/viewing-records/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建带看记录 POST /api/house/viewing-records/ */
export function houseViewingRecordsUsingPost({
  body,
  options,
}: {
  body: API.ViewingRecordIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.ViewingRecordOut>('/api/house/viewing-records/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取带看记录详情 GET /api/house/viewing-records/${param0}/ */
export function houseViewingRecordsRecordIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseViewingRecordsRecordIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { record_id: param0, ...queryParams } = params;

  return request<API.ViewingRecordOut>(
    `/api/house/viewing-records/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 更新带看记录 PATCH /api/house/viewing-records/${param0}/ */
export function houseViewingRecordsRecordIdUsingPatch({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseViewingRecordsRecordIdUsingPatchParams;
  body: API.ViewingRecordPatchIn;
  options?: CustomRequestOptions_;
}) {
  const { record_id: param0, ...queryParams } = params;

  return request<API.ViewingRecordOut>(
    `/api/house/viewing-records/${param0}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}
