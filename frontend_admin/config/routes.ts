import {
  DEFAULT_PROPERTY_LIST_PATH,
  RENTAL_PATHS,
  SPACE_PATHS,
} from '../src/utils/adminRouting';

/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路径增加 layout 组件时使用。
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置路由的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn， 注意去除风格后缀和大小写，如想要配置图标为 <StepBackwardOutlined /> 则取值应为 stepBackward 或 StepBackward，如想要配置图标为 <UserOutlined /> 则取值应为 user 或者 User
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/landlord-invitations/:token',
    component: './landlord/invitation-accept',
    layout: false,
    hideInMenu: true,
  },
  {
    path: '/landlords/:publicKey/houses/:houseId',
    component: './landlord/public-house',
    layout: false,
    hideInMenu: true,
  },
  {
    path: '/landlords/:publicKey',
    component: './landlord/public-store',
    layout: false,
    hideInMenu: true,
  },
  {
    path: '/invitations/:key',
    component: './space/invitation-accept',
    layout: false,
    hideInMenu: true,
  },
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user/login',
        name: 'login',
        component: './user/login',
      },
      {
        path: '/user',
        redirect: '/user/login',
      },
      {
        name: 'register-result',
        icon: 'checkCircle',
        path: '/user/register-result',
        component: './user/register-result',
      },
      {
        name: 'register',
        icon: 'userAdd',
        path: '/user/register',
        component: './user/register',
      },
      {
        path: '/user/verify-phone',
        component: './user/verify-phone',
      },
      {
        path: '/user/password/reset',
        component: './user/password-reset',
      },
      {
        path: '/user/password/reset/key/:key',
        component: './user/password-reset/confirm',
      },
      {
        path: '/user/confirm-email/:key',
        component: './user/confirm-email',
      },
      {
        path: '/user/social/error',
        component: './user/social-error',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: RENTAL_PATHS.root,
    redirect: RENTAL_PATHS.workbenchOverview,
    hideInMenu: true,
  },
  {
    path: RENTAL_PATHS.workbench,
    name: 'workbench',
    icon: 'dashboard',
    routes: [
      {
        path: RENTAL_PATHS.workbench,
        redirect: RENTAL_PATHS.workbenchOverview,
      },
      {
        name: 'overview',
        icon: 'dashboard',
        path: RENTAL_PATHS.workbenchOverview,
        component: './team-operations/workbench',
      },
      {
        path: RENTAL_PATHS.workbenchSpace,
        redirect: `${RENTAL_PATHS.workbenchOverview}?view=space`,
        hideInMenu: true,
      },
      {
        name: 'tasks',
        icon: 'checkSquare',
        path: RENTAL_PATHS.tasks,
        component: './team-operations/tasks',
      },
      {
        name: 'announcements',
        icon: 'sound',
        path: RENTAL_PATHS.announcements,
        component: './team-operations/announcements',
      },
    ],
  },
  {
    path: RENTAL_PATHS.properties,
    name: 'property-assets',
    icon: 'home',
    routes: [
      {
        path: RENTAL_PATHS.properties,
        redirect: DEFAULT_PROPERTY_LIST_PATH,
      },
      {
        name: 'houses',
        icon: 'home',
        path: RENTAL_PATHS.propertyList,
        component: './rental/houses',
      },
      {
        name: 'map',
        icon: 'environment',
        path: RENTAL_PATHS.map,
        component: './rental/map',
      },
      {
        name: 'vacancy-sync',
        icon: 'sync',
        path: RENTAL_PATHS.vacancySync,
        component: './rental/vacancy-sync',
      },
      {
        name: 'building-detail',
        path: `${RENTAL_PATHS.buildings}/:id`,
        component: './rental/buildings/detail',
        hideInMenu: true,
      },
      {
        name: 'estate-detail',
        path: `${RENTAL_PATHS.estates}/:id`,
        component: './rental/estates/detail',
        hideInMenu: true,
      },
      {
        name: 'house-new',
        icon: 'plusCircle',
        path: RENTAL_PATHS.propertyNew,
        component: './rental/houses/new',
        hideInMenu: true,
      },
      {
        name: 'house-detail',
        icon: 'profile',
        path: `${RENTAL_PATHS.properties}/:id`,
        component: './rental/houses/detail',
        hideInMenu: true,
      },
    ],
  },
  {
    name: 'customers',
    icon: 'contacts',
    path: RENTAL_PATHS.customers,
    component: './rental/contacts',
  },
  {
    name: 'viewings',
    icon: 'calendar',
    path: RENTAL_PATHS.viewings,
    component: './rental/viewings',
  },
  {
    name: 'leases',
    icon: 'fileText',
    path: RENTAL_PATHS.leases,
    component: './rental/leases',
  },
  {
    name: 'earnings',
    icon: 'accountBook',
    path: RENTAL_PATHS.earnings,
    component: './rental/earnings',
    access: 'canViewAllocation',
  },
  {
    name: 'data-insights',
    icon: 'barChart',
    path: RENTAL_PATHS.analytics,
    component: './rental/analytics',
    access: 'canViewAnalytics',
  },
  {
    path: SPACE_PATHS.root,
    name: 'space-management',
    icon: 'team',
    routes: [
      {
        path: SPACE_PATHS.root,
        redirect: SPACE_PATHS.organization,
      },
      {
        name: '组织架构',
        locale: false,
        icon: 'cluster',
        path: SPACE_PATHS.organization,
        component: './space/organization',
      },
      {
        path: SPACE_PATHS.members,
        hideInMenu: true,
        redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=members`,
      },
      {
        path: SPACE_PATHS.invitations,
        hideInMenu: true,
        redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=invites`,
      },
      {
        path: SPACE_PATHS.teams,
        hideInMenu: true,
        redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=overview`,
      },
      {
        path: SPACE_PATHS.responsibilities,
        hideInMenu: true,
        redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=members`,
      },
      {
        path: SPACE_PATHS.access,
        name: '角色管理',
        locale: false,
        icon: 'key',
        component: './access',
        hideInMenu: true,
        access: 'canViewRoleManagement',
      },
      {
        path: SPACE_PATHS.profile,
        hideInMenu: true,
        redirect: `${SPACE_PATHS.organization}?section=members&node=organization&tab=overview`,
      },
      {
        path: SPACE_PATHS.subscriptionOrders,
        component: './space/subscription/orders',
        hideInMenu: true,
        access: 'canViewSubscriptions',
      },
      {
        name: 'subscription',
        icon: 'creditCard',
        path: SPACE_PATHS.subscription,
        component: './space/subscription',
        access: 'canViewSubscriptions',
      },
      {
        path: SPACE_PATHS.settings,
        name: 'business-settings',
        icon: 'setting',
        access: 'canViewBusinessSettings',
        routes: [
          {
            path: SPACE_PATHS.settings,
            redirect: SPACE_PATHS.organizationSettings,
          },
          {
            name: 'organization',
            icon: 'control',
            path: SPACE_PATHS.organizationSettings,
            component: './settings-management/organization',
            access: 'canViewOrganizationSettings',
          },
          {
            name: 'team',
            icon: 'sliders',
            path: SPACE_PATHS.teamSettings,
            component: './settings-management/team',
            access: 'canViewTeamSettings',
          },
        ],
      },
      {
        name: 'notification-dispatches',
        icon: 'notification',
        path: SPACE_PATHS.notificationDispatches,
        component: './platform-management/notification-dispatches',
        access: 'canManageNotificationDispatches',
      },
    ],
  },
  {
    path: '/super-admin',
    name: 'super-admin',
    icon: 'crown',
    access: 'canSuperAdmin',
    routes: [
      {
        path: '/super-admin',
        redirect: '/super-admin/users',
      },
      {
        name: 'users',
        icon: 'user',
        path: '/super-admin/users',
        component: './platform-management/users',
      },
      {
        name: 'real-name',
        icon: 'idcard',
        path: '/super-admin/real-name',
        component: './platform-management/real-name',
      },
      {
        name: 'wallet-accounts',
        icon: 'accountBook',
        path: '/super-admin/wallet/accounts',
        component: './wallet-management/accounts',
      },
      {
        name: 'wallet-withdrawals',
        icon: 'transaction',
        path: '/super-admin/wallet/withdrawals',
        component: './wallet-management/withdrawals',
      },
      {
        name: 'subscriptions',
        icon: 'creditCard',
        path: '/super-admin/subscriptions',
        component: './platform-management/subscriptions',
      },
      {
        name: 'referrals',
        icon: 'shareAlt',
        path: '/super-admin/referrals',
        component: './platform-management/referrals',
      },
      {
        name: 'notification-dispatches',
        icon: 'notification',
        path: '/super-admin/notification-dispatches',
        component: './platform-management/notification-dispatches',
      },
      {
        name: 'operations',
        icon: 'tool',
        path: '/super-admin/operations',
        component: './system-tools/operations',
      },
    ],
  },
  {
    path: '/personal-business',
    name: 'personal-business',
    icon: 'solution',
    hideInMenu: true,
    routes: [
      {
        path: '/personal-business',
        redirect: '/personal-business/overview',
      },
      {
        name: 'overview',
        icon: 'fundProjectionScreen',
        path: '/personal-business/overview',
        component: './personal-business/overview',
      },
      {
        name: 'favorites',
        icon: 'heart',
        path: '/personal-business/favorites',
        component: './personal-business/favorites',
      },
      {
        name: 'notifications',
        icon: 'bell',
        path: '/personal-business/notifications',
        component: './platform-management/notifications',
      },
      {
        name: '房东中心',
        locale: false,
        icon: 'home',
        path: '/personal-business/landlord',
        component: './personal-business/landlord',
      },
    ],
  },
  {
    name: 'account',
    icon: 'user',
    path: '/account',
    hideInMenu: true,
    routes: [
      {
        path: '/account',
        redirect: '/account/center',
      },
      {
        name: 'center',
        icon: 'user',
        path: '/account/center',
        component: './account/center',
      },
      {
        path: '/account/settings',
        component: './account/settings',
      },
    ],
  },
  {
    path: '/',
    redirect: RENTAL_PATHS.workbenchOverview,
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
