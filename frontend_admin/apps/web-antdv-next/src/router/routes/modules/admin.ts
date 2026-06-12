import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['admin', 'super'],
      icon: 'lucide:shield-check',
      order: 10,
      title: '管理',
    },
    name: 'Admin',
    path: '/admin',
    children: [
      {
        component: () => import('#/views/admin/users.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:users',
          title: '用户管理',
        },
        name: 'AdminUsers',
        path: '/admin/users',
      },
      {
        component: () => import('#/views/admin/organizations.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:building-2',
          title: '租户管理',
        },
        name: 'AdminOrganizations',
        path: '/admin/organizations',
      },
      {
        component: () => import('#/views/admin/teams.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:network',
          title: '团队管理',
        },
        name: 'AdminTeams',
        path: '/admin/teams',
      },
      {
        component: () => import('#/views/admin/real-name.vue'),
        meta: {
          authority: ['super'],
          icon: 'lucide:badge-check',
          title: '实名认证',
        },
        name: 'AdminRealName',
        path: '/admin/real-name-verifications',
      },
      {
        component: () => import('#/views/admin/access.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:key-round',
          title: '访问控制',
        },
        name: 'AdminAccess',
        path: '/admin/access',
      },
      {
        component: () => import('#/views/admin/referrals.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:gift',
          title: '推广管理',
        },
        name: 'AdminReferrals',
        path: '/admin/referrals',
      },
      {
        component: () => import('#/views/admin/wallet-accounts.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:wallet',
          title: '钱包账户',
        },
        name: 'AdminWalletAccounts',
        path: '/admin/wallet/accounts',
      },
      {
        component: () => import('#/views/admin/wallet-withdrawals.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:arrow-right-left',
          title: '提现审核',
        },
        name: 'AdminWalletWithdrawals',
        path: '/admin/wallet/withdrawals',
      },
      {
        component: () => import('#/views/settings/admin.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:settings',
          title: '系统设置',
        },
        name: 'AdminSettings',
        path: '/admin/settings',
      },
    ],
  },
];

export default routes;
