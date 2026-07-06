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
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: '/tenant',
    name: 'tenant-workbench',
    icon: 'apartment',
    routes: [
      {
        path: '/tenant',
        redirect: '/tenant/members',
      },
      {
        path: '/tenant/overview',
        redirect: '/tenant/members',
        hideInMenu: true,
      },
      {
        name: 'profile',
        icon: 'profile',
        path: '/tenant/settings',
        component: './tenant/settings',
      },
      {
        name: 'members',
        icon: 'team',
        path: '/tenant/members',
        component: './tenant/members',
      },
      {
        name: 'invites',
        icon: 'mail',
        path: '/tenant/invites',
        component: './tenant/invites',
      },
      {
        name: 'teams',
        icon: 'cluster',
        path: '/tenant/teams',
        component: './tenant/teams',
      },
    ],
  },
  {
    path: '/access',
    name: 'access-management',
    icon: 'safetyCertificate',
    routes: [
      {
        path: '/access',
        component: './access',
      },
      {
        name: 'organization-roles',
        icon: 'solution',
        path: '/access/organization-roles',
        component: './access/organization-roles',
      },
      {
        name: 'organization-bindings',
        icon: 'audit',
        path: '/access/organization-bindings',
        component: './access/organization-bindings',
      },
      {
        name: 'team-roles',
        icon: 'deploymentUnit',
        path: '/access/team-roles',
        component: './access/team-roles',
      },
      {
        name: 'team-bindings',
        icon: 'partition',
        path: '/access/team-bindings',
        component: './access/team-bindings',
      },
    ],
  },
  {
    path: '/settings-management',
    name: 'settings-management',
    icon: 'setting',
    routes: [
      {
        path: '/settings-management',
        redirect: '/settings-management/organization',
      },
      {
        name: 'organization-settings',
        icon: 'control',
        path: '/settings-management/organization',
        component: './settings-management/organization',
      },
      {
        name: 'team-settings',
        icon: 'sliders',
        path: '/settings-management/team',
        component: './settings-management/team',
      },
    ],
  },
  {
    path: '/property-rental',
    name: 'property-rental',
    icon: 'home',
    routes: [
      {
        path: '/property-rental',
        redirect: '/property-rental/houses',
      },
      {
        name: 'houses',
        icon: 'home',
        path: '/property-rental/houses',
        component: './property-rental/houses',
      },
      {
        name: 'house-new',
        icon: 'plusCircle',
        path: '/property-rental/houses/new',
        component: './property-rental/houses/new',
        hideInMenu: true,
      },
      {
        name: 'house-detail',
        icon: 'profile',
        path: '/property-rental/houses/:id',
        component: './property-rental/houses/detail',
        hideInMenu: true,
      },
      {
        name: 'estates',
        icon: 'apartment',
        path: '/property-rental/estates',
        component: './property-rental/estates',
      },
      {
        name: 'contacts',
        icon: 'contacts',
        path: '/property-rental/contacts',
        component: './property-rental/contacts',
      },
      {
        name: 'viewings',
        icon: 'calendar',
        path: '/property-rental/viewings',
        component: './property-rental/viewings',
      },
      {
        name: 'leases',
        icon: 'fileText',
        path: '/property-rental/leases',
        component: './property-rental/leases',
      },
    ],
  },
  {
    path: '/tenant-operations',
    name: 'tenant-operations',
    icon: 'notification',
    routes: [
      {
        path: '/tenant-operations',
        redirect: '/tenant-operations/notification-dispatches',
      },
      {
        name: 'notification-dispatches',
        icon: 'notification',
        path: '/tenant-operations/notification-dispatches',
        component: './platform-management/notification-dispatches',
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
        name: 'notifications',
        icon: 'bell',
        path: '/personal-business/notifications',
        component: './platform-management/notifications',
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
    redirect: '/property-rental/houses',
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
