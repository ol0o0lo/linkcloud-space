/* eslint-disable */
// @ts-ignore

export type AccessOrganizationBindingsBindingIdUsingDeleteParams = {
  binding_id: number;
};

export type AccessOrganizationBindingsBindingIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AccessOrganizationBindingsUsingGetResponses = {
  /**
   * OK
   */
  200: OrganizationBindingOut[];
};

export type AccessOrganizationBindingsUsingPostResponses = {
  /**
   * Created
   */
  201: OrganizationBindingOut;
};

export type AccessOrganizationRolesRoleIdUsingDeleteParams = {
  role_id: number;
};

export type AccessOrganizationRolesRoleIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AccessOrganizationRolesRoleIdUsingPatchParams = {
  role_id: number;
};

export type AccessOrganizationRolesRoleIdUsingPatchResponses = {
  /**
   * OK
   */
  200: AccessRoleOut;
};

export type AccessOrganizationRolesUsingGetResponses = {
  /**
   * OK
   */
  200: AccessRoleOut[];
};

export type AccessOrganizationRolesUsingPostResponses = {
  /**
   * Created
   */
  201: AccessRoleOut;
};

export type AccessPermissionsUsingGetResponses = {
  /**
   * OK
   */
  200: PermissionOut[];
};

export type AccessRoleOut = {
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

export type AccessRoleSummaryOut = {
  /** Id */
  id: number;
  /** Code */
  code: string;
  /** Name */
  name: string;
  /** Scope */
  scope: string;
};

export type AccessTeamsTeamIdBindingsBindingIdUsingDeleteParams = {
  team_id: number;
  binding_id: number;
};

export type AccessTeamsTeamIdBindingsBindingIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AccessTeamsTeamIdBindingsUsingGetParams = {
  team_id: number;
};

export type AccessTeamsTeamIdBindingsUsingGetResponses = {
  /**
   * OK
   */
  200: TeamBindingOut[];
};

export type AccessTeamsTeamIdBindingsUsingPostParams = {
  team_id: number;
};

export type AccessTeamsTeamIdBindingsUsingPostResponses = {
  /**
   * Created
   */
  201: TeamBindingOut;
};

export type AccessTeamsTeamIdRolesRoleIdUsingDeleteParams = {
  team_id: number;
  role_id: number;
};

export type AccessTeamsTeamIdRolesRoleIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AccessTeamsTeamIdRolesRoleIdUsingPatchParams = {
  team_id: number;
  role_id: number;
};

export type AccessTeamsTeamIdRolesRoleIdUsingPatchResponses = {
  /**
   * OK
   */
  200: AccessRoleOut;
};

export type AccessTeamsTeamIdRolesUsingGetParams = {
  team_id: number;
};

export type AccessTeamsTeamIdRolesUsingGetResponses = {
  /**
   * OK
   */
  200: AccessRoleOut[];
};

export type AccessTeamsTeamIdRolesUsingPostParams = {
  team_id: number;
};

export type AccessTeamsTeamIdRolesUsingPostResponses = {
  /**
   * Created
   */
  201: AccessRoleOut;
};

export type AccessUserOut = {
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

export enum ActionEnum {
  'mark_read' = 'mark_read',
  'mark_unread' = 'mark_unread',
  'delete' = 'delete',
}

export type IActionEnum = keyof typeof ActionEnum;

export type AdminRealNameDecisionIn = {
  /** Note 审核备注或驳回原因。 */
  note?: string;
};

export type AdminRealNameVerificationRowOut = {
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
  provider_result?: Record<string, unknown>;
  /** Id Card Media */
  id_card_media?: RealNameIdCardMediaOut[];
  /** Is Current */
  is_current: boolean;
  /** Created At */
  created_at: string;
  /** Updated At */
  updated_at: string;
  /** User */
  user: Record<string, unknown>;
};

export type AdminRealNameVerificationsUsingGetParams = {
  /** 按用户名、邮箱、手机号、实名或身份证脱敏值搜索。 */
  keyword?: string | null;
  /** 按实名状态筛选。 */
  status?: string | null;
  page?: number;
  page_size?: number | null;
};

export type AdminRealNameVerificationsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedAdminRealNameVerificationRowOut;
};

export type AdminRealNameVerificationsVerificationIdApproveUsingPostParams = {
  verification_id: number;
};

export type AdminRealNameVerificationsVerificationIdApproveUsingPostResponses =
  {
    /**
     * OK
     */
    200: RealNameVerificationDetailOut;
  };

export type AdminRealNameVerificationsVerificationIdManualReviewUsingPostParams =
  {
    verification_id: number;
  };

export type AdminRealNameVerificationsVerificationIdManualReviewUsingPostResponses =
  {
    /**
     * OK
     */
    200: RealNameVerificationDetailOut;
  };

export type AdminRealNameVerificationsVerificationIdRejectUsingPostParams = {
  verification_id: number;
};

export type AdminRealNameVerificationsVerificationIdRejectUsingPostResponses = {
  /**
   * OK
   */
  200: RealNameVerificationDetailOut;
};

export type AdminRealNameVerificationsVerificationIdRevokeUsingPostParams = {
  verification_id: number;
};

export type AdminRealNameVerificationsVerificationIdRevokeUsingPostResponses = {
  /**
   * OK
   */
  200: RealNameVerificationDetailOut;
};

export type AdminRealNameVerificationsVerificationIdUsingGetParams = {
  verification_id: number;
};

export type AdminRealNameVerificationsVerificationIdUsingGetResponses = {
  /**
   * OK
   */
  200: RealNameVerificationDetailOut;
};

export type AdminReferralsConfigUsingGetResponses = {
  /**
   * OK
   */
  200: ReferralRuleConfigOut;
};

export type AdminReferralsConfigUsingPatchResponses = {
  /**
   * OK
   */
  200: ReferralRuleConfigOut;
};

export type AdminReferralsRecordsRecordIdReviewUsingPostParams = {
  record_id: number;
};

export type AdminReferralsRecordsRecordIdReviewUsingPostResponses = {
  /**
   * OK
   */
  200: ReferralRecordOut;
};

export type AdminReferralsRecordsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type AdminReferralsRecordsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedReferralRecordOut;
};

export type AdminSubscriptionsInvoiceRequestsInvoiceRequestIdUsingPatchParams =
  {
    invoice_request_id: number;
  };

export type AdminSubscriptionsInvoiceRequestsInvoiceRequestIdUsingPatchResponses =
  {
    /**
     * OK
     */
    200: InvoiceRequestOut;
  };

export type AdminSubscriptionsInvoiceRequestsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type AdminSubscriptionsInvoiceRequestsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedInvoiceRequestOut;
};

export type AdminSubscriptionsOrdersOrderIdRefundUsingPostParams = {
  order_id: number;
};

export type AdminSubscriptionsOrdersOrderIdRefundUsingPostResponses = {
  /**
   * OK
   */
  200: SaaSOrderOut;
};

export type AdminSubscriptionsOrdersUsingGetParams = {
  organization_id?: number | null;
  page?: number;
  page_size?: number | null;
};

export type AdminSubscriptionsOrdersUsingGetResponses = {
  /**
   * OK
   */
  200: PagedSaaSOrderOut;
};

export type AdminUserCreateIn = {
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

export type AdminUserOut = {
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

export type AdminUserPasswordIn = {
  /** Password 新密码。 */
  password: string;
};

export type AdminUserPatchIn = {
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

export type AdminUsersUserIdForceLogoutUsingPostParams = {
  user_id: number;
};

export type AdminUsersUserIdForceLogoutUsingPostResponses = {
  /**
   * OK
   */
  200: ForceLogoutOut;
};

export type AdminUsersUserIdPhoneUsingDeleteParams = {
  user_id: number;
};

export type AdminUsersUserIdPhoneUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AdminUsersUserIdResetMfaUsingPostParams = {
  user_id: number;
};

export type AdminUsersUserIdResetMfaUsingPostResponses = {
  /**
   * OK
   */
  200: ResetMfaOut;
};

export type AdminUsersUserIdSetPasswordUsingPostParams = {
  user_id: number;
};

export type AdminUsersUserIdSetPasswordUsingPostResponses = {
  /**
   * OK
   */
  200: AdminUserOut;
};

export type AdminUsersUserIdStatusUsingPatchParams = {
  user_id: number;
};

export type AdminUsersUserIdStatusUsingPatchResponses = {
  /**
   * OK
   */
  200: AdminUserOut;
};

export type AdminUsersUserIdUsingPatchParams = {
  user_id: number;
};

export type AdminUsersUserIdUsingPatchResponses = {
  /**
   * OK
   */
  200: AdminUserOut;
};

export type AdminUsersUserIdWechatUsingDeleteParams = {
  user_id: number;
};

export type AdminUsersUserIdWechatUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type AdminUsersUsingGetParams = {
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

export type AdminUsersUsingGetResponses = {
  /**
   * OK
   */
  200: PagedAdminUserOut;
};

export type AdminUsersUsingPostResponses = {
  /**
   * OK
   */
  200: AdminUserOut;
};

export type AdminWalletAccountsUserIdLedgerUsingGetParams = {
  user_id: number;
  page?: number;
  page_size?: number | null;
};

export type AdminWalletAccountsUserIdLedgerUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWalletLedgerOut;
};

export type AdminWalletAccountsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type AdminWalletAccountsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWalletAccountAdminOut;
};

export type AdminWalletAdjustmentsUsingPostResponses = {
  /**
   * OK
   */
  200: WalletLedgerOut;
};

export type AdminWalletWithdrawalsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type AdminWalletWithdrawalsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWithdrawalOut;
};

export type AdminWalletWithdrawalsWithdrawalIdPayoutUsingPostParams = {
  withdrawal_id: number;
};

export type AdminWalletWithdrawalsWithdrawalIdPayoutUsingPostResponses = {
  /**
   * OK
   */
  200: WithdrawalPayoutOut;
};

export type AdminWalletWithdrawalsWithdrawalIdReviewUsingPostParams = {
  withdrawal_id: number;
};

export type AdminWalletWithdrawalsWithdrawalIdReviewUsingPostResponses = {
  /**
   * OK
   */
  200: WithdrawalOut;
};

export type AnalyticsCollectErrorOut = {
  /** Index */
  index: number;
  /** Event Name */
  event_name: string;
  /** Message */
  message: string;
};

export type AnalyticsCollectOut = {
  /** Accepted */
  accepted: number;
  /** Duplicates */
  duplicates: number;
  /** Event Ids */
  event_ids: number[];
  /** Errors */
  errors: AnalyticsCollectErrorOut[];
};

export type AnalyticsDefinitionsUsingGetResponses = {
  /**
   * OK
   */
  200: AnalyticsEventDefinitionOut[];
};

export type AnalyticsEventDefinitionOut = {
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

export type AnalyticsEventIn = {
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
  properties?: Record<string, unknown>;
  /** Idempotency Key */
  idempotency_key?: string;
};

export type AnalyticsEventsIn = {
  /** Events */
  events: AnalyticsEventIn[];
};

export type AnalyticsEventsUsingPostResponses = {
  /**
   * OK
   */
  200: AnalyticsCollectOut;
};

export type AnalyticsMetricOut = {
  /** Event Name */
  event_name: string;
  /** Label */
  label: string;
  /** Count */
  count: number;
  /** Unique Visitors */
  unique_visitors: number;
};

export type AnalyticsOverviewOut = {
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

export type AnalyticsOverviewUsingGetParams = {
  start_date?: string | null;
  end_date?: string | null;
  source?: string | null;
};

export type AnalyticsOverviewUsingGetResponses = {
  /**
   * OK
   */
  200: AnalyticsOverviewOut;
};

export type AnalyticsTargetDisplayItemOut = {
  /** Target Type */
  target_type: string;
  /** Target Id */
  target_id: string;
  /** Label */
  label: string;
};

export type AnalyticsTargetMetricOut = {
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
  metrics: Record<string, number>;
};

export type AnalyticsTargetsUsingGetParams = {
  target_type: string;
  start_date?: string | null;
  end_date?: string | null;
  source?: string | null;
  /** 逗号分隔的事件名称。 */
  event_names?: string | null;
  page?: number;
  page_size?: number | null;
};

export type AnalyticsTargetsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedAnalyticsTargetMetricOut;
};

export type AnalyticsTrendPointOut = {
  /** Date */
  date: string;
  /** Event Name */
  event_name: string;
  /** Count */
  count: number;
  /** Unique Visitors */
  unique_visitors: number;
};

export type AnalyticsTrendsUsingGetParams = {
  start_date?: string | null;
  end_date?: string | null;
  source?: string | null;
  /** 逗号分隔的事件名称。 */
  event_names?: string | null;
};

export type AnalyticsTrendsUsingGetResponses = {
  /**
   * OK
   */
  200: AnalyticsTrendPointOut[];
};

export type AnnouncementIn = {
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

export type AnnouncementOut = {
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

export type AnnouncementReceiptOut = {
  /** Announcement Id */
  announcement_id: number;
  /** Recipient Id */
  recipient_id: number;
  /** Acknowledged At */
  acknowledged_at?: string | null;
};

export type AppContextOrgOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Slug */
  slug: string;
  /** Is Owner */
  is_owner: boolean;
};

export type AppContextOut = {
  user: AppContextUserOut | null;
  org: AppContextOrgOut | null;
  /** Organizations */
  organizations: Record<string, unknown>[];
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

export type AppContextUserOut = {
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
  organizations: Record<string, unknown>[];
};

export type AppContextUsingGetResponses = {
  /**
   * OK
   */
  200: AppContextOut;
};

export type BuildingIn = {
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
  images?: Record<string, unknown>[];
  /** Tags */
  tags?: string[];
};

export type BuildingInventoryOut = {
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
  images: Record<string, unknown>[];
  /** Tags */
  tags: string[];
  counts: InventoryCountsOut;
};

export type BuildingMapCountsOut = {
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

export type BuildingMapDetailOut = {
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
  images: Record<string, unknown>[];
  /** Tags */
  tags: string[];
  counts: BuildingMapCountsOut;
  /** Houses */
  houses: BuildingMapHouseOut[];
};

export type BuildingMapHouseOut = {
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

export type BuildingMapMarkerOut = {
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

export type BuildingMapUnlocatedCountOut = {
  /** Count */
  count: number;
};

export type BuildingMapUnlocatedOut = {
  /** Id */
  id: number;
  estate: EstateSummaryOut | null;
  /** Name */
  name: string;
  /** Address */
  address: string;
  counts: BuildingMapCountsOut;
};

export type BuildingOut = {
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
  images: Record<string, unknown>[];
  /** Tags */
  tags: string[];
};

export type BuildingPatchIn = {
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
  images?: Record<string, unknown>[] | null;
  /** Tags */
  tags?: string[] | null;
};

export type BuildingSummaryOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Estate Id */
  estate_id: number | null;
  estate: EstateSummaryOut | null;
  /** Address */
  address: string;
  /** Lat */
  lat: string | null;
  /** Lng */
  lng: string | null;
};

export type BulkActionIn = {
  /** Action 批量操作类型。 */
  action: 'mark_read' | 'mark_unread' | 'delete';
  /** Ids 要处理的通知 ID 列表。 */
  ids?: number[] | null;
  /** All Unread 是否对全部未读通知执行操作。 */
  all_unread?: boolean;
};

export type BulkResultOut = {
  /** Updated */
  updated?: number;
  /** Deleted */
  deleted?: number;
};

export type ContactIn = {
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

export type ContactOut = {
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

export type ContactPatchIn = {
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

export type ContactSummaryOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Phone */
  phone: string;
};

export type CurrentSubscriptionOut = {
  /** Plan */
  plan: Record<string, unknown>;
  /** Entitlement */
  entitlement: Record<string, unknown>;
  /** Usage */
  usage: Record<string, unknown>;
  /** Subscription */
  subscription: Record<string, unknown> | null;
};

export type CustomRoleCreateIn = {
  /** Name 角色显示名称，需在当前作用域内唯一。 */
  name: string;
  /** Permission Keys 角色拥有的权限 key 列表。 */
  permission_keys?: string[] | null;
  /** Copy From 可选，基于现有角色复制权限配置的角色 ID。 */
  copy_from?: number | null;
};

export type CustomRolePatchIn = {
  /** Name 新的角色显示名称，需在当前作用域内唯一。 */
  name?: string | null;
  /** Permission Keys 新的权限 key 列表。 */
  permission_keys?: string[] | null;
};

export type DailyDashboardOut = {
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

export type DefaultBuildingIn = {
  /** Building Id */
  building_id: number;
};

export type DefaultBuildingOut = {
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

export type DeleteCheckOut = {
  /** Can Delete */
  can_delete: boolean;
  /** Resources */
  resources: RelatedResourceOut[];
};

export type EnumsUsingGetResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type EstateDetailOut = {
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
  images: Record<string, unknown>[];
  /** Building Count */
  building_count: number;
  counts: InventoryCountsOut;
};

export type EstateIn = {
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
  images?: Record<string, unknown>[];
  /** Description */
  description?: string;
};

export type EstateMapMarkerOut = {
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
  location_source: 'estate' | 'building_centroid';
  /** Building Count */
  building_count: number;
  /** Located Building Count */
  located_building_count: number;
  /** Unlocated Building Count */
  unlocated_building_count: number;
  counts: BuildingMapCountsOut;
};

export type EstateOut = {
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
  images: Record<string, unknown>[];
};

export type EstatePatchIn = {
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
  images?: Record<string, unknown>[] | null;
  /** Description */
  description?: string | null;
};

export type EstateSummaryOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Display Name */
  display_name: string;
};

export type FavoriteDisplayFactOut = {
  /** Label */
  label: string;
  /** Value */
  value: string;
};

export type FavoriteOut = {
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
  target: Record<string, unknown> | null;
};

export type FavoriteTargetDisplayOut = {
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

export type FavoriteTargetTypeOut = {
  /** Target Type */
  target_type: string;
  /** Display Name */
  display_name: string;
  /** Order */
  order: number;
  /** Favorite Count */
  favorite_count: number;
};

export type ForceLogoutOut = {
  /** Deleted Sessions */
  deleted_sessions: number;
};

export type HouseBuildingMapBuildingIdUsingGetParams = {
  building_id: number;
};

export type HouseBuildingMapBuildingIdUsingGetResponses = {
  /**
   * OK
   */
  200: BuildingMapDetailOut;
};

export type HouseBuildingMapUnlocatedCountUsingGetResponses = {
  /**
   * OK
   */
  200: BuildingMapUnlocatedCountOut;
};

export type HouseBuildingMapUnlocatedUsingGetParams = {
  keyword?: string | null;
  estate_id?: number | null;
  house_status?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseBuildingMapUnlocatedUsingGetResponses = {
  /**
   * OK
   */
  200: PagedBuildingMapUnlocatedOut;
};

export type HouseBuildingMapUsingGetParams = {
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

export type HouseBuildingMapUsingGetResponses = {
  /**
   * OK
   */
  200: PagedBuildingMapMarkerOut;
};

export type HouseBuildingsBuildingIdDeleteCheckUsingGetParams = {
  building_id: number;
};

export type HouseBuildingsBuildingIdDeleteCheckUsingGetResponses = {
  /**
   * OK
   */
  200: DeleteCheckOut;
};

export type HouseBuildingsBuildingIdUsingDeleteParams = {
  building_id: number;
};

export type HouseBuildingsBuildingIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type HouseBuildingsBuildingIdUsingGetParams = {
  building_id: number;
};

export type HouseBuildingsBuildingIdUsingGetResponses = {
  /**
   * OK
   */
  200: BuildingInventoryOut;
};

export type HouseBuildingsBuildingIdUsingPatchParams = {
  building_id: number;
};

export type HouseBuildingsBuildingIdUsingPatchResponses = {
  /**
   * OK
   */
  200: BuildingOut;
};

export type HouseBuildingsUsingGetParams = {
  estate_id?: number | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseBuildingsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedBuildingInventoryOut;
};

export type HouseBuildingsUsingPostResponses = {
  /**
   * Created
   */
  201: BuildingOut;
};

export type HouseContactsContactIdUsingGetParams = {
  contact_id: number;
};

export type HouseContactsContactIdUsingGetResponses = {
  /**
   * OK
   */
  200: ContactOut;
};

export type HouseContactsContactIdUsingPatchParams = {
  contact_id: number;
};

export type HouseContactsContactIdUsingPatchResponses = {
  /**
   * OK
   */
  200: ContactOut;
};

export type HouseContactsUsingGetParams = {
  role?: string | null;
  task?: string | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseContactsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedContactOut;
};

export type HouseContactsUsingPostResponses = {
  /**
   * Created
   */
  201: ContactOut;
};

export type HouseDefaultBuildingUsingGetResponses = {
  /**
   * OK
   */
  200: DefaultBuildingOut;
};

export type HouseDefaultBuildingUsingPutResponses = {
  /**
   * OK
   */
  200: DefaultBuildingOut;
};

export type HouseEstateMapUsingGetParams = {
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

export type HouseEstateMapUsingGetResponses = {
  /**
   * OK
   */
  200: PagedEstateMapMarkerOut;
};

export type HouseEstatesEstateIdDeleteCheckUsingGetParams = {
  estate_id: number;
};

export type HouseEstatesEstateIdDeleteCheckUsingGetResponses = {
  /**
   * OK
   */
  200: DeleteCheckOut;
};

export type HouseEstatesEstateIdUsingDeleteParams = {
  estate_id: number;
};

export type HouseEstatesEstateIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type HouseEstatesEstateIdUsingGetParams = {
  estate_id: number;
};

export type HouseEstatesEstateIdUsingGetResponses = {
  /**
   * OK
   */
  200: EstateDetailOut;
};

export type HouseEstatesEstateIdUsingPatchParams = {
  estate_id: number;
};

export type HouseEstatesEstateIdUsingPatchResponses = {
  /**
   * OK
   */
  200: EstateOut;
};

export type HouseEstatesUsingGetParams = {
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseEstatesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedEstateOut;
};

export type HouseEstatesUsingPostResponses = {
  /**
   * Created
   */
  201: EstateOut;
};

export type HouseHousesHouseIdUsingGetParams = {
  house_id: number;
};

export type HouseHousesHouseIdUsingGetResponses = {
  /**
   * OK
   */
  200: HouseOut;
};

export type HouseHousesHouseIdUsingPatchParams = {
  house_id: number;
};

export type HouseHousesHouseIdUsingPatchResponses = {
  /**
   * OK
   */
  200: HouseOut;
};

export type HouseHousesUsingGetParams = {
  estate_id?: number | null;
  building_id?: number | null;
  responsible_member_id?: number | null;
  status?: string | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseHousesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedHouseOut;
};

export type HouseHousesUsingPostResponses = {
  /**
   * Created
   */
  201: HouseOut;
};

export type HouseIn = {
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
  images?: Record<string, unknown>[];
  /** Videos */
  videos?: Record<string, unknown>[];
  /** Tags */
  tags?: string[];
  /** Public Description */
  public_description?: string;
};

export type HouseLandlordMyHousesUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type HouseLandlordMyHousesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedHouseOut;
};

export type HouseLandlordMyLeasesUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type HouseLandlordMyLeasesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedLeaseOut;
};

export type HouseLeasesLeaseIdUsingGetParams = {
  lease_id: number;
};

export type HouseLeasesLeaseIdUsingGetResponses = {
  /**
   * OK
   */
  200: LeaseOut;
};

export type HouseLeasesLeaseIdUsingPatchParams = {
  lease_id: number;
};

export type HouseLeasesLeaseIdUsingPatchResponses = {
  /**
   * OK
   */
  200: LeaseOut;
};

export type HouseLeasesUsingGetParams = {
  house_id?: number | null;
  status?: string | null;
  contract_missing?: boolean | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseLeasesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedLeaseOut;
};

export type HouseLeasesUsingPostResponses = {
  /**
   * Created
   */
  201: LeaseOut;
};

export type HouseOut = {
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
  images: Record<string, unknown>[];
  /** Videos */
  videos: Record<string, unknown>[];
  /** Tags */
  tags: string[];
  /** Effective Tags */
  effective_tags: string[];
  /** Public Description */
  public_description: string;
  /** Internal Notes */
  internal_notes: string;
  /** Extra */
  extra: Record<string, unknown>;
};

export type HousePatchIn = {
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
  images?: Record<string, unknown>[] | null;
  /** Videos */
  videos?: Record<string, unknown>[] | null;
  /** Tags */
  tags?: string[] | null;
  /** Public Description */
  public_description?: string | null;
  /** Internal Notes */
  internal_notes?: string | null;
  /** Extra */
  extra?: Record<string, unknown> | null;
};

export type HouseStaffResponsibilitiesMemberIdUsingPutParams = {
  member_id: number;
};

export type HouseStaffResponsibilitiesMemberIdUsingPutResponses = {
  /**
   * OK
   */
  200: PropertyResponsibilityMemberOut;
};

export type HouseStaffResponsibilitiesUsingGetParams = {
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseStaffResponsibilitiesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedPropertyResponsibilityMemberOut;
};

export type HouseSummaryOut = {
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

export type HouseTagSuggestionsUsingGetResponses = {
  /**
   * OK
   */
  200: TagSuggestionsOut;
};

export type HouseVacancySyncUsingPostResponses = {
  /**
   * OK
   */
  200: VacancySyncOut;
};

export type HouseViewingRecordsRecordIdUsingGetParams = {
  record_id: number;
};

export type HouseViewingRecordsRecordIdUsingGetResponses = {
  /**
   * OK
   */
  200: ViewingRecordOut;
};

export type HouseViewingRecordsRecordIdUsingPatchParams = {
  record_id: number;
};

export type HouseViewingRecordsRecordIdUsingPatchResponses = {
  /**
   * OK
   */
  200: ViewingRecordOut;
};

export type HouseViewingRecordsUsingGetParams = {
  house_id?: number | null;
  status?: string | null;
  pending_lease?: boolean | null;
  contact_missing?: boolean | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type HouseViewingRecordsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedViewingRecordOut;
};

export type HouseViewingRecordsUsingPostResponses = {
  /**
   * Created
   */
  201: ViewingRecordOut;
};

export type ImpersonateUserOut = {
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

export type InternalWalletReconcileUsingPostResponses = {
  /**
   * OK
   */
  200: ReconcileOut;
};

export type InternalWalletWithdrawalsWithdrawalIdRetryUsingPostParams = {
  withdrawal_id: number;
};

export type InternalWalletWithdrawalsWithdrawalIdRetryUsingPostResponses = {
  /**
   * OK
   */
  200: WithdrawalPayoutOut;
};

export type InventoryCountsOut = {
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

export type InviteByKeyKeyAcceptUsingPostParams = {
  /** 邀请 key。 */
  key: string;
};

export type InviteByKeyKeyAcceptUsingPostResponses = {
  /**
   * OK
   */
  200: SuccessOut;
};

export type InviteByKeyKeyDeclineUsingPostParams = {
  /** 邀请 key。 */
  key: string;
};

export type InviteByKeyKeyDeclineUsingPostResponses = {
  /**
   * OK
   */
  200: SuccessOut;
};

export type InviteByKeyKeyUsingGetParams = {
  /** 邀请 key。 */
  key: string;
};

export type InviteByKeyKeyUsingGetResponses = {
  /**
   * OK
   */
  200: PublicInviteOut;
};

export type InviteIn = {
  /** Invitee Email 被邀请人邮箱，可用于未注册用户邀请。 */
  invitee_email?: string;
  /** Invitee 被邀请用户 ID，可用于站内已存在用户邀请。 */
  invitee?: number | null;
  /** Is Owner 接受邀请后是否授予租户 owner 权限。 */
  is_owner?: boolean;
  /** Access Role 接受邀请后预设绑定的组织级访问角色。 */
  access_role?: number | null;
};

export type InviteOut = {
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

export type InvoiceProcessIn = {
  /** Status */
  status: string;
  /** Invoice Number */
  invoice_number?: string;
  /** File Url */
  file_url?: string;
  /** Admin Note */
  admin_note?: string;
};

export type InvoiceProfileIn = {
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

export type InvoiceProfileOut = {
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

export type InvoiceRequestIn = {
  /** Order Id */
  order_id: number;
};

export type InvoiceRequestOut = {
  /** Id */
  id: number;
  /** Order Id */
  order_id: number;
  /** Status */
  status: string;
  /** Profile Snapshot */
  profile_snapshot: Record<string, unknown>;
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

export type LeaseIn = {
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
  contract_files?: Record<string, unknown>[];
  /** Notes */
  notes?: string;
  /** Extra */
  extra?: Record<string, unknown>;
};

export type LeaseOut = {
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
  contract_files: Record<string, unknown>[];
  /** Notes */
  notes: string;
  /** Extra */
  extra: Record<string, unknown>;
};

export type LeasePatchIn = {
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
  contract_files?: Record<string, unknown>[] | null;
  /** Notes */
  notes?: string | null;
  /** Extra */
  extra?: Record<string, unknown> | null;
};

export enum Location_sourceEnum {
  'estate' = 'estate',
  'building_centroid' = 'building_centroid',
}

export type ILocation_sourceEnum = keyof typeof Location_sourceEnum;

export enum Media_typeEnum {
  'image' = 'image',
  'video' = 'video',
  'file' = 'file',
}

export type IMedia_typeEnum = keyof typeof Media_typeEnum;

export type MediaConfirmUsingPostResponses = {
  /**
   * Created
   */
  201: MediaFileOut;
};

export type MediaFileConfirmIn = {
  /** Oss Path 对象存储中的文件路径。 */
  oss_path: string;
  /** Original Filename 用户上传时的原始文件名。 */
  original_filename: string;
  /** Resource Type 资源类型，例如 avatar、org_logo。 */
  resource_type: string;
  /** File Size 客户端声明的文件大小，单位字节；后端会与对象存储实际大小核对。 */
  file_size: number;
};

export type MediaFileOut = {
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

export type MediaOssTokenUsingGetParams = {
  /** 上传作用域，user 表示个人，org 表示当前租户。 */
  scope: 'user' | 'org';
  /** 原始文件名，用于生成上传路径。 */
  filename: string;
  /** 可选资源类型，用于在签发上传凭证前校验作用域与扩展名。 */
  resource_type?: string | null;
};

export type MediaOssTokenUsingGetResponses = {
  /**
   * OK
   */
  200: OssTokenOut;
};

export type MediaRefIn = {
  /** Media Id 媒体文件 ID。 */
  media_id: number;
  /** Media Type 媒体类型，例如 image、video、file。 */
  media_type?: 'image' | 'video' | 'file';
};

export type MediaUploadUsingPostBody = {
  /** 要上传的文件列表。 */
  files: string[];
  /** 资源类型，例如 avatar、org_logo。 */
  resource_type: string;
  /** 上传作用域，user 或 org。 */
  scope?: string;
};

export type MediaUploadUsingPostResponses = {
  /**
   * Created
   */
  201: MediaFileOut[];
};

export type MemberDetailOut = {
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

export type MemberIn = {
  /** User 要添加到租户的用户 ID。 */
  user: number;
  /** Is Owner 是否授予该成员租户 owner 权限。 */
  is_owner?: boolean;
};

export type MemberOut = {
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

export type MemberPatchIn = {
  /** Is Owner 是否修改为租户 owner。 */
  is_owner?: boolean | null;
};

export type MemberSearchOut = {
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

export type MeOut = {
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
  tags?: Record<string, unknown>[];
  /** Notice */
  notice?: Record<string, unknown>[];
  /** Notify Count */
  notify_count?: number;
  /** Unread Count */
  unread_count?: number;
};

export enum ModeEnum {
  'preview' = 'preview',
  'apply' = 'apply',
}

export type IModeEnum = keyof typeof ModeEnum;

export enum ModeEnum2 {
  'preview' = 'preview',
  'apply' = 'apply',
}

export type IModeEnum2 = keyof typeof ModeEnum2;

export type NotificationActorOut = {
  /** Id */
  id: number;
  /** Username */
  username: string;
  /** Full Name */
  full_name: string;
  /** Avatar Url */
  avatar_url?: string | null;
};

export type NotificationDispatchesDispatchIdNotificationsUsingGetParams = {
  dispatch_id: number;
  /** 管理上下文：自动、平台或当前租户。 */
  management_context?: 'auto' | 'platform' | 'tenant';
  page?: number;
  page_size?: number | null;
};

export type NotificationDispatchesDispatchIdNotificationsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedNotificationOut;
};

export type NotificationDispatchesDispatchIdUsingGetParams = {
  dispatch_id: number;
  /** 管理上下文：自动、平台或当前租户。 */
  management_context?: 'auto' | 'platform' | 'tenant';
};

export type NotificationDispatchesDispatchIdUsingGetResponses = {
  /**
   * OK
   */
  200: NotificationDispatchOut;
};

export type NotificationDispatchesTargetsUsingGetParams = {
  /** 目标范围。 */
  scope: 'organization' | 'teams' | 'users';
  /** 按名称、标识或邮箱搜索目标。 */
  keyword?: string;
  /** 管理上下文：自动、平台或当前租户。 */
  management_context?: 'auto' | 'platform' | 'tenant';
  page?: number;
  page_size?: number | null;
};

export type NotificationDispatchesTargetsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedNotificationDispatchTargetOut;
};

export type NotificationDispatchesUsingGetParams = {
  /** 管理上下文：自动、平台或当前租户。 */
  management_context?: 'auto' | 'platform' | 'tenant';
  page?: number;
  page_size?: number | null;
};

export type NotificationDispatchesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedNotificationDispatchOut;
};

export type NotificationDispatchesUsingPostParams = {
  /** 管理上下文：自动、平台或当前租户。 */
  management_context?: 'auto' | 'platform' | 'tenant';
};

export type NotificationDispatchesUsingPostResponses = {
  /**
   * OK
   */
  200: NotificationDispatchOut;
};

export type NotificationDispatchIn = {
  /** Scope */
  scope: 'platform' | 'organization' | 'teams' | 'users';
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
  data?: Record<string, unknown>;
};

export type NotificationDispatchOut = {
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
  data: Record<string, unknown>;
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

export type NotificationDispatchTargetOut = {
  /** Id */
  id: number;
  /** Label */
  label: string;
  /** Description */
  description?: string;
  /** Avatar Url */
  avatar_url?: string | null;
};

export type NotificationOut = {
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
  data: Record<string, unknown>;
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

export type NotificationPatchIn = {
  /** Is Read 通知是否标记为已读。 */
  is_read?: boolean | null;
};

export type NotificationPreferenceOut = {
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

export type NotificationPreferencePatchIn = {
  /** In App 是否接收站内通知。 */
  in_app?: boolean | null;
  /** Email 是否接收邮件通知。 */
  email?: boolean | null;
};

export type NotificationsBulkUsingPostResponses = {
  /**
   * OK
   */
  200: BulkResultOut;
};

export type NotificationsNotificationIdUsingDeleteParams = {
  notification_id: number;
};

export type NotificationsNotificationIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type NotificationsNotificationIdUsingGetParams = {
  notification_id: number;
};

export type NotificationsNotificationIdUsingGetResponses = {
  /**
   * OK
   */
  200: NotificationOut;
};

export type NotificationsNotificationIdUsingPatchParams = {
  notification_id: number;
};

export type NotificationsNotificationIdUsingPatchResponses = {
  /**
   * OK
   */
  200: NotificationOut;
};

export type NotificationsPreferencesCategoryUsingPatchParams = {
  /** 通知类别 key。 */
  category: string;
};

export type NotificationsPreferencesCategoryUsingPatchResponses = {
  /**
   * OK
   */
  200: NotificationPreferenceOut;
};

export type NotificationsPreferencesUsingGetResponses = {
  /**
   * OK
   */
  200: NotificationPreferenceOut[];
};

export type NotificationsUnreadCountUsingGetResponses = {
  /**
   * OK
   */
  200: UnreadCountOut;
};

export type NotificationsUsingGetParams = {
  /** 按已读状态筛选。 */
  is_read?: string | null;
  page?: number;
  page_size?: number | null;
};

export type NotificationsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedNotificationOut;
};

export type OrganizationBindingOut = {
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

export type OrganizationCreateIn = {
  /** Name 租户名称。 */
  name: string;
  /** Slug 租户 slug，用于切换与公开链接。 */
  slug: string;
};

export type OrganizationCreateOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Slug */
  slug: string;
};

export type OrganizationInvitesInviteIdResendUsingPostParams = {
  invite_id: number;
};

export type OrganizationInvitesInviteIdResendUsingPostResponses = {
  /**
   * OK
   */
  200: SuccessOut;
};

export type OrganizationInvitesInviteIdUsingDeleteParams = {
  invite_id: number;
};

export type OrganizationInvitesInviteIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type OrganizationInvitesInviteIdUsingGetParams = {
  invite_id: number;
};

export type OrganizationInvitesInviteIdUsingGetResponses = {
  /**
   * OK
   */
  200: InviteOut;
};

export type OrganizationInvitesUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type OrganizationInvitesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedInviteOut;
};

export type OrganizationInvitesUsingPostResponses = {
  /**
   * Created
   */
  201: InviteOut;
};

export type OrganizationMembersMemberIdUsingDeleteParams = {
  member_id: number;
};

export type OrganizationMembersMemberIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type OrganizationMembersMemberIdUsingGetParams = {
  member_id: number;
};

export type OrganizationMembersMemberIdUsingGetResponses = {
  /**
   * OK
   */
  200: MemberOut;
};

export type OrganizationMembersMemberIdUsingPatchParams = {
  member_id: number;
};

export type OrganizationMembersMemberIdUsingPatchResponses = {
  /**
   * OK
   */
  200: MemberOut;
};

export type OrganizationMembersSearchUsingGetParams = {
  /** 待搜索的用户关键字。 */
  keyword?: string;
};

export type OrganizationMembersSearchUsingGetResponses = {
  /**
   * OK
   */
  200: MemberSearchOut[];
};

export type OrganizationMembersUsingGetParams = {
  /** 按姓名、用户名或邮箱搜索成员。 */
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type OrganizationMembersUsingGetResponses = {
  /**
   * OK
   */
  200: PagedMemberOut;
};

export type OrganizationMembersUsingPostResponses = {
  /**
   * Created
   */
  201: MemberOut;
};

export type OrganizationOut = {
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

export type OrganizationPatchIn = {
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

export type OrganizationSettingsUpdateSettingsUsingPatchResponses = {
  /**
   * OK
   */
  200: SettingsOut;
};

export type OrganizationSettingsUsingGetResponses = {
  /**
   * OK
   */
  200: SettingsOut;
};

export type OrganizationsSignoutUsingPostResponses = {
  /**
   * OK
   */
  200: SuccessOut;
};

export type OrganizationsSlugSelectUsingPostParams = {
  /** 租户 slug。 */
  slug: string;
};

export type OrganizationsSlugSelectUsingPostResponses = {
  /**
   * OK
   */
  200: OrgSelectOut;
};

export type OrganizationsSlugSetPrimaryUsingPostParams = {
  /** 租户 slug。 */
  slug: string;
};

export type OrganizationsSlugSetPrimaryUsingPostResponses = {
  /**
   * OK
   */
  200: SetPrimaryOut;
};

export type OrganizationsSlugStatusUsingPatchParams = {
  slug: string;
};

export type OrganizationsSlugStatusUsingPatchResponses = {
  /**
   * OK
   */
  200: OrganizationOut;
};

export type OrganizationsSlugTransferOwnerUsingPostParams = {
  slug: string;
};

export type OrganizationsSlugTransferOwnerUsingPostResponses = {
  /**
   * OK
   */
  200: SuccessOut;
};

export type OrganizationsSlugUsageUsingGetParams = {
  slug: string;
};

export type OrganizationsSlugUsageUsingGetResponses = {
  /**
   * OK
   */
  200: OrganizationUsageOut;
};

export type OrganizationsSlugUsingGetParams = {
  slug: string;
};

export type OrganizationsSlugUsingGetResponses = {
  /**
   * OK
   */
  200: OrganizationOut;
};

export type OrganizationsSlugUsingPatchParams = {
  slug: string;
};

export type OrganizationsSlugUsingPatchResponses = {
  /**
   * OK
   */
  200: OrganizationOut;
};

export type OrganizationsSwitchListUsingGetResponses = {
  /**
   * OK
   */
  200: SwitchListItemOut[];
};

export type OrganizationStatusPatchIn = {
  /** Is Active 是否启用租户。 */
  is_active: boolean;
};

export type OrganizationsUsingPostResponses = {
  /**
   * Created
   */
  201: OrganizationCreateOut;
};

export type OrganizationUsageOut = {
  /** Member Count */
  member_count: number;
  /** Team Count */
  team_count: number;
};

export type OrgSelectOut = {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Name */
  name: string;
  /** Is Owner */
  is_owner: boolean;
};

export type OrgUserOut = {
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

export type OssTokenOut = {
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

export type PagedAdminRealNameVerificationRowOut = {
  /** Items */
  items: AdminRealNameVerificationRowOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedAdminUserOut = {
  /** Items */
  items: AdminUserOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedAnalyticsTargetMetricOut = {
  /** Items */
  items: AnalyticsTargetMetricOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedAnnouncementOut = {
  /** Items */
  items: AnnouncementOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedBuildingInventoryOut = {
  /** Items */
  items: BuildingInventoryOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedBuildingMapMarkerOut = {
  /** Items */
  items: BuildingMapMarkerOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedBuildingMapUnlocatedOut = {
  /** Items */
  items: BuildingMapUnlocatedOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedContactOut = {
  /** Items */
  items: ContactOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedEstateMapMarkerOut = {
  /** Items */
  items: EstateMapMarkerOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedEstateOut = {
  /** Items */
  items: EstateOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedFavoriteOut = {
  /** Items */
  items: FavoriteOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedHouseOut = {
  /** Items */
  items: HouseOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedInviteOut = {
  /** Items */
  items: InviteOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedInvoiceRequestOut = {
  /** Items */
  items: InvoiceRequestOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedLeaseOut = {
  /** Items */
  items: LeaseOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedMemberOut = {
  /** Items */
  items: MemberOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedNotificationDispatchOut = {
  /** Items */
  items: NotificationDispatchOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedNotificationDispatchTargetOut = {
  /** Items */
  items: NotificationDispatchTargetOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedNotificationOut = {
  /** Items */
  items: NotificationOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedPropertyResponsibilityMemberOut = {
  /** Items */
  items: PropertyResponsibilityMemberOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedPublicHouseListOut = {
  /** Items */
  items: PublicHouseListOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedReferralRecordOut = {
  /** Items */
  items: ReferralRecordOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedSaaSOrderOut = {
  /** Items */
  items: SaaSOrderOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedTaskAssignmentOut = {
  /** Items */
  items: TaskAssignmentOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedTeamOut = {
  /** Items */
  items: TeamOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedUserOut = {
  /** Items */
  items: UserOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedUserSummaryOut = {
  /** Items */
  items: UserSummaryOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedViewingRecordOut = {
  /** Items */
  items: ViewingRecordOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedWalletAccountAdminOut = {
  /** Items */
  items: WalletAccountAdminOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedWalletLedgerOut = {
  /** Items */
  items: WalletLedgerOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedWithdrawalOut = {
  /** Items */
  items: WithdrawalOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PagedWorkTaskOut = {
  /** Items */
  items: WorkTaskOut[];
  /** Total */
  total: number;
  /** Page */
  page: number;
  /** Page Size */
  page_size: number;
};

export type PayoutCreateIn = {
  /** Provider */
  provider: string;
  /** Out Trade No */
  out_trade_no: string;
  /** Request Payload */
  request_payload?: Record<string, unknown>;
  /** Idempotency Key */
  idempotency_key: string;
};

export type PermissionOut = {
  /** Key */
  key: string;
  /** Name */
  name: string;
  /** App Label */
  app_label: string;
  /** Codename */
  codename: string;
};

export type PhoneCodeVerifyIn = {
  /** Code 短信验证码。 */
  code: string;
};

export type PlanOut = {
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
  prices: Record<string, unknown>[];
  /** Entitlement */
  entitlement: Record<string, unknown> | null;
};

export type PropertyResponsibilityMemberOut = {
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

export type PropertyResponsibilityUpdateIn = {
  /** Landlord Ids */
  landlord_ids?: number[];
  /** Building Ids */
  building_ids?: number[];
  /** Estate Ids */
  estate_ids?: number[];
};

export type PublicBuildingOut = {
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

export type PublicEstateOut = {
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

export type PublicHouseDetailOut = {
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

export type PublicHouseFiltersOut = {
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

export type PublicHouseListOut = {
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

export type PublicHousesFiltersUsingGetResponses = {
  /**
   * OK
   */
  200: PublicHouseFiltersOut;
};

export type PublicHousesHouseIdUsingGetParams = {
  house_id: number;
};

export type PublicHousesHouseIdUsingGetResponses = {
  /**
   * OK
   */
  200: PublicHouseDetailOut;
};

export type PublicHousesUsingGetParams = {
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
  sort?: 'latest' | 'rent_asc' | 'rent_desc' | 'area_asc' | 'area_desc';
  page?: number;
  page_size?: number | null;
};

export type PublicHousesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedPublicHouseListOut;
};

export type PublicInviteOut = {
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

export type PublicPublisherOut = {
  /** Slug */
  slug: string;
  /** Name */
  name: string;
  /** Logo */
  logo: ResolvedMediaRefOut[];
  /** Description */
  description: string;
};

export type PurchaseOrderIn = {
  /** Target Plan Code */
  target_plan_code: string;
  /** Billing Cycle */
  billing_cycle: string;
  /** Payment Mode */
  payment_mode: string;
};

export type RealNameIdCardMediaIn = {
  /** Media Id 媒体文件 ID。 */
  media_id: number;
  /** Media Type 媒体类型。实名认证固定为 image。 */
  media_type?: string;
  /** Side 身份证面：front 人像面，back 国徽面。 */
  side: 'front' | 'back';
};

export type RealNameIdCardMediaOut = {
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
  side: 'front' | 'back';
  /** Media Type 媒体类型。实名认证固定为 image。 */
  media_type?: string;
};

export type RealNameLogOut = {
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

export type RealNameRetryIn = {
  /** Real Name 真实姓名。 */
  real_name: string;
  /** Id Number 身份证号。 */
  id_number: string;
  /** Id Card Media 身份证正反面媒体引用。 */
  id_card_media: RealNameIdCardMediaIn[];
  /** Source 来源：user_submit 或 business_gate。 */
  source?: string;
};

export type RealNameSubmitIn = {
  /** Real Name 真实姓名。 */
  real_name: string;
  /** Id Number 身份证号。 */
  id_number: string;
  /** Id Card Media 身份证正反面媒体引用。 */
  id_card_media: RealNameIdCardMediaIn[];
  /** Source 来源：user_submit 或 business_gate。 */
  source?: string;
};

export type RealNameVerificationDetailOut = {
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
  provider_result?: Record<string, unknown>;
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
  user: Record<string, unknown>;
  /** Logs */
  logs: RealNameLogOut[];
};

export type RealNameVerificationOut = {
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
  provider_result?: Record<string, unknown>;
  /** Id Card Media */
  id_card_media?: RealNameIdCardMediaOut[];
  /** Is Current */
  is_current: boolean;
  /** Created At */
  created_at: string;
  /** Updated At */
  updated_at: string;
};

export type ReconcileOut = {
  /** Diff Count */
  diff_count: number;
};

export type ReferralRecordOut = {
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

export type ReferralReviewIn = {
  /** Approved */
  approved: boolean;
  /** Remark */
  remark?: string;
};

export type ReferralRuleConfigOut = {
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

export type ReferralRuleConfigPatchIn = {
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

export type ReferralsMeRecordsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type ReferralsMeRecordsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedReferralRecordOut;
};

export type ReferralsMeSummaryUsingGetResponses = {
  /**
   * OK
   */
  200: ReferralSummaryOut;
};

export type ReferralSummaryOut = {
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

export type RefundIn = {
  /** Amount */
  amount: number;
  /** Reason */
  reason: string;
  /** Proof */
  proof?: string;
  /** Subscription Action */
  subscription_action: string;
};

export type RelatedResourceItemOut = {
  /** Id */
  id: number;
  /** Label */
  label: string;
};

export type RelatedResourceOut = {
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

export type RelatedResourceTargetOut = {
  /** Path */
  path: string;
  /** Query */
  query: Record<string, number | string>;
};

export type ResetMfaOut = {
  /** Deleted Authenticators */
  deleted_authenticators: number;
};

export type ResolvedMediaRefOut = {
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

export type RoleBindingIn = {
  /** User 要授权的用户 ID。 */
  user: number;
  /** Role 要绑定的角色 ID。 */
  role: number;
};

export type SaaSOrderOut = {
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
  payment?: Record<string, unknown> | null;
};

export enum ScopeEnum {
  'platform' = 'platform',
  'organization' = 'organization',
  'teams' = 'teams',
  'users' = 'users',
}

export type IScopeEnum = keyof typeof ScopeEnum;

export type SetPrimaryOut = {
  /** Success */
  success: boolean;
  /** Is Primary */
  is_primary: boolean;
};

export type SetSettingIn = {
  /** Value 设置项的新值。 */
  value: unknown;
};

export type SettingOut = {
  /** Key */
  key: string;
  /** Label */
  label: string;
  /** Value */
  value: unknown;
  /** Value Type */
  value_type: string;
  /** Description */
  description: string;
  /** Widget */
  widget: string;
  /** Ui */
  ui: Record<string, unknown>;
  /** Category */
  category: string;
  /** Is Customized */
  is_customized: boolean;
};

export type SettingsOrgKeyUsingDeleteParams = {
  /** 设置项 key。 */
  key: string;
};

export type SettingsOrgKeyUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type SettingsOrgKeyUsingGetParams = {
  /** 设置项 key。 */
  key: string;
};

export type SettingsOrgKeyUsingGetResponses = {
  /**
   * OK
   */
  200: SettingOut;
};

export type SettingsOrgKeyUsingPutParams = {
  /** 设置项 key。 */
  key: string;
};

export type SettingsOrgKeyUsingPutResponses = {
  /**
   * OK
   */
  200: SettingOut;
};

export type SettingsOrgUsingGetResponses = {
  /**
   * OK
   */
  200: SettingOut[];
};

export type SettingsOut = {
  /** Billing Email */
  billing_email?: string;
};

export type SettingsPatchIn = {
  /** Billing Email 租户账单联系邮箱。 */
  billing_email?: string | null;
};

export type SettingsTeamsTeamIdKeyUsingDeleteParams = {
  team_id: number;
  /** 设置项 key。 */
  key: string;
};

export type SettingsTeamsTeamIdKeyUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type SettingsTeamsTeamIdKeyUsingGetParams = {
  team_id: number;
  /** 设置项 key。 */
  key: string;
};

export type SettingsTeamsTeamIdKeyUsingGetResponses = {
  /**
   * OK
   */
  200: SettingOut;
};

export type SettingsTeamsTeamIdKeyUsingPutParams = {
  team_id: number;
  /** 设置项 key。 */
  key: string;
};

export type SettingsTeamsTeamIdKeyUsingPutResponses = {
  /**
   * OK
   */
  200: SettingOut;
};

export type SettingsTeamsTeamIdUsingGetParams = {
  team_id: number;
};

export type SettingsTeamsTeamIdUsingGetResponses = {
  /**
   * OK
   */
  200: SettingOut[];
};

export type SettingsUserKeyUsingDeleteParams = {
  /** 个人设置 key。 */
  key: string;
};

export type SettingsUserKeyUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type SettingsUserKeyUsingGetParams = {
  /** 个人设置 key。 */
  key: string;
};

export type SettingsUserKeyUsingGetResponses = {
  /**
   * OK
   */
  200: UserSettingOut;
};

export type SettingsUserKeyUsingPutParams = {
  /** 个人设置 key。 */
  key: string;
};

export type SettingsUserKeyUsingPutResponses = {
  /**
   * OK
   */
  200: UserSettingOut;
};

export type SettingsUserUsingGetResponses = {
  /**
   * OK
   */
  200: UserSettingOut[];
};

export enum SideEnum {
  'front' = 'front',
  'back' = 'back',
}

export type ISideEnum = keyof typeof SideEnum;

export enum SideEnum2 {
  'front' = 'front',
  'back' = 'back',
}

export type ISideEnum2 = keyof typeof SideEnum2;

export type SocialBindingItemOut = {
  /** Provider */
  provider: string;
  /** Label */
  label: string;
  /** Connected */
  connected: boolean;
};

export type SocialBindingsOut = {
  /** Items */
  items: SocialBindingItemOut[];
};

export type SplitPhoneIn = {
  /** Phone Country Code 手机号国家区号。 */
  phone_country_code?: string;
  /** Phone National Number 手机号本地号码。 */
  phone_national_number: string;
};

export type SplitPhoneSignupIn = {
  /** Phone Country Code 手机号国家区号。 */
  phone_country_code?: string;
  /** Phone National Number 手机号本地号码。 */
  phone_national_number: string;
  /** Email 邮箱。 */
  email: string;
  /** Password 密码。 */
  password: string;
};

export enum StatusEnum {
  'matched' = 'matched',
  'overridden' = 'overridden',
  'ambiguous' = 'ambiguous',
  'new' = 'new',
  'created' = 'created',
}

export type IStatusEnum = keyof typeof StatusEnum;

export enum StatusEnum2 {
  'valid' = 'valid',
  'error' = 'error',
  'ignored' = 'ignored',
}

export type IStatusEnum2 = keyof typeof StatusEnum2;

export type SubscriptionsCurrentUsingGetResponses = {
  /**
   * OK
   */
  200: CurrentSubscriptionOut;
};

export type SubscriptionsInvoiceProfileUsingGetResponses = {
  /**
   * OK
   */
  200: InvoiceProfileOut | null;
};

export type SubscriptionsInvoiceProfileUsingPutResponses = {
  /**
   * OK
   */
  200: InvoiceProfileOut;
};

export type SubscriptionsInvoiceRequestsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type SubscriptionsInvoiceRequestsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedInvoiceRequestOut;
};

export type SubscriptionsInvoiceRequestsUsingPostResponses = {
  /**
   * Created
   */
  201: InvoiceRequestOut;
};

export type SubscriptionsOrdersOrderNoUsingGetParams = {
  order_no: string;
};

export type SubscriptionsOrdersOrderNoUsingGetResponses = {
  /**
   * OK
   */
  200: SaaSOrderOut;
};

export type SubscriptionsOrdersUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type SubscriptionsOrdersUsingGetResponses = {
  /**
   * OK
   */
  200: PagedSaaSOrderOut;
};

export type SubscriptionsOrdersUsingPostResponses = {
  /**
   * Created
   */
  201: SaaSOrderOut;
};

export type SubscriptionsPaymentsWechatNotifyUsingPostResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type SubscriptionsPlansUsingGetResponses = {
  /**
   * OK
   */
  200: PlanOut[];
};

export type SuccessOut = {
  /** Success */
  success: boolean;
};

export type SwitchListItemOut = {
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

export type TagSuggestionsOut = {
  /** Tags */
  tags: string[];
};

export type TaskActionIn = {
  /** Result */
  result?: string;
};

export type TaskAssignmentOut = {
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

export type TeamBindingOut = {
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

export type TeamIn = {
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

export type TeamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPostParams =
  {
    announcement_id: number;
  };

export type TeamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPostResponses =
  {
    /**
     * OK
     */
    200: AnnouncementReceiptOut;
  };

export type TeamOperationsAnnouncementsAnnouncementIdPublishUsingPostParams = {
  announcement_id: number;
};

export type TeamOperationsAnnouncementsAnnouncementIdPublishUsingPostResponses =
  {
    /**
     * OK
     */
    200: AnnouncementOut;
  };

export type TeamOperationsAnnouncementsAnnouncementIdUsingGetParams = {
  announcement_id: number;
};

export type TeamOperationsAnnouncementsAnnouncementIdUsingGetResponses = {
  /**
   * OK
   */
  200: AnnouncementOut;
};

export type TeamOperationsAnnouncementsAnnouncementIdWithdrawUsingPostParams = {
  announcement_id: number;
};

export type TeamOperationsAnnouncementsAnnouncementIdWithdrawUsingPostResponses =
  {
    /**
     * OK
     */
    200: AnnouncementOut;
  };

export type TeamOperationsAnnouncementsUsingGetParams = {
  team_id?: number | null;
  status?: string | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type TeamOperationsAnnouncementsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedAnnouncementOut;
};

export type TeamOperationsAnnouncementsUsingPostResponses = {
  /**
   * Created
   */
  201: AnnouncementOut;
};

export type TeamOperationsCapabilitiesOut = {
  /** Announcement Organization Manage */
  announcement_organization_manage: boolean;
  /** Announcement Team Ids */
  announcement_team_ids?: number[];
  /** Task Organization Manage */
  task_organization_manage: boolean;
  /** Task Team Ids */
  task_team_ids?: number[];
};

export type TeamOperationsCapabilitiesUsingGetResponses = {
  /**
   * OK
   */
  200: TeamOperationsCapabilitiesOut;
};

export type TeamOperationsDashboardDailyUsingGetResponses = {
  /**
   * OK
   */
  200: DailyDashboardOut;
};

export type TeamOperationsTaskAssigneesUsingGetParams = {
  team_id?: number | null;
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type TeamOperationsTaskAssigneesUsingGetResponses = {
  /**
   * OK
   */
  200: PagedUserSummaryOut;
};

export type TeamOperationsTaskAssignmentsAssignmentIdAcceptUsingPostParams = {
  assignment_id: number;
};

export type TeamOperationsTaskAssignmentsAssignmentIdAcceptUsingPostResponses =
  {
    /**
     * OK
     */
    200: TaskAssignmentOut;
  };

export type TeamOperationsTaskAssignmentsAssignmentIdCompleteUsingPostParams = {
  assignment_id: number;
};

export type TeamOperationsTaskAssignmentsAssignmentIdCompleteUsingPostResponses =
  {
    /**
     * OK
     */
    200: TaskAssignmentOut;
  };

export type TeamOperationsTaskAssignmentsAssignmentIdRejectUsingPostParams = {
  assignment_id: number;
};

export type TeamOperationsTaskAssignmentsAssignmentIdRejectUsingPostResponses =
  {
    /**
     * OK
     */
    200: TaskAssignmentOut;
  };

export type TeamOperationsTaskAssignmentsAssignmentIdUsingGetParams = {
  assignment_id: number;
};

export type TeamOperationsTaskAssignmentsAssignmentIdUsingGetResponses = {
  /**
   * OK
   */
  200: TaskAssignmentOut;
};

export type TeamOperationsTaskAssignmentsUsingGetParams = {
  status?: string | null;
  overdue?: boolean | null;
  page?: number;
  page_size?: number | null;
};

export type TeamOperationsTaskAssignmentsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedTaskAssignmentOut;
};

export type TeamOperationsTasksTaskIdCancelUsingPostParams = {
  task_id: number;
};

export type TeamOperationsTasksTaskIdCancelUsingPostResponses = {
  /**
   * OK
   */
  200: WorkTaskOut;
};

export type TeamOperationsTasksTaskIdUsingGetParams = {
  task_id: number;
};

export type TeamOperationsTasksTaskIdUsingGetResponses = {
  /**
   * OK
   */
  200: WorkTaskOut;
};

export type TeamOperationsTasksUsingGetParams = {
  team_id?: number | null;
  status?: string | null;
  priority?: string | null;
  keyword?: string | null;
  mine?: boolean | null;
  page?: number;
  page_size?: number | null;
};

export type TeamOperationsTasksUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWorkTaskOut;
};

export type TeamOperationsTasksUsingPostResponses = {
  /**
   * Created
   */
  201: WorkTaskOut;
};

export type TeamOut = {
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

export type TeamPatchIn = {
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

export type TeamsTeamIdUsingDeleteParams = {
  team_id: number;
};

export type TeamsTeamIdUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type TeamsTeamIdUsingGetParams = {
  team_id: number;
};

export type TeamsTeamIdUsingGetResponses = {
  /**
   * OK
   */
  200: TeamOut;
};

export type TeamsTeamIdUsingPatchParams = {
  team_id: number;
};

export type TeamsTeamIdUsingPatchResponses = {
  /**
   * OK
   */
  200: TeamOut;
};

export type TeamsUsingGetParams = {
  /** 按团队名称搜索。 */
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type TeamsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedTeamOut;
};

export type TeamsUsingPostResponses = {
  /**
   * Created
   */
  201: TeamOut;
};

export type TestNotificationIn = {
  /** User Id */
  user_id: number;
  /** Send Email */
  send_email?: boolean;
  /** Send In App */
  send_in_app?: boolean;
};

export type TestNotificationsStaffUsersUsingGetResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type TestNotificationsUsingPostResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type TotpSetupOut = {
  /** Secret */
  secret: string;
  /** Totp Url */
  totp_url: string;
};

export type TransferOwnerIn = {
  /** User 新的 owner 用户 ID，必须已经是当前租户成员。 */
  user: number;
};

export type UnreadCountOut = {
  /** Count */
  count: number;
};

export type UserOut = {
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

export type UserPatchIn = {
  /** First Name 用户名字。 */
  first_name?: string | null;
  /** Last Name 用户姓氏。 */
  last_name?: string | null;
  /** Timezone 用户时区标识。 */
  timezone?: string | null;
  /** Avatar 用户头像媒体引用，最多 1 个。 */
  avatar?: MediaRefIn[] | null;
};

export type UsersAuthAppCodeRequestUsingPostResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type UsersAuthBrowserAccountPhoneUsingPostResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type UsersAuthBrowserPhoneVerifyUsingPostResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type UsersAuthBrowserSignupUsingPostResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type UserSettingOut = {
  /** Key */
  key: string;
  /** Value */
  value: unknown;
};

export type UsersImpersonateSearchUsingGetParams = {
  /** 按姓名、用户名或邮箱搜索。 */
  keyword?: string;
};

export type UsersImpersonateSearchUsingGetResponses = {
  /**
   * OK
   */
  200: ImpersonateUserOut[];
};

export type UsersMeFavoriteTypeUsingGetResponses = {
  /**
   * OK
   */
  200: FavoriteTargetTypeOut[];
};

export type UsersMeFavoriteUsingDeleteParams = {
  target_type: string;
  target_id: string;
};

export type UsersMeFavoriteUsingDeleteResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type UsersMeFavoriteUsingGetParams = {
  target_type?: string | null;
  target_id?: string | null;
  page?: number;
  page_size?: number | null;
};

export type UsersMeFavoriteUsingGetResponses = {
  /**
   * OK
   */
  200: PagedFavoriteOut;
};

export type UsersMeFavoriteUsingPutParams = {
  target_type: string;
  target_id: string;
};

export type UsersMeFavoriteUsingPutResponses = {
  /**
   * OK
   */
  200: FavoriteOut;
  /**
   * Created
   */
  201: FavoriteOut;
};

export type UsersMeMfaAuthenticatorsAuthenticatorTypeUsingDeleteParams = {
  authenticator_type: string;
};

export type UsersMeMfaAuthenticatorsAuthenticatorTypeUsingDeleteResponses = {
  /**
   * OK
   */
  200: Record<string, unknown>;
};

export type UsersMeMfaTotpSetupUsingGetResponses = {
  /**
   * OK
   */
  200: TotpSetupOut;
};

export type UsersMeRealNameLogsUsingGetResponses = {
  /**
   * OK
   */
  200: RealNameLogOut[];
};

export type UsersMeRealNameRetryUsingPostResponses = {
  /**
   * OK
   */
  200: RealNameVerificationOut;
};

export type UsersMeRealNameSubmitUsingPostResponses = {
  /**
   * OK
   */
  200: RealNameVerificationOut;
};

export type UsersMeRealNameUsingGetResponses = {
  /**
   * OK
   */
  200: RealNameVerificationOut;
};

export type UsersMeSocialBindingsUsingGetResponses = {
  /**
   * OK
   */
  200: SocialBindingsOut;
};

export type UsersMeUsingGetResponses = {
  /**
   * OK
   */
  200: MeOut;
};

export type UsersMeWechatPhoneUsingPostResponses = {
  /**
   * OK
   */
  200: WechatPhoneOut;
};

export type UserStatusPatchIn = {
  /** Is Active 是否启用用户。 */
  is_active: boolean;
};

export type UserSummaryOut = {
  /** Id */
  id: number;
  /** Username */
  username: string;
  /** Full Name */
  full_name: string;
};

export type UsersUserIdUsingGetParams = {
  user_id: number;
};

export type UsersUserIdUsingGetResponses = {
  /**
   * OK
   */
  200: UserOut;
};

export type UsersUserIdUsingPatchParams = {
  user_id: number;
};

export type UsersUserIdUsingPatchResponses = {
  /**
   * OK
   */
  200: UserOut;
};

export type UsersUsingGetParams = {
  /** 按用户姓名搜索。 */
  keyword?: string | null;
  page?: number;
  page_size?: number | null;
};

export type UsersUsingGetResponses = {
  /**
   * OK
   */
  200: PagedUserOut;
};

export type VacancySyncBlockOut = {
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

export type VacancySyncBuildingCandidateOut = {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Address */
  address: string;
};

export type VacancySyncBuildingMatchOut = {
  /** Status */
  status: 'matched' | 'overridden' | 'ambiguous' | 'new' | 'created';
  /** Building Id */
  building_id: number | null;
  /** Name */
  name: string | null;
  /** Address */
  address: string;
  /** Candidates */
  candidates: VacancySyncBuildingCandidateOut[];
};

export type VacancySyncBuildingOverrideIn = {
  /** Block Index */
  block_index: number;
  /** Building Id */
  building_id: number;
};

export type VacancySyncChangesOut = {
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

export type VacancySyncErrorOut = {
  /** Code */
  code: string;
  /** Message */
  message: string;
  /** Block Index */
  block_index: number | null;
  /** Line Number */
  line_number: number | null;
};

export type VacancySyncHouseChangeOut = {
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

export type VacancySyncIn = {
  /** Mode */
  mode?: 'preview' | 'apply';
  /** Raw Text */
  raw_text: string;
  /** Building Overrides */
  building_overrides?: VacancySyncBuildingOverrideIn[];
  /** Ignored Lines */
  ignored_lines?: number[];
  /** Plan Hash */
  plan_hash?: string | null;
};

export type VacancySyncLineOut = {
  /** Line Number */
  line_number: number;
  /** Raw */
  raw: string;
  /** Status */
  status: 'valid' | 'error' | 'ignored';
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

export type VacancySyncOut = {
  /** Mode */
  mode: 'preview' | 'apply';
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

export type VacancySyncSummaryOut = {
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

export type VersionUsingGetResponses = {
  /**
   * OK
   */
  200: unknown;
};

export type ViewingRecordIn = {
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

export type ViewingRecordOut = {
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
  extra: Record<string, unknown>;
  /** Is Active */
  is_active: boolean;
  /** Signed Lease Id */
  signed_lease_id?: number | null;
};

export type ViewingRecordPatchIn = {
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
  extra?: Record<string, unknown> | null;
  /** Is Active */
  is_active?: boolean | null;
};

export type ViewingRecordSummaryOut = {
  /** Id */
  id: number;
  /** Label */
  label: string;
  /** Customer Name */
  customer_name: string;
  /** Customer Phone */
  customer_phone: string;
};

export type WalletAccountAdminOut = {
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

export type WalletAdjustmentIn = {
  /** User Id 待调账用户 ID。 */
  user_id: number;
  /** Amount 调账金额，正数增加，负数扣减。 */
  amount: number;
  /** Idempotency Key 调账幂等键。 */
  idempotency_key: string;
  /** Remark 调账原因备注。 */
  remark?: string;
};

export type WalletLedgerOut = {
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

export type WalletMeLedgerUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type WalletMeLedgerUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWalletLedgerOut;
};

export type WalletMeSummaryUsingGetResponses = {
  /**
   * OK
   */
  200: WalletSummaryOut;
};

export type WalletMeWithdrawalsUsingGetParams = {
  page?: number;
  page_size?: number | null;
};

export type WalletMeWithdrawalsUsingGetResponses = {
  /**
   * OK
   */
  200: PagedWithdrawalOut;
};

export type WalletMeWithdrawalsUsingPostResponses = {
  /**
   * Created
   */
  201: WithdrawalOut;
};

export type WalletMeWithdrawalsWithdrawalIdCancelUsingPostParams = {
  withdrawal_id: number;
};

export type WalletMeWithdrawalsWithdrawalIdCancelUsingPostResponses = {
  /**
   * OK
   */
  200: WithdrawalOut;
};

export type WalletMeWithdrawalsWithdrawalIdUsingGetParams = {
  withdrawal_id: number;
};

export type WalletMeWithdrawalsWithdrawalIdUsingGetResponses = {
  /**
   * OK
   */
  200: WithdrawalOut;
};

export type WalletPayoutCallbackProviderUsingPostParams = {
  provider: string;
};

export type WalletPayoutCallbackProviderUsingPostResponses = {
  /**
   * OK
   */
  200: WithdrawalPayoutOut;
};

export type WalletSummaryOut = {
  /** Available Balance */
  available_balance: number;
  /** Frozen Balance */
  frozen_balance: number;
  /** Total Income */
  total_income: number;
  /** Total Withdrawn */
  total_withdrawn: number;
};

export type WechatPhoneIn = {
  /** Phone Code 微信小程序获取手机号接口返回的 phone code。 */
  phone_code: string;
};

export type WechatPhoneOut = {
  /** Phone Country Code */
  phone_country_code: string;
  /** Phone National Number */
  phone_national_number: string;
  /** Merged */
  merged: boolean;
};

export type WithdrawalIn = {
  /** Amount */
  amount: number;
  /** Fee Amount */
  fee_amount?: number;
  /** Pay Channel */
  pay_channel: string;
  /** Payee Account */
  payee_account: Record<string, unknown>;
  /** Client Request Id */
  client_request_id: string;
};

export type WithdrawalOut = {
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
  payee_account_snapshot: Record<string, unknown>;
  /** Reject Reason */
  reject_reason: string;
  /** Created At */
  created_at: string;
  /** Reviewed At */
  reviewed_at?: string | null;
};

export type WithdrawalPayoutOut = {
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

export type WithdrawalRetryIn = {
  /** Provider */
  provider: string;
  /** Out Trade No */
  out_trade_no: string;
  /** Request Payload */
  request_payload?: Record<string, unknown>;
  /** Idempotency Key */
  idempotency_key: string;
};

export type WithdrawalReviewIn = {
  /** Approved */
  approved: boolean;
  /** Reason */
  reason?: string;
  /** Idempotency Key */
  idempotency_key: string;
};

export type WorkTaskIn = {
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
  data?: Record<string, unknown>;
};

export type WorkTaskOut = {
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
  data: Record<string, unknown>;
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
