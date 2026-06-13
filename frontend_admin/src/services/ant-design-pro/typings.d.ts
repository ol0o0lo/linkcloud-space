// @ts-ignore
/* eslint-disable */

declare namespace API {
  type TagType = {
    key?: string;
    label?: string;
  };

  type CurrentUserNotice = {
    id?: string;
    title?: string;
    logo?: string;
    description?: string;
    updatedAt?: string;
    member?: string;
    href?: string;
    memberLink?: string;
  };

  type CurrentUser = {
    id?: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    userid?: string;
    email?: string;
    signature?: string;
    title?: string;
    group?: string;
    tags?: TagType[];
    notifyCount?: number;
    unreadCount?: number;
    country?: string;
    access?: string;
    notice?: CurrentUserNotice[];
    phoneCountryCode?: string;
    phoneNationalNumber?: string;
  };

  type OrganizationOption = {
    id: number;
    name: string;
    slug: string;
    isCurrent: boolean;
    isPrimary: boolean;
  };

  type LoginResult = {
    status?: string;
    type?: string;
    currentAuthority?: string;
  };

  type PageParams = {
    current?: number;
    pageSize?: number;
  };

  type RuleListItem = {
    key?: number;
    disabled?: boolean;
    href?: string;
    avatar?: string;
    name?: string;
    owner?: string;
    desc?: string;
    callNo?: number;
    status?: number;
    updatedAt?: string;
    createdAt?: string;
    progress?: number;
  };

  type RuleList = {
    data?: RuleListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  };

  type FakeCaptcha = {
    code?: number;
    status?: string;
  };

  type LoginParams = {
    username?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  };

  type ErrorResponse = {
    /** 业务约定的错误码 */
    errorCode: string;
    /** 业务上的错误信息 */
    errorMessage?: string;
    /** 业务上的请求是否成功 */
    success?: boolean;
  };

  type NoticeIconList = {
    data?: NoticeIconItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  };

  type NoticeIconItemType = 'notification' | 'message' | 'event';

  type NoticeIconItem = {
    id?: string;
    extra?: string;
    key?: string;
    read?: boolean;
    avatar?: string;
    title?: string;
    status?: string;
    datetime?: string;
    description?: string;
    type?: NoticeIconItemType;
  };
}
