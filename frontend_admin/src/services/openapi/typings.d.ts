declare namespace API {
  type AccessRoleOut = {
    /** Id */
    id: number;
    /** Code */
    code: string;
    /** Name */
    name: string;
    /** Scope */
    scope: string;
    /** Is System */
    is_system: boolean;
    /** Is Active */
    is_active: boolean;
    /** Organization Id */
    organization_id?: number | null;
    /** Permission Keys */
    permission_keys: string[];
  };

  type AccessRoleSummaryOut = {
    /** Id */
    id: number;
    /** Code */
    code: string;
    /** Name */
    name: string;
    /** Scope */
    scope: string;
  };

  type AccessUserOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type AdminRealNameDecisionIn = {
    /** Note 审核备注或驳回原因。 */
    note?: string;
  };

  type AdminRealNameVerificationRowOut = {
    /** Id */
    id: number;
    /** Status */
    status: string;
    /** Status Label */
    status_label: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Source */
    source: string;
    /** Source Label */
    source_label: string;
    /** Source  Mapping */
    source__mapping: string;
    /** Provider */
    provider: string;
    /** Provider Label */
    provider_label: string;
    /** Provider  Mapping */
    provider__mapping: string;
    /** Real Name Masked */
    real_name_masked: string;
    /** Id Number Masked */
    id_number_masked: string;
    /** Failure Reason */
    failure_reason?: string;
    /** Review Note */
    review_note?: string;
    /** Reviewed By */
    reviewed_by?: string | null;
    /** Reviewed At */
    reviewed_at?: string | null;
    /** Provider Request Id */
    provider_request_id?: string;
    /** Provider Result */
    provider_result?: Record<string, any>;
    /** Id Card Media */
    id_card_media?: RealNameIdCardMediaOut[];
    /** Is Current */
    is_current: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
    /** User */
    user: Record<string, any>;
  };

  type AdminUserCreateIn = {
    /** Username 用户名。 */
    username: string;
    /** Email 邮箱。 */
    email: string;
    /** First Name 名字。 */
    first_name?: string;
    /** Last Name 姓氏。 */
    last_name?: string;
    /** Timezone 时区。 */
    timezone?: string;
    /** Phone Country Code 手机号国家区号。 */
    phone_country_code?: string;
    /** Phone National Number 手机号本地号码。 */
    phone_national_number?: string;
    /** Phone Verified 手机号是否已验证。 */
    phone_verified?: boolean;
    /** Is Active 是否启用。 */
    is_active?: boolean;
    /** Is Staff 是否为管理员。 */
    is_staff?: boolean;
    /** Is Superuser 是否为超级管理员。 */
    is_superuser?: boolean;
    /** Password 初始密码。 */
    password: string;
  };

  type AdminUserOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Real Name Status */
    real_name_status?: string;
    /** Real Name Status  Mapping */
    real_name_status__mapping?: string;
    /** Real Name Masked */
    real_name_masked?: string;
    /** Id Number Masked */
    id_number_masked?: string;
    /** Timezone */
    timezone: string;
    /** Avatar Url */
    avatar_url?: string | null;
    /** Email */
    email?: string;
    /** Phone Country Code */
    phone_country_code?: string;
    /** Phone National Number */
    phone_national_number?: string;
    /** Phone Verified */
    phone_verified: boolean;
    /** Is Active */
    is_active: boolean;
    /** Is Staff */
    is_staff: boolean;
    /** Is Superuser */
    is_superuser: boolean;
    /** Role */
    role?: string;
    /** Role  Mapping */
    role__mapping?: string;
  };

  type AdminUserPasswordIn = {
    /** Password 新密码。 */
    password: string;
  };

  type AdminUserPatchIn = {
    /** Username 用户名。 */
    username?: string | null;
    /** Email 邮箱。 */
    email?: string | null;
    /** First Name 名字。 */
    first_name?: string | null;
    /** Last Name 姓氏。 */
    last_name?: string | null;
    /** Timezone 时区。 */
    timezone?: string | null;
    /** Phone Country Code 手机号国家区号。 */
    phone_country_code?: string | null;
    /** Phone National Number 手机号本地号码。 */
    phone_national_number?: string | null;
    /** Phone Verified 手机号是否已验证。 */
    phone_verified?: boolean | null;
    /** Is Active 是否启用。 */
    is_active?: boolean | null;
    /** Is Staff 是否为管理员。 */
    is_staff?: boolean | null;
    /** Is Superuser 是否为超级管理员。 */
    is_superuser?: boolean | null;
  };

  type AppContextOrgOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Slug */
    slug: string;
    /** Is Owner */
    is_owner: boolean;
  };

  type AppContextOut = {
    user: AppContextUserOut | null;
    org: AppContextOrgOut | null;
    /** Organizations */
    organizations: Record<string, any>[];
    /** Orgmembercount */
    orgMemberCount: number;
    /** Orgownercount */
    orgOwnerCount: number;
    /** Sitename */
    siteName: string;
    /** Instance */
    instance: string;
    /** Signupopen */
    signupOpen: boolean;
    /** Version */
    version: string;
    /** Amapjsapikey */
    amapJsapiKey?: string;
    /** Amapsecurityjscode */
    amapSecurityJsCode?: string;
  };

  type AppContextUserOut = {
    /** Id */
    id: number;
    /** Email */
    email: string;
    /** Username */
    username: string;
    /** First Name */
    first_name: string;
    /** Last Name */
    last_name: string;
    /** Timezone */
    timezone: string;
    /** Timezone Display */
    timezone_display: string;
    /** Avatar Url */
    avatar_url: string | null;
    /** Phone Country Code */
    phone_country_code: string;
    /** Phone National Number */
    phone_national_number: string;
    /** Phone Verified */
    phone_verified: boolean;
    /** Real Name Status */
    real_name_status: string;
    /** Real Name Masked */
    real_name_masked?: string;
    /** Id Number Masked */
    id_number_masked?: string;
    /** Is Staff */
    is_staff: boolean;
    /** Is Superuser */
    is_superuser: boolean;
    /** Is Hijacked */
    is_hijacked: boolean;
    /** Organizations */
    organizations: Record<string, any>[];
  };

  type appsAccessApiCreateTeamBindingParams = {
    team_id: number;
  };

  type appsAccessApiCreateTeamRoleParams = {
    team_id: number;
  };

  type appsAccessApiDeleteOrganizationBindingParams = {
    binding_id: number;
  };

  type appsAccessApiDeleteOrgRoleParams = {
    role_id: number;
  };

  type appsAccessApiDeleteTeamBindingParams = {
    team_id: number;
    binding_id: number;
  };

  type appsAccessApiDeleteTeamRoleParams = {
    team_id: number;
    role_id: number;
  };

  type appsAccessApiListTeamBindingsViewParams = {
    team_id: number;
  };

  type appsAccessApiListTeamRolesParams = {
    team_id: number;
  };

  type appsAccessApiPatchOrgRoleParams = {
    role_id: number;
  };

  type appsAccessApiPatchTeamRoleParams = {
    team_id: number;
    role_id: number;
  };

  type appsAccountsApiApproveAdminRealNameParams = {
    verification_id: number;
  };

  type appsAccountsApiDeleteMyAuthenticatorParams = {
    authenticator_type: string;
  };

  type appsAccountsApiForceLogoutUserParams = {
    user_id: number;
  };

  type appsAccountsApiGetAdminRealNameVerificationParams = {
    verification_id: number;
  };

  type appsAccountsApiGetUserParams = {
    user_id: number;
  };

  type appsAccountsApiImpersonateSearchParams = {
    /** 按姓名、用户名或邮箱搜索。 */
    keyword?: string;
  };

  type appsAccountsApiListAdminRealNameVerificationsParams = {
    /** 按用户名、邮箱、手机号、实名或身份证脱敏值搜索。 */
    keyword?: string | null;
    /** 按实名状态筛选。 */
    status?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsAccountsApiListAdminUsersParams = {
    /** 按姓名、用户名、邮箱、手机号或实名展示搜索。 */
    keyword?: string | null;
    /** 按用户名搜索。 */
    username?: string | null;
    /** 按手机号搜索。 */
    phone?: string | null;
    /** 按实名状态筛选。 */
    real_name_status?: string | null;
    /** 按权限筛选：superuser/staff/user。 */
    role?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsAccountsApiListUsersParams = {
    /** 按用户姓名搜索。 */
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsAccountsApiMoveAdminRealNameToManualReviewParams = {
    verification_id: number;
  };

  type appsAccountsApiPatchAdminUserParams = {
    user_id: number;
  };

  type appsAccountsApiPatchUserParams = {
    user_id: number;
  };

  type appsAccountsApiPatchUserStatusParams = {
    user_id: number;
  };

  type appsAccountsApiRejectAdminRealNameParams = {
    verification_id: number;
  };

  type appsAccountsApiResetUserMfaParams = {
    user_id: number;
  };

  type appsAccountsApiRevokeAdminRealNameParams = {
    verification_id: number;
  };

  type appsAccountsApiSetAdminUserPasswordParams = {
    user_id: number;
  };

  type appsAccountsApiUnbindUserPhoneParams = {
    user_id: number;
  };

  type appsAccountsApiUnbindUserWechatParams = {
    user_id: number;
  };

  type appsHouseApiCheckBuildingDeleteParams = {
    building_id: number;
  };

  type appsHouseApiCheckEstateDeleteParams = {
    estate_id: number;
  };

  type appsHouseApiDeleteBuildingEndpointParams = {
    building_id: number;
  };

  type appsHouseApiDeleteEstateEndpointParams = {
    estate_id: number;
  };

  type appsHouseApiGetBuildingParams = {
    building_id: number;
  };

  type appsHouseApiGetContactParams = {
    contact_id: number;
  };

  type appsHouseApiGetEstateParams = {
    estate_id: number;
  };

  type appsHouseApiGetHouseParams = {
    house_id: number;
  };

  type appsHouseApiGetLeaseParams = {
    lease_id: number;
  };

  type appsHouseApiGetViewingRecordParams = {
    record_id: number;
  };

  type appsHouseApiListBuildingsParams = {
    estate_id?: number | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListContactsParams = {
    role?: string | null;
    task?: string | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListEstatesParams = {
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListHousesParams = {
    estate_id?: number | null;
    building_id?: number | null;
    status?: string | null;
    publish_status?: string | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListLeasesParams = {
    house_id?: number | null;
    status?: string | null;
    contract_missing?: boolean | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListMyHousesParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListMyLeasesParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListViewingRecordsParams = {
    house_id?: number | null;
    status?: string | null;
    pending_lease?: boolean | null;
    contact_missing?: boolean | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiPatchBuildingParams = {
    building_id: number;
  };

  type appsHouseApiPatchContactParams = {
    contact_id: number;
  };

  type appsHouseApiPatchEstateParams = {
    estate_id: number;
  };

  type appsHouseApiPatchHouseParams = {
    house_id: number;
  };

  type appsHouseApiPatchLeaseParams = {
    lease_id: number;
  };

  type appsHouseApiPatchViewingRecordParams = {
    record_id: number;
  };

  type appsMediaApiOssTokenParams = {
    /** 上传作用域，user 表示个人，org 表示当前租户。 */
    scope: "user" | "org";
    /** 原始文件名，用于生成上传路径。 */
    filename: string;
    /** 可选资源类型，用于在签发上传凭证前校验作用域与扩展名。 */
    resource_type?: string | null;
  };

  type appsNotificationsApiDeleteNotificationParams = {
    notification_id: number;
  };

  type appsNotificationsApiGetDispatchParams = {
    dispatch_id: number;
  };

  type appsNotificationsApiGetNotificationParams = {
    notification_id: number;
  };

  type appsNotificationsApiListDispatchesParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsNotificationsApiListDispatchNotificationsParams = {
    dispatch_id: number;
    page?: number;
    page_size?: number | null;
  };

  type appsNotificationsApiListNotificationsParams = {
    /** 按已读状态筛选。 */
    is_read?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsNotificationsApiPatchNotificationParams = {
    notification_id: number;
  };

  type appsNotificationsApiPatchPreferenceParams = {
    /** 通知类别 key。 */
    category: string;
  };

  type appsOrganizationsApiAcceptInviteByKeyParams = {
    /** 邀请 key。 */
    key: string;
  };

  type appsOrganizationsApiDeclineInviteByKeyParams = {
    /** 邀请 key。 */
    key: string;
  };

  type appsOrganizationsApiDeleteInviteParams = {
    invite_id: number;
  };

  type appsOrganizationsApiDeleteMemberParams = {
    member_id: number;
  };

  type appsOrganizationsApiGetInviteByKeyParams = {
    /** 邀请 key。 */
    key: string;
  };

  type appsOrganizationsApiGetInviteParams = {
    invite_id: number;
  };

  type appsOrganizationsApiGetMemberParams = {
    member_id: number;
  };

  type appsOrganizationsApiGetOrganizationParams = {
    slug: string;
  };

  type appsOrganizationsApiGetOrganizationUsageParams = {
    slug: string;
  };

  type appsOrganizationsApiListInvitesParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsOrganizationsApiListMembersParams = {
    /** 按姓名、用户名或邮箱搜索成员。 */
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsOrganizationsApiPatchMemberParams = {
    member_id: number;
  };

  type appsOrganizationsApiPatchOrganizationParams = {
    slug: string;
  };

  type appsOrganizationsApiPatchOrganizationStatusParams = {
    slug: string;
  };

  type appsOrganizationsApiResendInviteParams = {
    invite_id: number;
  };

  type appsOrganizationsApiSearchMembersParams = {
    /** 待搜索的用户关键字。 */
    keyword?: string;
  };

  type appsOrganizationsApiSelectOrgParams = {
    /** 租户 slug。 */
    slug: string;
  };

  type appsOrganizationsApiSetPrimaryParams = {
    /** 租户 slug。 */
    slug: string;
  };

  type appsOrganizationsApiTransferOwnerParams = {
    slug: string;
  };

  type appsReferralsApiAdminReferralRecordsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsReferralsApiMyReferralRecordsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsReferralsApiReviewReferralRecordParams = {
    record_id: number;
  };

  type appsSettingsApiDeleteOrgSettingViewParams = {
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiDeleteTeamSettingViewParams = {
    team_id: number;
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiDeleteUserSettingViewParams = {
    /** 个人设置 key。 */
    key: string;
  };

  type appsSettingsApiGetOrgSettingViewParams = {
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiGetTeamSettingViewParams = {
    team_id: number;
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiGetUserSettingViewParams = {
    /** 个人设置 key。 */
    key: string;
  };

  type appsSettingsApiListTeamSettingsParams = {
    team_id: number;
  };

  type appsSettingsApiPutOrgSettingParams = {
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiPutTeamSettingParams = {
    team_id: number;
    /** 设置项 key。 */
    key: string;
  };

  type appsSettingsApiPutUserSettingParams = {
    /** 个人设置 key。 */
    key: string;
  };

  type appsTeamsApiDeleteTeamParams = {
    team_id: number;
  };

  type appsTeamsApiGetTeamParams = {
    team_id: number;
  };

  type appsTeamsApiListTeamsParams = {
    /** 按团队名称搜索。 */
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsTeamsApiPatchTeamParams = {
    team_id: number;
  };

  type appsWalletApiAdminWalletLedgerParams = {
    user_id: number;
    page?: number;
    page_size?: number | null;
  };

  type appsWalletApiAdminWithdrawalsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsWalletApiCancelUserWithdrawalParams = {
    withdrawal_id: number;
  };

  type appsWalletApiGetWithdrawalParams = {
    withdrawal_id: number;
  };

  type appsWalletApiListWalletAccountsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsWalletApiListWithdrawalsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsWalletApiPayoutCallbackParams = {
    provider: string;
  };

  type appsWalletApiPayoutWithdrawalParams = {
    withdrawal_id: number;
  };

  type appsWalletApiRetryWithdrawalParams = {
    withdrawal_id: number;
  };

  type appsWalletApiReviewWithdrawalParams = {
    withdrawal_id: number;
  };

  type appsWalletApiWalletLedgerParams = {
    page?: number;
    page_size?: number | null;
  };

  type BuildingIn = {
    /** Estate Id */
    estate_id?: number | null;
    /** Name */
    name: string;
    /** Floors */
    floors: number;
    /** Under Floors */
    under_floors?: number | null;
    /** Year Built */
    year_built?: number | null;
    /** Elevator */
    elevator?: boolean;
    /** Lat */
    lat?: number | string | null;
    /** Lng */
    lng?: number | string | null;
    /** Address */
    address?: string;
    /** Is Active */
    is_active?: boolean;
  };

  type BuildingOut = {
    /** Id */
    id: number;
    /** Estate Id */
    estate_id: number | null;
    estate: EstateSummaryOut | null;
    /** Name */
    name: string;
    /** Floors */
    floors: number;
    /** Under Floors */
    under_floors: number | null;
    /** Year Built */
    year_built: number | null;
    /** Elevator */
    elevator: boolean;
    /** Lat */
    lat: string | null;
    /** Lng */
    lng: string | null;
    /** Address */
    address: string;
    /** Is Active */
    is_active: boolean;
  };

  type BuildingPatchIn = {
    /** Estate Id */
    estate_id?: number | null;
    /** Name */
    name?: string | null;
    /** Floors */
    floors?: number | null;
    /** Under Floors */
    under_floors?: number | null;
    /** Year Built */
    year_built?: number | null;
    /** Elevator */
    elevator?: boolean | null;
    /** Lat */
    lat?: number | string | null;
    /** Lng */
    lng?: number | string | null;
    /** Address */
    address?: string | null;
    /** Is Active */
    is_active?: boolean | null;
  };

  type BuildingSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Estate Id */
    estate_id: number | null;
    estate: EstateSummaryOut | null;
    /** Address */
    address: string;
  };

  type BulkActionIn = {
    /** Action 批量操作类型。 */
    action: "mark_read" | "mark_unread" | "delete";
    /** Ids 要处理的通知 ID 列表。 */
    ids?: number[] | null;
    /** All Unread 是否对全部未读通知执行操作。 */
    all_unread?: boolean;
  };

  type BulkResultOut = {
    /** Updated */
    updated?: number;
    /** Deleted */
    deleted?: number;
  };

  type ContactIn = {
    /** Name */
    name: string;
    /** Phone */
    phone: string;
    /** Email */
    email?: string;
    /** Roles */
    roles?: string[];
    /** Notes */
    notes?: string;
    /** Is Active */
    is_active?: boolean;
  };

  type ContactOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Phone */
    phone: string;
    /** Email */
    email: string;
    /** Roles */
    roles: string[];
    /** Roles  Mapping */
    roles__mapping: string[];
    /** User Id */
    user_id: number | null;
    /** Notes */
    notes: string;
    /** Is Active */
    is_active: boolean;
  };

  type ContactPatchIn = {
    /** Name */
    name?: string | null;
    /** Phone */
    phone?: string | null;
    /** Email */
    email?: string | null;
    /** Roles */
    roles?: string[] | null;
    /** Notes */
    notes?: string | null;
    /** Is Active */
    is_active?: boolean | null;
  };

  type ContactSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Phone */
    phone: string;
  };

  type CustomRoleCreateIn = {
    /** Name 角色显示名称，需在当前作用域内唯一。 */
    name: string;
    /** Permission Keys 角色拥有的权限 key 列表。 */
    permission_keys?: string[] | null;
    /** Copy From 可选，基于现有角色复制权限配置的角色 ID。 */
    copy_from?: number | null;
  };

  type CustomRolePatchIn = {
    /** Name 新的角色显示名称，需在当前作用域内唯一。 */
    name?: string | null;
    /** Permission Keys 新的权限 key 列表。 */
    permission_keys?: string[] | null;
  };

  type DefaultBuildingIn = {
    /** Building Id */
    building_id: number;
  };

  type DefaultBuildingOut = {
    /** Id */
    id: number;
    /** Estate Id */
    estate_id: number | null;
    estate: EstateSummaryOut | null;
    /** Name */
    name: string;
    /** Floors */
    floors: number;
    /** Address */
    address: string;
  };

  type DeleteCheckOut = {
    /** Can Delete */
    can_delete: boolean;
    /** Resources */
    resources: RelatedResourceOut[];
  };

  type EstateIn = {
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
    /** Developer */
    developer?: string | null;
    /** Built Year */
    built_year?: number | null;
    /** Property Type */
    property_type?: string;
    /** Province */
    province: string;
    /** City */
    city: string;
    /** District */
    district: string;
    /** Address */
    address?: string;
    /** Lat */
    lat?: number | string | null;
    /** Lng */
    lng?: number | string | null;
    /** Images */
    images?: Record<string, any>[];
    /** Description */
    description?: string;
    /** Is Active */
    is_active?: boolean;
  };

  type EstateOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
    /** Property Type */
    property_type: string;
    /** Property Type  Mapping */
    property_type__mapping: string;
    /** Province */
    province: string;
    /** City */
    city: string;
    /** District */
    district: string;
    /** Address */
    address: string;
    /** Lat */
    lat: string | null;
    /** Lng */
    lng: string | null;
    /** Images */
    images: Record<string, any>[];
    /** Is Active */
    is_active: boolean;
  };

  type EstatePatchIn = {
    /** Name */
    name?: string | null;
    /** Display Name */
    display_name?: string | null;
    /** Developer */
    developer?: string | null;
    /** Built Year */
    built_year?: number | null;
    /** Property Type */
    property_type?: string | null;
    /** Province */
    province?: string | null;
    /** City */
    city?: string | null;
    /** District */
    district?: string | null;
    /** Address */
    address?: string | null;
    /** Lat */
    lat?: number | string | null;
    /** Lng */
    lng?: number | string | null;
    /** Images */
    images?: Record<string, any>[] | null;
    /** Description */
    description?: string | null;
    /** Is Active */
    is_active?: boolean | null;
  };

  type EstateSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
  };

  type ForceLogoutOut = {
    /** Deleted Sessions */
    deleted_sessions: number;
  };

  type HouseIn = {
    /** Building Id */
    building_id: number;
    /** Landlord Id */
    landlord_id?: number | null;
    /** Room Number */
    room_number: string;
    /** Floor */
    floor?: number | null;
    /** Area */
    area?: number | string | null;
    /** Interior Area */
    interior_area?: number | string | null;
    /** Asking Rent */
    asking_rent?: number | string | null;
    /** Deposit Amount */
    deposit_amount?: number | string | null;
    /** Bedrooms */
    bedrooms?: number | null;
    /** Living Rooms */
    living_rooms?: number | null;
    /** Bathrooms */
    bathrooms?: number | null;
    /** Kitchens */
    kitchens?: number | null;
    /** Balconies */
    balconies?: number | null;
    /** Orientation */
    orientation?: string | null;
    /** Decoration */
    decoration?: string | null;
    /** Has Elevator Access */
    has_elevator_access?: boolean;
    /** Images */
    images?: Record<string, any>[];
    /** Videos */
    videos?: Record<string, any>[];
    /** Tags */
    tags?: string[];
    /** Public Description */
    public_description?: string;
  };

  type HouseOut = {
    /** Id */
    id: number;
    /** Building Id */
    building_id: number;
    building: BuildingSummaryOut;
    /** Landlord Id */
    landlord_id: number | null;
    landlord: ContactSummaryOut | null;
    /** Room Number */
    room_number: string;
    /** Floor */
    floor: number | null;
    /** Area */
    area: string | null;
    /** Interior Area */
    interior_area: string | null;
    /** Asking Rent */
    asking_rent: string | null;
    /** Deposit Amount */
    deposit_amount: string | null;
    /** Bedrooms */
    bedrooms: number | null;
    /** Living Rooms */
    living_rooms: number | null;
    /** Bathrooms */
    bathrooms: number | null;
    /** Kitchens */
    kitchens: number | null;
    /** Balconies */
    balconies: number | null;
    /** Orientation */
    orientation: string | null;
    /** Orientation  Mapping */
    orientation__mapping: string;
    /** Decoration */
    decoration: string | null;
    /** Decoration  Mapping */
    decoration__mapping: string;
    /** Has Elevator Access */
    has_elevator_access: boolean;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Publish Status */
    publish_status: string;
    /** Publish Status  Mapping */
    publish_status__mapping: string;
    /** Images */
    images: Record<string, any>[];
    /** Videos */
    videos: Record<string, any>[];
    /** Tags */
    tags: string[];
    /** Public Description */
    public_description: string;
    /** Internal Notes */
    internal_notes: string;
    /** Extra */
    extra: Record<string, any>;
    /** Is Active */
    is_active: boolean;
  };

  type HousePatchIn = {
    /** Building Id */
    building_id?: number | null;
    /** Landlord Id */
    landlord_id?: number | null;
    /** Room Number */
    room_number?: string | null;
    /** Floor */
    floor?: number | null;
    /** Area */
    area?: number | string | null;
    /** Interior Area */
    interior_area?: number | string | null;
    /** Asking Rent */
    asking_rent?: number | string | null;
    /** Deposit Amount */
    deposit_amount?: number | string | null;
    /** Bedrooms */
    bedrooms?: number | null;
    /** Living Rooms */
    living_rooms?: number | null;
    /** Bathrooms */
    bathrooms?: number | null;
    /** Kitchens */
    kitchens?: number | null;
    /** Balconies */
    balconies?: number | null;
    /** Orientation */
    orientation?: string | null;
    /** Decoration */
    decoration?: string | null;
    /** Has Elevator Access */
    has_elevator_access?: boolean | null;
    /** Status */
    status?: string | null;
    /** Publish Status */
    publish_status?: string | null;
    /** Images */
    images?: Record<string, any>[] | null;
    /** Videos */
    videos?: Record<string, any>[] | null;
    /** Tags */
    tags?: string[] | null;
    /** Public Description */
    public_description?: string | null;
    /** Internal Notes */
    internal_notes?: string | null;
    /** Extra */
    extra?: Record<string, any> | null;
    /** Is Active */
    is_active?: boolean | null;
  };

  type HouseSummaryOut = {
    /** Id */
    id: number;
    /** Label */
    label: string;
    /** Room Number */
    room_number: string;
    /** Building Id */
    building_id: number;
    building: BuildingSummaryOut;
  };

  type ImpersonateUserOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** Email */
    email?: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Full Name */
    full_name: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type Input = {
    /** Page */
    page?: number;
    /** Page Size */
    page_size?: number | null;
  };

  type InviteIn = {
    /** Invitee Email 被邀请人邮箱，可用于未注册用户邀请。 */
    invitee_email?: string;
    /** Invitee 被邀请用户 ID，可用于站内已存在用户邀请。 */
    invitee?: number | null;
    /** Is Owner 接受邀请后是否授予租户 owner 权限。 */
    is_owner?: boolean;
    /** Access Role 接受邀请后预设绑定的组织级访问角色。 */
    access_role?: number | null;
  };

  type InviteOut = {
    /** Pk */
    pk: number;
    /** Organization */
    organization: number;
    /** Sender */
    sender: number;
    /** Invitee */
    invitee?: number | null;
    /** Invitee Email */
    invitee_email?: string;
    /** Is Owner */
    is_owner: boolean;
    /** Access Role */
    access_role?: number | null;
    /** Key */
    key: string;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type LeaseIn = {
    /** House Id */
    house_id: number;
    /** Tenant Id */
    tenant_id: number;
    /** Source Viewing Record Id */
    source_viewing_record_id?: number | null;
    /** Sign At */
    sign_at?: string | null;
    /** Start Date */
    start_date: string;
    /** End Date */
    end_date: string;
    /** Monthly Rent */
    monthly_rent: number | string;
    /** Deposit */
    deposit?: number | string | null;
    /** Payment Day */
    payment_day?: number;
    /** Contract Files */
    contract_files?: Record<string, any>[];
    /** Notes */
    notes?: string;
    /** Extra */
    extra?: Record<string, any>;
  };

  type LeaseOut = {
    /** Id */
    id: number;
    /** House Id */
    house_id: number;
    house: HouseSummaryOut;
    /** Tenant Id */
    tenant_id: number;
    tenant: ContactSummaryOut;
    /** Source Viewing Record Id */
    source_viewing_record_id: number | null;
    source_viewing_record: ViewingRecordSummaryOut | null;
    /** Sign At */
    sign_at: string | null;
    /** Start Date */
    start_date: string;
    /** End Date */
    end_date: string;
    /** Monthly Rent */
    monthly_rent: string;
    /** Deposit */
    deposit: string | null;
    /** Payment Day */
    payment_day: number;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Contract Files */
    contract_files: Record<string, any>[];
    /** Notes */
    notes: string;
    /** Extra */
    extra: Record<string, any>;
  };

  type LeasePatchIn = {
    /** House Id */
    house_id?: number | null;
    /** Tenant Id */
    tenant_id?: number | null;
    /** Source Viewing Record Id */
    source_viewing_record_id?: number | null;
    /** Sign At */
    sign_at?: string | null;
    /** Start Date */
    start_date?: string | null;
    /** End Date */
    end_date?: string | null;
    /** Monthly Rent */
    monthly_rent?: number | string | null;
    /** Deposit */
    deposit?: number | string | null;
    /** Payment Day */
    payment_day?: number | null;
    /** Status */
    status?: string | null;
    /** Contract Files */
    contract_files?: Record<string, any>[] | null;
    /** Notes */
    notes?: string | null;
    /** Extra */
    extra?: Record<string, any> | null;
  };

  type MediaFileConfirmIn = {
    /** Oss Path 对象存储中的文件路径。 */
    oss_path: string;
    /** Original Filename 用户上传时的原始文件名。 */
    original_filename: string;
    /** Resource Type 资源类型，例如 avatar、org_logo。 */
    resource_type: string;
    /** File Size 文件大小，单位字节。 */
    file_size: number;
  };

  type MediaFileOut = {
    /** Id */
    id: number;
    /** Resource Type */
    resource_type: string;
    /** Original Filename */
    original_filename: string;
    /** Url */
    url: string;
    /** File Size */
    file_size: number;
    /** Created At */
    created_at: string;
  };

  type MediaRefIn = {
    /** Media Id 媒体文件 ID。 */
    media_id: number;
    /** Media Type 媒体类型，例如 image、video、file。 */
    media_type?: "image" | "video" | "file";
  };

  type MemberDetailOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type MemberIn = {
    /** User 要添加到租户的用户 ID。 */
    user: number;
    /** Is Owner 是否授予该成员租户 owner 权限。 */
    is_owner?: boolean;
  };

  type MemberOut = {
    /** Pk */
    pk: number;
    /** Organization */
    organization: number;
    user: OrgUserOut;
    /** Is Owner */
    is_owner: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type MemberPatchIn = {
    /** Is Owner 是否修改为租户 owner。 */
    is_owner?: boolean | null;
  };

  type MemberSearchOut = {
    /** Pk */
    pk: number;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Username */
    username: string;
    /** Email */
    email?: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type MeOut = {
    /** Id */
    id: number;
    /** Email */
    email: string;
    /** Username */
    username: string;
    /** First Name */
    first_name: string;
    /** Last Name */
    last_name: string;
    /** Timezone */
    timezone: string;
    /** Avatar */
    avatar?: ResolvedMediaRefOut[];
    /** Phone Country Code */
    phone_country_code?: string;
    /** Phone National Number */
    phone_national_number?: string;
    /** Phone Verified */
    phone_verified: boolean;
    /** Real Name Status */
    real_name_status: string;
    /** Real Name Status  Mapping */
    real_name_status__mapping: string;
    /** Real Name Masked */
    real_name_masked?: string;
    /** Id Number Masked */
    id_number_masked?: string;
    /** Real Name Verified At */
    real_name_verified_at?: string | null;
    /** Is Staff */
    is_staff: boolean;
    /** Is Superuser */
    is_superuser: boolean;
    /** Signature */
    signature?: string;
    /** Country */
    country?: string;
    /** Tags */
    tags?: Record<string, any>[];
    /** Notice */
    notice?: Record<string, any>[];
    /** Notify Count */
    notify_count?: number;
    /** Unread Count */
    unread_count?: number;
  };

  type NotificationActorOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** Full Name */
    full_name: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type NotificationDispatchIn = {
    /** Scope */
    scope: "platform" | "organization" | "users";
    /** Scope Ids */
    scope_ids?: number[];
    /** Category */
    category?: string;
    /** Title */
    title: string;
    /** Body */
    body?: string;
    /** Url */
    url?: string | null;
    /** Data */
    data?: Record<string, any>;
  };

  type NotificationDispatchOut = {
    /** Id */
    id: number;
    /** Scope */
    scope: string;
    /** Scope  Mapping */
    scope__mapping: string;
    /** Scope Ids */
    scope_ids: number[];
    /** Owner Organization Id */
    owner_organization_id?: number | null;
    /** Category */
    category: string;
    /** Title */
    title: string;
    /** Body */
    body: string;
    /** Url */
    url?: string | null;
    /** Data */
    data: Record<string, any>;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Target Count */
    target_count: number;
    /** Delivered Count */
    delivered_count: number;
    /** Error Message */
    error_message: string;
    /** Sent At */
    sent_at?: string | null;
    /** Created By */
    created_by: string;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type NotificationOut = {
    /** Id */
    id: number;
    /** Title */
    title: string;
    /** Body */
    body: string;
    /** Url */
    url?: string | null;
    /** Is Read */
    is_read: boolean;
    /** Created At */
    created_at: string;
    actor?: NotificationActorOut | null;
  };

  type NotificationPatchIn = {
    /** Is Read 通知是否标记为已读。 */
    is_read?: boolean | null;
  };

  type NotificationPreferenceOut = {
    /** Key */
    key: string;
    /** Label */
    label: string;
    /** Description */
    description?: string;
    /** Default Channels */
    default_channels?: string[];
    /** Default Channels  Mapping */
    default_channels__mapping: string[];
    /** In App */
    in_app: boolean;
    /** Email */
    email: boolean;
  };

  type NotificationPreferencePatchIn = {
    /** In App 是否接收站内通知。 */
    in_app?: boolean | null;
    /** Email 是否接收邮件通知。 */
    email?: boolean | null;
  };

  type OrganizationBindingOut = {
    /** Id */
    id: number;
    /** Organization Id */
    organization_id: number;
    user: AccessUserOut;
    role: AccessRoleSummaryOut;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type OrganizationCreateIn = {
    /** Name 租户名称。 */
    name: string;
    /** Slug 租户 slug，用于切换与公开链接。 */
    slug: string;
  };

  type OrganizationCreateOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Slug */
    slug: string;
  };

  type OrganizationOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Slug */
    slug: string;
    /** Billing Email */
    billing_email?: string | null;
    /** Is Active */
    is_active: boolean;
    /** Member Limit */
    member_limit?: number | null;
    /** Team Limit */
    team_limit?: number | null;
  };

  type OrganizationPatchIn = {
    /** Name 租户显示名称。 */
    name?: string | null;
    /** Slug 租户 slug。 */
    slug?: string | null;
    /** Billing Email 租户账单联系邮箱。 */
    billing_email?: string | null;
    /** Member Limit 成员数量上限，null 表示不限。 */
    member_limit?: number | null;
    /** Team Limit 团队数量上限，null 表示不限。 */
    team_limit?: number | null;
  };

  type OrganizationStatusPatchIn = {
    /** Is Active 是否启用租户。 */
    is_active: boolean;
  };

  type OrganizationUsageOut = {
    /** Member Count */
    member_count: number;
    /** Team Count */
    team_count: number;
    /** Member Limit */
    member_limit?: number | null;
    /** Team Limit */
    team_limit?: number | null;
  };

  type OrgSelectOut = {
    /** Id */
    id: number;
    /** Slug */
    slug: string;
    /** Name */
    name: string;
    /** Is Owner */
    is_owner: boolean;
  };

  type OrgUserOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Email */
    email?: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type OssTokenIn = {
    /** Scope 上传作用域，user 表示个人，org 表示当前租户。 */
    scope: "user" | "org";
    /** Filename 原始文件名，用于生成上传路径。 */
    filename: string;
    /** Resource Type 可选资源类型，用于在签发上传凭证前校验作用域与扩展名。 */
    resource_type?: string | null;
  };

  type OssTokenOut = {
    /** Access Key Id */
    access_key_id: string;
    /** Access Key Secret */
    access_key_secret: string;
    /** Security Token */
    security_token: string;
    /** Endpoint */
    endpoint: string;
    /** Bucket */
    bucket: string;
    /** Path */
    path: string;
    /** Expires At */
    expires_at: string;
  };

  type PagedAdminRealNameVerificationRowOut = {
    /** Items */
    items: AdminRealNameVerificationRowOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedAdminUserOut = {
    /** Items */
    items: AdminUserOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedBuildingOut = {
    /** Items */
    items: BuildingOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedContactOut = {
    /** Items */
    items: ContactOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedEstateOut = {
    /** Items */
    items: EstateOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedHouseOut = {
    /** Items */
    items: HouseOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedInviteOut = {
    /** Items */
    items: InviteOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedLeaseOut = {
    /** Items */
    items: LeaseOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedMemberOut = {
    /** Items */
    items: MemberOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedNotificationDispatchOut = {
    /** Items */
    items: NotificationDispatchOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedNotificationOut = {
    /** Items */
    items: NotificationOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedReferralRecordOut = {
    /** Items */
    items: ReferralRecordOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedTeamOut = {
    /** Items */
    items: TeamOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedUserOut = {
    /** Items */
    items: UserOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedViewingRecordOut = {
    /** Items */
    items: ViewingRecordOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedWalletAccountAdminOut = {
    /** Items */
    items: WalletAccountAdminOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedWalletLedgerOut = {
    /** Items */
    items: WalletLedgerOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedWithdrawalOut = {
    /** Items */
    items: WithdrawalOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PayoutCreateIn = {
    /** Provider */
    provider: string;
    /** Out Trade No */
    out_trade_no: string;
    /** Request Payload */
    request_payload?: Record<string, any>;
    /** Idempotency Key */
    idempotency_key: string;
  };

  type PermissionOut = {
    /** Key */
    key: string;
    /** Name */
    name: string;
    /** App Label */
    app_label: string;
    /** Codename */
    codename: string;
  };

  type PhoneCodeVerifyIn = {
    /** Code 短信验证码。 */
    code: string;
  };

  type PublicInviteOut = {
    /** Organization Name */
    organization_name: string;
    /** Sender Name */
    sender_name: string;
    /** Invitee Email */
    invitee_email?: string;
    /** Is Expired */
    is_expired: boolean;
    /** Is Already Member */
    is_already_member: boolean;
  };

  type RealNameIdCardMediaIn = {
    /** Media Id 媒体文件 ID。 */
    media_id: number;
    /** Media Type 媒体类型。实名认证固定为 image。 */
    media_type?: string;
    /** Side 身份证面：front 人像面，back 国徽面。 */
    side: "front" | "back";
  };

  type RealNameIdCardMediaOut = {
    /** Media Id */
    media_id: number;
    /** Resource Type 媒体资源类型，例如 avatar、real_name_id_card。 */
    resource_type?: string | null;
    /** Original Filename 原始文件名。 */
    original_filename?: string | null;
    /** Url 动态生成的访问 URL，私有存储通常为临时签名 URL。 */
    url?: string | null;
    /** Thumbnail 缩略图 URL，未生成时为 null。 */
    thumbnail?: string | null;
    /** File Size 文件大小，单位字节。 */
    file_size?: number | null;
    /** Created At 媒体文件创建时间。 */
    created_at?: string | null;
    /** Side 身份证面：front 人像面，back 国徽面。 */
    side: "front" | "back";
    /** Media Type 媒体类型。实名认证固定为 image。 */
    media_type?: string;
  };

  type RealNameLogOut = {
    /** Action */
    action: string;
    /** Action Label */
    action_label: string;
    /** Action  Mapping */
    action__mapping?: string;
    /** Created At */
    created_at: string;
    /** From Status */
    from_status?: string | null;
    /** From Status Label */
    from_status_label?: string;
    /** From Status  Mapping */
    from_status__mapping?: string;
    /** Note */
    note?: string;
    /** Operator */
    operator?: string;
    /** To Status */
    to_status?: string | null;
    /** To Status Label */
    to_status_label?: string;
    /** To Status  Mapping */
    to_status__mapping?: string;
  };

  type RealNameRetryIn = {
    /** Real Name 真实姓名。 */
    real_name: string;
    /** Id Number 身份证号。 */
    id_number: string;
    /** Id Card Media 身份证正反面媒体引用。 */
    id_card_media: RealNameIdCardMediaIn[];
    /** Source 来源：user_submit 或 business_gate。 */
    source?: string;
  };

  type RealNameSubmitIn = {
    /** Real Name 真实姓名。 */
    real_name: string;
    /** Id Number 身份证号。 */
    id_number: string;
    /** Id Card Media 身份证正反面媒体引用。 */
    id_card_media: RealNameIdCardMediaIn[];
    /** Source 来源：user_submit 或 business_gate。 */
    source?: string;
  };

  type RealNameVerificationDetailOut = {
    /** Id */
    id: number;
    /** Status */
    status: string;
    /** Status Label */
    status_label: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Source */
    source: string;
    /** Source Label */
    source_label: string;
    /** Source  Mapping */
    source__mapping: string;
    /** Provider */
    provider: string;
    /** Provider Label */
    provider_label: string;
    /** Provider  Mapping */
    provider__mapping: string;
    /** Real Name Masked */
    real_name_masked: string;
    /** Id Number Masked */
    id_number_masked: string;
    /** Failure Reason */
    failure_reason?: string;
    /** Review Note */
    review_note?: string;
    /** Reviewed By */
    reviewed_by?: string | null;
    /** Reviewed At */
    reviewed_at?: string | null;
    /** Provider Request Id */
    provider_request_id?: string;
    /** Provider Result */
    provider_result?: Record<string, any>;
    /** Id Card Media */
    id_card_media?: RealNameIdCardMediaOut[];
    /** Is Current */
    is_current: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
    /** Real Name */
    real_name: string;
    /** Id Number */
    id_number: string;
    /** User */
    user: Record<string, any>;
    /** Logs */
    logs: RealNameLogOut[];
  };

  type RealNameVerificationOut = {
    /** Id */
    id: number;
    /** Status */
    status: string;
    /** Status Label */
    status_label: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Source */
    source: string;
    /** Source Label */
    source_label: string;
    /** Source  Mapping */
    source__mapping: string;
    /** Provider */
    provider: string;
    /** Provider Label */
    provider_label: string;
    /** Provider  Mapping */
    provider__mapping: string;
    /** Real Name Masked */
    real_name_masked: string;
    /** Id Number Masked */
    id_number_masked: string;
    /** Failure Reason */
    failure_reason?: string;
    /** Review Note */
    review_note?: string;
    /** Reviewed By */
    reviewed_by?: string | null;
    /** Reviewed At */
    reviewed_at?: string | null;
    /** Provider Request Id */
    provider_request_id?: string;
    /** Provider Result */
    provider_result?: Record<string, any>;
    /** Id Card Media */
    id_card_media?: RealNameIdCardMediaOut[];
    /** Is Current */
    is_current: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type ReconcileOut = {
    /** Diff Count */
    diff_count: number;
  };

  type ReferralRecordOut = {
    /** Id */
    id: number;
    /** Inviter Id */
    inviter_id: number;
    /** Invitee Id */
    invitee_id: number;
    /** Invitee Display */
    invitee_display: string;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type ReferralReviewIn = {
    /** Approved */
    approved: boolean;
    /** Remark */
    remark?: string;
  };

  type ReferralRuleConfigOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Trigger Event */
    trigger_event: string;
    /** Trigger Event  Mapping */
    trigger_event__mapping: string;
    /** Inviter Reward Amount */
    inviter_reward_amount: number;
    /** Invitee Reward Amount */
    invitee_reward_amount: number;
    /** Requires Manual Review */
    requires_manual_review: boolean;
    /** Allow Link */
    allow_link: boolean;
    /** Allow Code */
    allow_code: boolean;
    /** Display Level */
    display_level: string;
    /** Display Level  Mapping */
    display_level__mapping: string;
  };

  type ReferralRuleConfigPatchIn = {
    /** Inviter Reward Amount 邀请人奖励金额，单位分。 */
    inviter_reward_amount?: number | null;
    /** Invitee Reward Amount 被邀请人奖励金额，单位分。 */
    invitee_reward_amount?: number | null;
    /** Requires Manual Review */
    requires_manual_review?: boolean | null;
    /** Allow Link */
    allow_link?: boolean | null;
    /** Allow Code */
    allow_code?: boolean | null;
    /** Display Level */
    display_level?: string | null;
  };

  type ReferralSummaryOut = {
    /** Invite Code */
    invite_code: string;
    /** Share Link */
    share_link: string;
    /** Registered Count */
    registered_count: number;
    /** Pending Review Count */
    pending_review_count: number;
    /** Rewarded Count */
    rewarded_count: number;
  };

  type RelatedResourceItemOut = {
    /** Id */
    id: number;
    /** Label */
    label: string;
  };

  type RelatedResourceOut = {
    /** Type */
    type: string;
    /** Label */
    label: string;
    /** Count */
    count: number;
    /** Items */
    items: RelatedResourceItemOut[];
    /** Truncated */
    truncated: boolean;
    target: RelatedResourceTargetOut;
  };

  type RelatedResourceTargetOut = {
    /** Path */
    path: string;
    /** Query */
    query: Record<string, any>;
  };

  type ResetMfaOut = {
    /** Deleted Authenticators */
    deleted_authenticators: number;
  };

  type ResolvedMediaRefOut = {
    /** Media Id */
    media_id: number;
    /** Resource Type 媒体资源类型，例如 avatar、real_name_id_card。 */
    resource_type?: string | null;
    /** Original Filename 原始文件名。 */
    original_filename?: string | null;
    /** Url 动态生成的访问 URL，私有存储通常为临时签名 URL。 */
    url?: string | null;
    /** Thumbnail 缩略图 URL，未生成时为 null。 */
    thumbnail?: string | null;
    /** File Size 文件大小，单位字节。 */
    file_size?: number | null;
    /** Created At 媒体文件创建时间。 */
    created_at?: string | null;
  };

  type RoleBindingIn = {
    /** User 要授权的用户 ID。 */
    user: number;
    /** Role 要绑定的角色 ID。 */
    role: number;
  };

  type SetPrimaryOut = {
    /** Success */
    success: boolean;
    /** Is Primary */
    is_primary: boolean;
  };

  type SetSettingIn = {
    /** Value 设置项的新值。 */
    value: any;
  };

  type SettingOut = {
    /** Key */
    key: string;
    /** Label */
    label: string;
    /** Value */
    value: any;
    /** Value Type */
    value_type: string;
    /** Description */
    description: string;
    /** Widget */
    widget: string;
    /** Ui */
    ui: Record<string, any>;
    /** Category */
    category: string;
    /** Is Customized */
    is_customized: boolean;
  };

  type SettingsOut = {
    /** Billing Email */
    billing_email?: string;
  };

  type SettingsPatchIn = {
    /** Billing Email 租户账单联系邮箱。 */
    billing_email?: string | null;
  };

  type SocialBindingItemOut = {
    /** Provider */
    provider: string;
    /** Label */
    label: string;
    /** Connected */
    connected: boolean;
  };

  type SocialBindingsOut = {
    /** Items */
    items: SocialBindingItemOut[];
  };

  type SplitPhoneIn = {
    /** Phone Country Code 手机号国家区号。 */
    phone_country_code?: string;
    /** Phone National Number 手机号本地号码。 */
    phone_national_number: string;
  };

  type SplitPhoneSignupIn = {
    /** Phone Country Code 手机号国家区号。 */
    phone_country_code?: string;
    /** Phone National Number 手机号本地号码。 */
    phone_national_number: string;
    /** Email 邮箱。 */
    email: string;
    /** Password 密码。 */
    password: string;
  };

  type SuccessOut = {
    /** Success */
    success: boolean;
  };

  type SwitchListItemOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Slug */
    slug: string;
    /** Is Primary */
    is_primary: boolean;
    /** Is Current */
    is_current: boolean;
  };

  type TeamBindingOut = {
    /** Id */
    id: number;
    /** Team Id */
    team_id: number;
    user: AccessUserOut;
    role: AccessRoleSummaryOut;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type TeamIn = {
    /** Name 团队名称。 */
    name: string;
    /** Members 初始成员用户 ID 列表。 */
    members?: number[];
  };

  type TeamOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Members */
    members: number[];
    /** Member Details */
    member_details: MemberDetailOut[];
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type TeamPatchIn = {
    /** Name 新的团队名称。 */
    name?: string | null;
    /** Members 新的团队成员用户 ID 列表。 */
    members?: number[] | null;
  };

  type TestNotificationIn = {
    /** User Id */
    user_id: number;
    /** Send Email */
    send_email?: boolean;
    /** Send In App */
    send_in_app?: boolean;
  };

  type TotpSetupOut = {
    /** Secret */
    secret: string;
    /** Totp Url */
    totp_url: string;
  };

  type TransferOwnerIn = {
    /** User 新的 owner 用户 ID，必须已经是当前租户成员。 */
    user: number;
  };

  type UnreadCountOut = {
    /** Count */
    count: number;
  };

  type UserOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** First Name */
    first_name?: string;
    /** Last Name */
    last_name?: string;
    /** Real Name Status */
    real_name_status?: string;
    /** Real Name Status  Mapping */
    real_name_status__mapping?: string;
    /** Real Name Masked */
    real_name_masked?: string;
    /** Id Number Masked */
    id_number_masked?: string;
    /** Timezone */
    timezone: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type UserPatchIn = {
    /** First Name 用户名字。 */
    first_name?: string | null;
    /** Last Name 用户姓氏。 */
    last_name?: string | null;
    /** Timezone 用户时区标识。 */
    timezone?: string | null;
    /** Avatar 用户头像媒体引用，最多 1 个。 */
    avatar?: MediaRefIn[] | null;
  };

  type UserSettingOut = {
    /** Key */
    key: string;
    /** Value */
    value: any;
  };

  type UserStatusPatchIn = {
    /** Is Active 是否启用用户。 */
    is_active: boolean;
  };

  type ViewingRecordIn = {
    /** House Id */
    house_id: number;
    /** Contact Id */
    contact_id?: number | null;
    /** Customer Name */
    customer_name: string;
    /** Customer Phone */
    customer_phone: string;
    /** Scheduled At */
    scheduled_at: string;
    /** Assigned To Id */
    assigned_to_id?: number | null;
    /** Notes */
    notes?: string;
  };

  type ViewingRecordOut = {
    /** Id */
    id: number;
    /** House Id */
    house_id: number;
    house: HouseSummaryOut;
    /** Contact Id */
    contact_id: number | null;
    contact: ContactSummaryOut | null;
    /** Customer Name */
    customer_name: string;
    /** Customer Phone */
    customer_phone: string;
    /** Scheduled At */
    scheduled_at: string;
    /** Viewed At */
    viewed_at: string | null;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Assigned To Id */
    assigned_to_id: number | null;
    /** Notes */
    notes: string;
    /** Extra */
    extra: Record<string, any>;
    /** Is Active */
    is_active: boolean;
    /** Signed Lease Id */
    signed_lease_id?: number | null;
  };

  type ViewingRecordPatchIn = {
    /** House Id */
    house_id?: number | null;
    /** Contact Id */
    contact_id?: number | null;
    /** Customer Name */
    customer_name?: string | null;
    /** Customer Phone */
    customer_phone?: string | null;
    /** Scheduled At */
    scheduled_at?: string | null;
    /** Viewed At */
    viewed_at?: string | null;
    /** Status */
    status?: string | null;
    /** Assigned To Id */
    assigned_to_id?: number | null;
    /** Notes */
    notes?: string | null;
    /** Extra */
    extra?: Record<string, any> | null;
    /** Is Active */
    is_active?: boolean | null;
  };

  type ViewingRecordSummaryOut = {
    /** Id */
    id: number;
    /** Label */
    label: string;
    /** Customer Name */
    customer_name: string;
    /** Customer Phone */
    customer_phone: string;
  };

  type WalletAccountAdminOut = {
    /** Available Balance */
    available_balance: number;
    /** Frozen Balance */
    frozen_balance: number;
    /** Total Income */
    total_income: number;
    /** Total Withdrawn */
    total_withdrawn: number;
    /** Id */
    id: number;
    /** User Id */
    user_id: number;
    /** Username */
    username: string;
    /** Email */
    email: string;
    /** Phone Label */
    phone_label: string;
    /** Real Name Label */
    real_name_label: string;
  };

  type WalletAdjustmentIn = {
    /** User Id 待调账用户 ID。 */
    user_id: number;
    /** Amount 调账金额，正数增加，负数扣减。 */
    amount: number;
    /** Idempotency Key 调账幂等键。 */
    idempotency_key: string;
    /** Remark 调账原因备注。 */
    remark?: string;
  };

  type WalletLedgerOut = {
    /** Id */
    id: number;
    /** Entry Type */
    entry_type: string;
    /** Entry Type  Mapping */
    entry_type__mapping: string;
    /** Amount Delta */
    amount_delta: number;
    /** Available Balance After */
    available_balance_after: number;
    /** Frozen Balance After */
    frozen_balance_after: number;
    /** Biz Type */
    biz_type: string;
    /** Biz Id */
    biz_id: string;
    /** Remark */
    remark: string;
    /** Created At */
    created_at: string;
  };

  type WalletSummaryOut = {
    /** Available Balance */
    available_balance: number;
    /** Frozen Balance */
    frozen_balance: number;
    /** Total Income */
    total_income: number;
    /** Total Withdrawn */
    total_withdrawn: number;
  };

  type WechatPhoneIn = {
    /** Phone Code 微信小程序获取手机号接口返回的 phone code。 */
    phone_code: string;
  };

  type WechatPhoneOut = {
    /** Phone Country Code */
    phone_country_code: string;
    /** Phone National Number */
    phone_national_number: string;
    /** Merged */
    merged: boolean;
  };

  type WithdrawalIn = {
    /** Amount */
    amount: number;
    /** Fee Amount */
    fee_amount?: number;
    /** Pay Channel */
    pay_channel: string;
    /** Payee Account */
    payee_account: Record<string, any>;
    /** Client Request Id */
    client_request_id: string;
  };

  type WithdrawalOut = {
    /** Id */
    id: number;
    /** Amount */
    amount: number;
    /** Fee Amount */
    fee_amount: number;
    /** Net Amount */
    net_amount: number;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Pay Channel */
    pay_channel: string;
    /** Pay Channel  Mapping */
    pay_channel__mapping: string;
    /** Payee Account Snapshot */
    payee_account_snapshot: Record<string, any>;
    /** Reject Reason */
    reject_reason: string;
    /** Created At */
    created_at: string;
    /** Reviewed At */
    reviewed_at?: string | null;
  };

  type WithdrawalPayoutOut = {
    /** Id */
    id: number;
    /** Withdrawal Request Id */
    withdrawal_request_id: number;
    /** Provider */
    provider: string;
    /** Out Trade No */
    out_trade_no: string;
    /** Provider Trade No */
    provider_trade_no: string;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Error Code */
    error_code: string;
    /** Error Message */
    error_message: string;
    /** Executed At */
    executed_at?: string | null;
  };

  type WithdrawalRetryIn = {
    /** Provider */
    provider: string;
    /** Out Trade No */
    out_trade_no: string;
    /** Request Payload */
    request_payload?: Record<string, any>;
    /** Idempotency Key */
    idempotency_key: string;
  };

  type WithdrawalReviewIn = {
    /** Approved */
    approved: boolean;
    /** Reason */
    reason?: string;
    /** Idempotency Key */
    idempotency_key: string;
  };
}
