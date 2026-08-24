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

  type AnalyticsCollectErrorOut = {
    /** Index */
    index: number;
    /** Event Name */
    event_name: string;
    /** Message */
    message: string;
  };

  type AnalyticsCollectOut = {
    /** Accepted */
    accepted: number;
    /** Duplicates */
    duplicates: number;
    /** Event Ids */
    event_ids: number[];
    /** Errors */
    errors: AnalyticsCollectErrorOut[];
  };

  type AnalyticsEventDefinitionOut = {
    /** Key */
    key: string;
    /** Label */
    label: string;
    /** Target Types */
    target_types: string[];
    /** Allow Anonymous */
    allow_anonymous: boolean;
    /** Client Collectible */
    client_collectible: boolean;
  };

  type AnalyticsEventIn = {
    /** Event Name */
    event_name: string;
    /** Target Type */
    target_type: string;
    /** Target Id */
    target_id: string | number;
    /** Source */
    source?: string;
    /** Anonymous Id */
    anonymous_id?: string;
    /** Session Id */
    session_id?: string;
    /** Occurred At */
    occurred_at?: string | null;
    /** Properties */
    properties?: Record<string, any>;
    /** Idempotency Key */
    idempotency_key?: string;
  };

  type AnalyticsEventsIn = {
    /** Events */
    events: AnalyticsEventIn[];
  };

  type AnalyticsMetricOut = {
    /** Event Name */
    event_name: string;
    /** Label */
    label: string;
    /** Count */
    count: number;
    /** Unique Visitors */
    unique_visitors: number;
  };

  type AnalyticsOverviewOut = {
    /** Start Date */
    start_date: string;
    /** End Date */
    end_date: string;
    /** Total Events */
    total_events: number;
    /** Unique Visitors */
    unique_visitors: number;
    /** Metrics */
    metrics: AnalyticsMetricOut[];
  };

  type AnalyticsTargetDisplayItemOut = {
    /** Target Type */
    target_type: string;
    /** Target Id */
    target_id: string;
    /** Label */
    label: string;
  };

  type AnalyticsTargetMetricOut = {
    /** Target Id */
    target_id: string;
    /** Label */
    label: string;
    /** Display Items */
    display_items: AnalyticsTargetDisplayItemOut[];
    /** Total */
    total: number;
    /** Unique Visitors */
    unique_visitors: number;
    /** Metrics */
    metrics: Record<string, any>;
  };

  type AnalyticsTrendPointOut = {
    /** Date */
    date: string;
    /** Event Name */
    event_name: string;
    /** Count */
    count: number;
    /** Unique Visitors */
    unique_visitors: number;
  };

  type AnnouncementIn = {
    /** Team Id 团队 ID；为空时表示整个组织。 */
    team_id?: number | null;
    /** Title */
    title: string;
    /** Body */
    body: string;
    /** Require Acknowledgement */
    require_acknowledgement?: boolean;
    /** Expires At */
    expires_at?: string | null;
  };

  type AnnouncementOut = {
    /** Id */
    id: number;
    /** Organization Id */
    organization_id: number;
    /** Team Id */
    team_id?: number | null;
    /** Team Name */
    team_name?: string | null;
    /** Title */
    title: string;
    /** Body */
    body: string;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Require Acknowledgement */
    require_acknowledgement: boolean;
    published_by?: UserSummaryOut | null;
    /** Published At */
    published_at?: string | null;
    /** Expires At */
    expires_at?: string | null;
    /** Is Recipient */
    is_recipient?: boolean;
    /** Is Acknowledged */
    is_acknowledged?: boolean;
    /** Can Manage */
    can_manage?: boolean;
    /** Recipient Count */
    recipient_count?: number;
    /** Acknowledged Count */
    acknowledged_count?: number;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type AnnouncementReceiptOut = {
    /** Announcement Id */
    announcement_id: number;
    /** Recipient Id */
    recipient_id: number;
    /** Acknowledged At */
    acknowledged_at?: string | null;
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

  type appsAnalyticsApiGetOverviewParams = {
    start_date?: string | null;
    end_date?: string | null;
    source?: string | null;
  };

  type appsAnalyticsApiGetTargetsParams = {
    target_type: string;
    start_date?: string | null;
    end_date?: string | null;
    source?: string | null;
    /** 逗号分隔的事件名称。 */
    event_names?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsAnalyticsApiGetTrendsParams = {
    start_date?: string | null;
    end_date?: string | null;
    source?: string | null;
    /** 逗号分隔的事件名称。 */
    event_names?: string | null;
  };

  type appsFavoritesApiDeleteUserFavoriteParams = {
    target_type: string;
    target_id: string;
  };

  type appsFavoritesApiListFavoritesParams = {
    target_type?: string | null;
    target_id?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsFavoritesApiPutUserFavoriteParams = {
    target_type: string;
    target_id: string;
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

  type appsHouseApiGetBuildingMapDetailParams = {
    building_id: number;
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

  type appsHouseApiGetPublicHouseParams = {
    house_id: number;
  };

  type appsHouseApiGetStaffResponsibilityParams = {
    member_id: number;
  };

  type appsHouseApiGetStaffResponsibilitySummaryParams = {
    team_id: number;
  };

  type appsHouseApiGetViewingRecordParams = {
    record_id: number;
  };

  type appsHouseApiListBuildingMapParams = {
    keyword?: string | null;
    estate_id?: number | null;
    house_status?: string | null;
    standalone_only?: boolean;
    west?: number | string | null;
    south?: number | string | null;
    east?: number | string | null;
    north?: number | string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListBuildingMapUnlocatedParams = {
    keyword?: string | null;
    estate_id?: number | null;
    house_status?: string | null;
    page?: number;
    page_size?: number | null;
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

  type appsHouseApiListEstateMapParams = {
    keyword?: string | null;
    estate_id?: number | null;
    house_status?: string | null;
    west?: number | string | null;
    south?: number | string | null;
    east?: number | string | null;
    north?: number | string | null;
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
    responsible_member_id?: number | null;
    status?: string | null;
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

  type appsHouseApiListPublicHousesParams = {
    keyword?: string | null;
    province?: string | null;
    city?: string | null;
    district?: string | null;
    min_rent?: number | string | null;
    max_rent?: number | string | null;
    min_area?: number | string | null;
    max_area?: number | string | null;
    bedrooms?: number | null;
    living_rooms?: number | null;
    decoration?: string | null;
    has_elevator_access?: boolean | null;
    tags?: string[] | null;
    publisher_slug?: string | null;
    sort?: "latest" | "rent_asc" | "rent_desc" | "area_asc" | "area_desc";
    page?: number;
    page_size?: number | null;
  };

  type appsHouseApiListStaffResponsibilitiesParams = {
    keyword?: string | null;
    team_id?: number | null;
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

  type appsHouseApiReplaceStaffResponsibilitiesParams = {
    member_id: number;
  };

  type appsMediaApiOssTokenParams = {
    /** 上传作用域，user 表示个人，org 表示当前租户。 */
    scope: "user" | "org";
    /** 原始文件名，用于生成上传路径。 */
    filename: string;
    /** 可选资源类型，用于在签发上传凭证前校验作用域与扩展名。 */
    resource_type?: string | null;
  };

  type appsNotificationsApiCreateDispatchParams = {
    /** 管理上下文：自动、平台或当前租户。 */
    management_context?: "auto" | "platform" | "tenant";
  };

  type appsNotificationsApiDeleteNotificationParams = {
    notification_id: number;
  };

  type appsNotificationsApiGetDispatchParams = {
    dispatch_id: number;
    /** 管理上下文：自动、平台或当前租户。 */
    management_context?: "auto" | "platform" | "tenant";
  };

  type appsNotificationsApiGetNotificationParams = {
    notification_id: number;
  };

  type appsNotificationsApiListDispatchesParams = {
    /** 管理上下文：自动、平台或当前租户。 */
    management_context?: "auto" | "platform" | "tenant";
    page?: number;
    page_size?: number | null;
  };

  type appsNotificationsApiListDispatchNotificationsParams = {
    dispatch_id: number;
    /** 管理上下文：自动、平台或当前租户。 */
    management_context?: "auto" | "platform" | "tenant";
    page?: number;
    page_size?: number | null;
  };

  type appsNotificationsApiListDispatchTargetsParams = {
    /** 目标范围。 */
    scope: "organization" | "teams" | "users";
    /** 按名称、标识或邮箱搜索目标。 */
    keyword?: string;
    /** 管理上下文：自动、平台或当前租户。 */
    management_context?: "auto" | "platform" | "tenant";
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

  type appsOrganizationsWorkspaceApiGetWorkspaceMemberParams = {
    member_id: number;
  };

  type appsOrganizationsWorkspaceApiListWorkspaceMembersParams = {
    /** 按姓名、用户名或邮箱搜索成员。 */
    keyword?: string | null;
    /** 按可见团队筛选成员。 */
    team_id?: number | null;
    /** 仅返回未加入任何当前组织团队的成员。 */
    ungrouped?: boolean;
    page?: number;
    page_size?: number | null;
  };

  type appsOrganizationsWorkspaceApiSearchWorkspaceParams = {
    /** 团队名称、成员姓名、用户名或邮箱。 */
    keyword?: string;
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

  type appsSettingsApiDeleteUserTableColumnsViewParams = {
    /** 稳定的列表标识。 */
    table_key: string;
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

  type appsSettingsApiPutUserTableColumnsParams = {
    /** 稳定的列表标识。 */
    table_key: string;
  };

  type appsSubscriptionsApiAdminListInvoiceRequestsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsSubscriptionsApiAdminListOrdersParams = {
    organization_id?: number | null;
    page?: number;
    page_size?: number | null;
  };

  type appsSubscriptionsApiAdminProcessInvoiceRequestParams = {
    invoice_request_id: number;
  };

  type appsSubscriptionsApiAdminRefundOrderParams = {
    order_id: number;
  };

  type appsSubscriptionsApiGetOrderParams = {
    order_no: string;
  };

  type appsSubscriptionsApiListInvoiceRequestsParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsSubscriptionsApiListOrdersParams = {
    page?: number;
    page_size?: number | null;
  };

  type appsTeamOperationsApiAcceptTaskAssignmentParams = {
    assignment_id: number;
  };

  type appsTeamOperationsApiAcknowledgeAnnouncementEndpointParams = {
    announcement_id: number;
  };

  type appsTeamOperationsApiCancelTaskParams = {
    task_id: number;
  };

  type appsTeamOperationsApiCompleteTaskAssignmentParams = {
    assignment_id: number;
  };

  type appsTeamOperationsApiGetAnnouncementParams = {
    announcement_id: number;
  };

  type appsTeamOperationsApiGetTaskAssignmentParams = {
    assignment_id: number;
  };

  type appsTeamOperationsApiGetTaskAssignmentSummaryParams = {
    team_id?: number | null;
    priority?: string | null;
    keyword?: string | null;
  };

  type appsTeamOperationsApiGetTaskParams = {
    task_id: number;
  };

  type appsTeamOperationsApiGetTaskSummaryParams = {
    team_id?: number | null;
    priority?: string | null;
    keyword?: string | null;
  };

  type appsTeamOperationsApiListAnnouncementsParams = {
    team_id?: number | null;
    status?: string | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsTeamOperationsApiListTaskAssigneesParams = {
    team_id?: number | null;
    keyword?: string | null;
    page?: number;
    page_size?: number | null;
  };

  type appsTeamOperationsApiListTaskAssignmentsParams = {
    status?: string | null;
    team_id?: number | null;
    priority?: string | null;
    keyword?: string | null;
    due_state?: string | null;
    overdue?: boolean | null;
    page?: number;
    page_size?: number | null;
  };

  type appsTeamOperationsApiListTasksParams = {
    team_id?: number | null;
    status?: string | null;
    priority?: string | null;
    keyword?: string | null;
    due_state?: string | null;
    mine?: boolean | null;
    page?: number;
    page_size?: number | null;
  };

  type appsTeamOperationsApiPublishAnnouncementEndpointParams = {
    announcement_id: number;
  };

  type appsTeamOperationsApiRejectTaskAssignmentParams = {
    assignment_id: number;
  };

  type appsTeamOperationsApiWithdrawAnnouncementEndpointParams = {
    announcement_id: number;
  };

  type appsTeamsApiAddTeamMemberParams = {
    team_id: number;
    user_id: number;
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

  type appsTeamsApiRemoveTeamMemberParams = {
    team_id: number;
    user_id: number;
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
    /** Images */
    images?: Record<string, any>[];
    /** Tags */
    tags?: string[];
  };

  type BuildingInventoryOut = {
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
    /** Images */
    images: Record<string, any>[];
    /** Tags */
    tags: string[];
    counts: InventoryCountsOut;
  };

  type BuildingMapCountsOut = {
    /** Total */
    total: number;
    /** Vacant */
    vacant: number;
    /** Listed */
    listed: number;
    /** Rented */
    rented: number;
    /** Renovating */
    renovating: number;
  };

  type BuildingMapDetailOut = {
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
    /** Images */
    images: Record<string, any>[];
    /** Tags */
    tags: string[];
    counts: BuildingMapCountsOut;
    /** Houses */
    houses: BuildingMapHouseOut[];
  };

  type BuildingMapHouseOut = {
    /** Id */
    id: number;
    /** Room Number */
    room_number: string;
    /** Floor */
    floor: number | null;
    /** Area */
    area: string | null;
    /** Asking Rent */
    asking_rent: string | null;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
  };

  type BuildingMapMarkerOut = {
    /** Id */
    id: number;
    estate: EstateSummaryOut | null;
    /** Name */
    name: string;
    /** Address */
    address: string;
    /** Lat */
    lat: string;
    /** Lng */
    lng: string;
    counts: BuildingMapCountsOut;
  };

  type BuildingMapUnlocatedCountOut = {
    /** Count */
    count: number;
  };

  type BuildingMapUnlocatedOut = {
    /** Id */
    id: number;
    estate: EstateSummaryOut | null;
    /** Name */
    name: string;
    /** Address */
    address: string;
    counts: BuildingMapCountsOut;
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
    /** Images */
    images: Record<string, any>[];
    /** Tags */
    tags: string[];
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
    /** Images */
    images?: Record<string, any>[] | null;
    /** Tags */
    tags?: string[] | null;
  };

  type BuildingSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Estate Id */
    estate_id: number | null;
    estate: EstateSummaryOut | null;
    /** Elevator */
    elevator: boolean;
    /** Address */
    address: string;
    /** Lat */
    lat: string | null;
    /** Lng */
    lng: string | null;
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

  type CurrentSubscriptionOut = {
    /** Plan */
    plan: Record<string, any>;
    /** Entitlement */
    entitlement: Record<string, any>;
    /** Usage */
    usage: Record<string, any>;
    /** Subscription */
    subscription: Record<string, any> | null;
    recommendation: UpgradeRecommendationOut | null;
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

  type DailyDashboardOut = {
    /** Pending Acceptance */
    pending_acceptance: number;
    /** In Progress */
    in_progress: number;
    /** Due Today */
    due_today: number;
    /** Overdue */
    overdue: number;
    /** Completed Today */
    completed_today: number;
    /** Unacknowledged Announcements */
    unacknowledged_announcements: number;
    /** Urgent Items */
    urgent_items?: TaskAssignmentOut[];
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

  type EstateDetailOut = {
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
    /** Building Count */
    building_count: number;
    counts: InventoryCountsOut;
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
  };

  type EstateMapMarkerOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
    /** Address */
    address: string;
    /** Lat */
    lat: string;
    /** Lng */
    lng: string;
    /** Location Source */
    location_source: "estate" | "building_centroid";
    /** Building Count */
    building_count: number;
    /** Located Building Count */
    located_building_count: number;
    /** Unlocated Building Count */
    unlocated_building_count: number;
    counts: BuildingMapCountsOut;
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
  };

  type EstateSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
  };

  type FavoriteDisplayFactOut = {
    /** Label */
    label: string;
    /** Value */
    value: string;
  };

  type FavoriteOut = {
    /** Id */
    id: number;
    /** Target Type */
    target_type: string;
    /** Target Id */
    target_id: string;
    /** Created At */
    created_at: string;
    /** Available */
    available: boolean;
    display: FavoriteTargetDisplayOut | null;
    /** Target */
    target: Record<string, any> | null;
  };

  type FavoriteTargetDisplayOut = {
    /** Title */
    title: string;
    /** Subtitle */
    subtitle?: string;
    /** Cover Url */
    cover_url?: string | null;
    /** Description */
    description?: string;
    /** Tags */
    tags?: string[];
    /** Facts */
    facts?: FavoriteDisplayFactOut[];
  };

  type FavoriteTargetTypeOut = {
    /** Target Type */
    target_type: string;
    /** Display Name */
    display_name: string;
    /** Order */
    order: number;
    /** Favorite Count */
    favorite_count: number;
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
    /** Images */
    images: Record<string, any>[];
    /** Videos */
    videos: Record<string, any>[];
    /** Tags */
    tags: string[];
    /** Effective Tags */
    effective_tags: string[];
    /** Public Description */
    public_description: string;
    /** Internal Notes */
    internal_notes: string;
    /** Extra */
    extra: Record<string, any>;
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

  type InventoryCountsOut = {
    /** Total */
    total: number;
    /** Vacant */
    vacant: number;
    /** Listed */
    listed: number;
    /** Rented */
    rented: number;
    /** Renovating */
    renovating: number;
  };

  type InviteIn = {
    /** Invitee Email 被邀请人邮箱，可用于未注册用户邀请。 */
    invitee_email?: string;
    /** Invitee Phone 被邀请人手机号，可用于未注册用户邀请。 */
    invitee_phone?: string;
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
    /** Invitee Phone */
    invitee_phone?: string;
    /** Is Owner */
    is_owner: boolean;
    /** Access Role */
    access_role?: number | null;
    /** Key */
    key: string;
    /** Is Expired */
    is_expired: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type InvoiceProcessIn = {
    /** Status */
    status: string;
    /** Invoice Number */
    invoice_number?: string;
    /** File Url */
    file_url?: string;
    /** Admin Note */
    admin_note?: string;
  };

  type InvoiceProfileIn = {
    /** Invoice Type */
    invoice_type: string;
    /** Title */
    title: string;
    /** Tax Number */
    tax_number?: string;
    /** Recipient Email */
    recipient_email: string;
    /** Registered Address */
    registered_address?: string;
    /** Registered Phone */
    registered_phone?: string;
    /** Bank Name */
    bank_name?: string;
    /** Bank Account */
    bank_account?: string;
  };

  type InvoiceProfileOut = {
    /** Invoice Type */
    invoice_type: string;
    /** Title */
    title: string;
    /** Tax Number */
    tax_number?: string;
    /** Recipient Email */
    recipient_email: string;
    /** Registered Address */
    registered_address?: string;
    /** Registered Phone */
    registered_phone?: string;
    /** Bank Name */
    bank_name?: string;
    /** Bank Account */
    bank_account?: string;
    /** Organization Id */
    organization_id: number;
  };

  type InvoiceRequestIn = {
    /** Order Id */
    order_id: number;
  };

  type InvoiceRequestOut = {
    /** Id */
    id: number;
    /** Order Id */
    order_id: number;
    /** Status */
    status: string;
    /** Profile Snapshot */
    profile_snapshot: Record<string, any>;
    /** Invoice Number */
    invoice_number: string;
    /** Issued At */
    issued_at: string | null;
    /** File Url */
    file_url: string;
    /** Admin Note */
    admin_note: string;
    /** Created At */
    created_at: string;
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
    /** File Size 客户端声明的文件大小，单位字节；后端会与对象存储实际大小核对。 */
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
    /** Thumbnail */
    thumbnail: string | null;
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
    scope: "platform" | "organization" | "teams" | "users";
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

  type NotificationDispatchTargetOut = {
    /** Id */
    id: number;
    /** Label */
    label: string;
    /** Description */
    description?: string;
    /** Avatar Url */
    avatar_url?: string | null;
  };

  type NotificationOut = {
    /** Id */
    id: number;
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
    /** Target Type */
    target_type?: string | null;
    /** Target Id */
    target_id?: number | null;
    /** Is Read */
    is_read: boolean;
    /** Expires At */
    expires_at?: string | null;
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
    /** Required Channels */
    required_channels?: string[];
    /** Required Channels  Mapping */
    required_channels__mapping: string[];
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

  type OrganizationNavigationOut = {
    organization: WorkspaceOrganizationOut;
    /** Member Count */
    member_count: number;
    /** Owner Count */
    owner_count: number;
    /** Team Count */
    team_count: number;
    /** Ungrouped Member Count */
    ungrouped_member_count: number;
    /** Pending Invite Count */
    pending_invite_count: number | null;
    /** Unassigned Responsibility Count */
    unassigned_responsibility_count: number;
    /** Teams */
    teams: WorkspaceTeamSummaryOut[];
    capabilities: OrganizationWorkspaceCapabilitiesOut;
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
    /** Logo */
    logo?: ResolvedMediaRefOut[];
    /** Description */
    description?: string;
    /** Is Active */
    is_active: boolean;
  };

  type OrganizationPatchIn = {
    /** Name 租户显示名称。 */
    name?: string | null;
    /** Slug 租户 slug。 */
    slug?: string | null;
    /** Billing Email 租户账单联系邮箱。 */
    billing_email?: string | null;
    /** Logo 租户 Logo 媒体引用，最多 1 个。 */
    logo?: MediaRefIn[] | null;
    /** Description 租户介绍。 */
    description?: string | null;
  };

  type OrganizationSearchOut = {
    /** Teams */
    teams: WorkspaceTeamSummaryOut[];
    /** Members */
    members: WorkspaceMemberOut[];
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
  };

  type OrganizationWorkspaceCapabilitiesOut = {
    /** Member Manage */
    member_manage: boolean;
    /** Invite Manage */
    invite_manage: boolean;
    /** Role View */
    role_view: boolean;
    /** Role Manage */
    role_manage: boolean;
    /** Team Create */
    team_create: boolean;
    /** Responsibility Manage */
    responsibility_manage: boolean;
    /** Team Update Ids */
    team_update_ids: number[];
    /** Team Delete Ids */
    team_delete_ids: number[];
    /** Team Member Manage Ids */
    team_member_manage_ids: number[];
    /** Team Role View Ids */
    team_role_view_ids: number[];
    /** Team Role Manage Ids */
    team_role_manage_ids: number[];
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

  type PagedAnalyticsTargetMetricOut = {
    /** Items */
    items: AnalyticsTargetMetricOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedAnnouncementOut = {
    /** Items */
    items: AnnouncementOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedBuildingInventoryOut = {
    /** Items */
    items: BuildingInventoryOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedBuildingMapMarkerOut = {
    /** Items */
    items: BuildingMapMarkerOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedBuildingMapUnlocatedOut = {
    /** Items */
    items: BuildingMapUnlocatedOut[];
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

  type PagedEstateDetailOut = {
    /** Items */
    items: EstateDetailOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedEstateMapMarkerOut = {
    /** Items */
    items: EstateMapMarkerOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedFavoriteOut = {
    /** Items */
    items: FavoriteOut[];
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

  type PagedInvoiceRequestOut = {
    /** Items */
    items: InvoiceRequestOut[];
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

  type PagedNotificationDispatchTargetOut = {
    /** Items */
    items: NotificationDispatchTargetOut[];
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

  type PagedPropertyResponsibilityMemberOut = {
    /** Items */
    items: PropertyResponsibilityMemberOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedPublicHouseListOut = {
    /** Items */
    items: PublicHouseListOut[];
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

  type PagedSaaSOrderOut = {
    /** Items */
    items: SaaSOrderOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedTaskAssignmentOut = {
    /** Items */
    items: TaskAssignmentOut[];
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

  type PagedUserSummaryOut = {
    /** Items */
    items: UserSummaryOut[];
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

  type PagedWorkspaceMemberOut = {
    /** Items */
    items: WorkspaceMemberOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PagedWorkTaskOut = {
    /** Items */
    items: WorkTaskOut[];
    /** Total */
    total: number;
    /** Page */
    page: number;
    /** Page Size */
    page_size: number;
  };

  type PayoutCreateIn = {
    /** Out Trade No */
    out_trade_no: string;
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

  type PlanOut = {
    /** Code */
    code: string;
    /** Name */
    name: string;
    /** Description */
    description: string;
    /** Display Order */
    display_order: number;
    /** Is Active */
    is_active: boolean;
    /** Prices */
    prices: Record<string, any>[];
    /** Entitlement */
    entitlement: Record<string, any> | null;
  };

  type PropertyResponsibilityMemberOut = {
    /** Member Id */
    member_id: number;
    user: OrgUserOut;
    /** Is Owner */
    is_owner: boolean;
    /** Landlords */
    landlords: ContactSummaryOut[];
    /** Buildings */
    buildings: BuildingSummaryOut[];
    /** Estates */
    estates: EstateSummaryOut[];
    /** Responsible House Count */
    responsible_house_count: number;
  };

  type PropertyResponsibilitySummaryOut = {
    /** Member Count */
    member_count: number;
    /** Configured Member Count */
    configured_member_count: number;
    /** Unconfigured Member Count */
    unconfigured_member_count: number;
    /** Responsible House Count Sum */
    responsible_house_count_sum: number;
  };

  type PropertyResponsibilityUpdateIn = {
    /** Landlord Ids */
    landlord_ids?: number[];
    /** Building Ids */
    building_ids?: number[];
    /** Estate Ids */
    estate_ids?: number[];
  };

  type PublicBuildingOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Address */
    address: string;
    /** Lat */
    lat: string | null;
    /** Lng */
    lng: string | null;
    estate: PublicEstateOut | null;
  };

  type PublicEstateOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Display Name */
    display_name: string;
    /** Province */
    province: string;
    /** City */
    city: string;
    /** District */
    district: string;
    /** Address */
    address: string;
  };

  type PublicHouseDetailOut = {
    /** Id */
    id: number;
    /** Room Number */
    room_number: string;
    /** Floor */
    floor: number | null;
    /** Area */
    area: string | null;
    /** Asking Rent */
    asking_rent: string | null;
    /** Bedrooms */
    bedrooms: number | null;
    /** Living Rooms */
    living_rooms: number | null;
    /** Bathrooms */
    bathrooms: number | null;
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
    /** Images */
    images: ResolvedMediaRefOut[];
    /** Tags */
    tags: string[];
    /** Effective Tags */
    effective_tags: string[];
    /** Public Description */
    public_description: string;
    building: PublicBuildingOut;
    publisher: PublicPublisherOut;
    /** Updated At */
    updated_at: string;
    /** Interior Area */
    interior_area: string | null;
    /** Deposit Amount */
    deposit_amount: string | null;
    /** Kitchens */
    kitchens: number | null;
    /** Balconies */
    balconies: number | null;
    /** Videos */
    videos: ResolvedMediaRefOut[];
  };

  type PublicHouseFiltersOut = {
    /** Rent Min */
    rent_min: string | null;
    /** Rent Max */
    rent_max: string | null;
    /** Area Min */
    area_min: string | null;
    /** Area Max */
    area_max: string | null;
    /** Provinces */
    provinces: string[];
    /** Cities */
    cities: string[];
    /** Districts */
    districts: string[];
    /** Bedrooms */
    bedrooms: number[];
    /** Living Rooms */
    living_rooms: number[];
    /** Tags */
    tags: string[];
  };

  type PublicHouseListOut = {
    /** Id */
    id: number;
    /** Room Number */
    room_number: string;
    /** Floor */
    floor: number | null;
    /** Area */
    area: string | null;
    /** Asking Rent */
    asking_rent: string | null;
    /** Bedrooms */
    bedrooms: number | null;
    /** Living Rooms */
    living_rooms: number | null;
    /** Bathrooms */
    bathrooms: number | null;
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
    /** Images */
    images: ResolvedMediaRefOut[];
    /** Tags */
    tags: string[];
    /** Effective Tags */
    effective_tags: string[];
    /** Public Description */
    public_description: string;
    building: PublicBuildingOut;
    publisher: PublicPublisherOut;
    /** Updated At */
    updated_at: string;
  };

  type PublicInviteOut = {
    /** Organization Name */
    organization_name: string;
    /** Sender Name */
    sender_name: string;
    /** Invitee Email */
    invitee_email?: string;
    /** Invitee Phone */
    invitee_phone?: string;
    /** Is Expired */
    is_expired: boolean;
    /** Is Already Member */
    is_already_member: boolean;
  };

  type PublicPublisherOut = {
    /** Slug */
    slug: string;
    /** Name */
    name: string;
    /** Logo */
    logo: ResolvedMediaRefOut[];
    /** Description */
    description: string;
  };

  type PurchaseOrderIn = {
    /** Target Plan Code */
    target_plan_code: string;
    /** Billing Cycle */
    billing_cycle: string;
    /** Payment Mode */
    payment_mode: string;
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
    /** Thumbnail 缩略图 URL；图片未生成缩略图时回退原图，非图片为 null。 */
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

  type RefundIn = {
    /** Amount */
    amount: number;
    /** Reason */
    reason: string;
    /** Proof */
    proof?: string;
    /** Subscription Action */
    subscription_action: string;
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
    /** Thumbnail 缩略图 URL；图片未生成缩略图时回退原图，非图片为 null。 */
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

  type SaaSOrderOut = {
    /** Id */
    id: number;
    /** Order No */
    order_no: string;
    /** Order Type */
    order_type: string;
    /** Status */
    status: string;
    /** Close Reason */
    close_reason: string;
    /** Target Plan Code */
    target_plan_code: string;
    /** Billing Cycle */
    billing_cycle: string;
    /** List Amount */
    list_amount: number;
    /** Credit Amount */
    credit_amount: number;
    /** Payable Amount */
    payable_amount: number;
    /** Expires At */
    expires_at: string;
    /** Paid At */
    paid_at: string | null;
    /** Refund Status */
    refund_status: string;
    /** Refunded Amount */
    refunded_amount: number;
    /** Created At */
    created_at: string;
    /** Payment */
    payment?: Record<string, any> | null;
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

  type TableColumnStateOut = {
    /** Show */
    show?: boolean | null;
    /** Fixed */
    fixed?: "left" | "right" | null;
    /** Order */
    order?: number | number | null;
  };

  type TagSuggestionsOut = {
    /** Tags */
    tags: string[];
  };

  type TaskActionIn = {
    /** Result */
    result?: string;
  };

  type TaskAssignmentOut = {
    /** Id */
    id: number;
    /** Task Id */
    task_id: number;
    /** Task Title */
    task_title: string;
    /** Task Description */
    task_description: string;
    /** Task Type */
    task_type: string;
    /** Priority */
    priority: string;
    /** Priority  Mapping */
    priority__mapping: string;
    /** Task Status */
    task_status: string;
    /** Task Status  Mapping */
    task_status__mapping: string;
    /** Team Id */
    team_id?: number | null;
    /** Team Name */
    team_name?: string | null;
    creator?: UserSummaryOut | null;
    assignee: UserSummaryOut;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Due At */
    due_at?: string | null;
    /** Is Overdue */
    is_overdue: boolean;
    /** Accepted At */
    accepted_at?: string | null;
    /** Completed At */
    completed_at?: string | null;
    /** Rejected At */
    rejected_at?: string | null;
    /** Result */
    result: string;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type TaskAssignmentSummaryOut = {
    /** Pending */
    pending: number;
    /** In Progress */
    in_progress: number;
    /** Due Soon */
    due_soon: number;
    /** Overdue */
    overdue: number;
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
    /** Phone 团队联系电话。 */
    phone?: string;
    /** Wechat 团队客服微信号。 */
    wechat?: string;
    /** Address 团队地址。 */
    address?: string;
    /** Business Hours 团队营业时间。 */
    business_hours?: string;
    /** Members 初始成员用户 ID 列表。 */
    members?: number[];
  };

  type TeamMemberMutationOut = {
    /** Team Id */
    team_id: number;
    /** User Id */
    user_id: number;
    /** Changed */
    changed: boolean;
  };

  type TeamOperationsCapabilitiesOut = {
    /** Announcement Organization Manage */
    announcement_organization_manage: boolean;
    /** Announcement Team Ids */
    announcement_team_ids?: number[];
    /** Task Organization Manage */
    task_organization_manage: boolean;
    /** Task Team Ids */
    task_team_ids?: number[];
  };

  type TeamOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Phone */
    phone?: string;
    /** Wechat */
    wechat?: string;
    /** Address */
    address?: string;
    /** Business Hours */
    business_hours?: string;
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
    /** Phone 团队联系电话。 */
    phone?: string | null;
    /** Wechat 团队客服微信号。 */
    wechat?: string | null;
    /** Address 团队地址。 */
    address?: string | null;
    /** Business Hours 团队营业时间。 */
    business_hours?: string | null;
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

  type UpgradeRecommendationOut = {
    /** Reason */
    reason: string;
    /** Threshold Percent */
    threshold_percent: number;
    /** Target Plan Code */
    target_plan_code: string;
    /** Target Plan Name */
    target_plan_name: string;
    /** Triggered Resources */
    triggered_resources: UpgradeRecommendationResourceOut[];
  };

  type UpgradeRecommendationResourceOut = {
    /** Resource */
    resource: string;
    /** Current */
    current: number;
    /** Limit */
    limit: number;
    /** Usage Percent */
    usage_percent: number;
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

  type UserSummaryOut = {
    /** Id */
    id: number;
    /** Username */
    username: string;
    /** Full Name */
    full_name: string;
  };

  type VacancySyncBlockOut = {
    /** Block Index */
    block_index: number;
    /** Address */
    address: string;
    building_match: VacancySyncBuildingMatchOut;
    /** Lines */
    lines: VacancySyncLineOut[];
    changes: VacancySyncChangesOut;
    /** Errors */
    errors: VacancySyncErrorOut[];
  };

  type VacancySyncBuildingCandidateOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Address */
    address: string;
  };

  type VacancySyncBuildingMatchOut = {
    /** Status */
    status: "matched" | "overridden" | "ambiguous" | "new" | "created";
    /** Building Id */
    building_id: number | null;
    /** Name */
    name: string | null;
    /** Address */
    address: string;
    /** Candidates */
    candidates: VacancySyncBuildingCandidateOut[];
  };

  type VacancySyncBuildingOverrideIn = {
    /** Block Index */
    block_index: number;
    /** Building Id */
    building_id: number;
  };

  type VacancySyncChangesOut = {
    /** Create Houses */
    create_houses: VacancySyncHouseChangeOut[];
    /** Update Houses */
    update_houses: VacancySyncHouseChangeOut[];
    /** Mark Vacant */
    mark_vacant: VacancySyncHouseChangeOut[];
    /** Mark Rented */
    mark_rented: VacancySyncHouseChangeOut[];
    /** Preserve Special Status */
    preserve_special_status: VacancySyncHouseChangeOut[];
    /** Inactive Conflicts */
    inactive_conflicts: VacancySyncHouseChangeOut[];
  };

  type VacancySyncErrorOut = {
    /** Code */
    code: string;
    /** Message */
    message: string;
    /** Block Index */
    block_index: number | null;
    /** Line Number */
    line_number: number | null;
  };

  type VacancySyncHouseChangeOut = {
    /** House Id */
    house_id: number | null;
    /** Room Number */
    room_number: string;
    /** Before Status */
    before_status: string | null;
    /** After Status */
    after_status: string | null;
    /** Changed Fields */
    changed_fields: string[];
  };

  type VacancySyncIn = {
    /** Mode */
    mode?: "preview" | "apply";
    /** Raw Text */
    raw_text: string;
    /** Building Overrides */
    building_overrides?: VacancySyncBuildingOverrideIn[];
    /** Ignored Lines */
    ignored_lines?: number[];
    /** Plan Hash */
    plan_hash?: string | null;
  };

  type VacancySyncLineOut = {
    /** Line Number */
    line_number: number;
    /** Raw */
    raw: string;
    /** Status */
    status: "valid" | "error" | "ignored";
    /** Error Code */
    error_code: string | null;
    /** Message */
    message: string | null;
    /** Room Number */
    room_number: string | null;
    /** Floor */
    floor: number | null;
    /** Asking Rent */
    asking_rent: string | null;
    /** Bedrooms */
    bedrooms: number | null;
    /** Living Rooms */
    living_rooms: number | null;
    /** Tags */
    tags: string[];
  };

  type VacancySyncOut = {
    /** Mode */
    mode: "preview" | "apply";
    /** Applied */
    applied: boolean;
    /** Can Apply */
    can_apply: boolean;
    /** Plan Hash */
    plan_hash: string | null;
    /** Force Rented */
    force_rented: boolean;
    summary: VacancySyncSummaryOut;
    /** Blocks */
    blocks: VacancySyncBlockOut[];
    /** Errors */
    errors: VacancySyncErrorOut[];
  };

  type VacancySyncSummaryOut = {
    /** Buildings */
    buildings: number;
    /** Valid Lines */
    valid_lines: number;
    /** Error Lines */
    error_lines: number;
    /** Ignored Lines */
    ignored_lines: number;
    /** Create Buildings */
    create_buildings: number;
    /** Create Houses */
    create_houses: number;
    /** Update Houses */
    update_houses: number;
    /** Mark Vacant */
    mark_vacant: number;
    /** Mark Rented */
    mark_rented: number;
    /** Preserve Special Status */
    preserve_special_status: number;
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

  type WithdrawalReviewIn = {
    /** Approved */
    approved: boolean;
    /** Reason */
    reason?: string;
    /** Idempotency Key */
    idempotency_key: string;
  };

  type WorkspaceMemberOut = {
    /** Member Id */
    member_id: number;
    user: OrgUserOut;
    /** Is Owner */
    is_owner: boolean;
    /** Teams */
    teams: WorkspaceTeamSummaryOut[];
    /** Has Responsibility */
    has_responsibility: boolean;
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type WorkspaceOrganizationOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Slug */
    slug: string;
  };

  type WorkspaceTeamSummaryOut = {
    /** Id */
    id: number;
    /** Name */
    name: string;
    /** Member Count */
    member_count: number;
  };

  type WorkTaskIn = {
    /** Team Id 团队 ID；为空时表示组织级任务。 */
    team_id?: number | null;
    /** Title */
    title: string;
    /** Description */
    description?: string;
    /** Task Type */
    task_type?: string;
    /** Priority */
    priority?: string;
    /** Due At */
    due_at?: string | null;
    /** Assignee Ids */
    assignee_ids: number[];
    /** Url */
    url?: string;
    /** Data */
    data?: Record<string, any>;
  };

  type WorkTaskOut = {
    /** Id */
    id: number;
    /** Organization Id */
    organization_id: number;
    /** Team Id */
    team_id?: number | null;
    /** Team Name */
    team_name?: string | null;
    /** Title */
    title: string;
    /** Description */
    description: string;
    /** Task Type */
    task_type: string;
    /** Priority */
    priority: string;
    /** Priority  Mapping */
    priority__mapping: string;
    /** Status */
    status: string;
    /** Status  Mapping */
    status__mapping: string;
    /** Due At */
    due_at?: string | null;
    creator?: UserSummaryOut | null;
    /** Url */
    url: string;
    /** Data */
    data: Record<string, any>;
    /** Completed At */
    completed_at?: string | null;
    /** Cancelled At */
    cancelled_at?: string | null;
    /** Can Manage */
    can_manage?: boolean;
    /** Assignments */
    assignments?: TaskAssignmentOut[];
    /** Created At */
    created_at: string;
    /** Updated At */
    updated_at: string;
  };

  type WorkTaskSummaryOut = {
    /** Total */
    total: number;
    /** Active */
    active: number;
    /** Due Soon */
    due_soon: number;
    /** Overdue */
    overdue: number;
  };
}
