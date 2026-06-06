import type { RouteRecordStringComponent } from '@vben/types';

import { getAppContextApi } from './context';

export async function getAllMenusApi() {
  const context = await getAppContextApi();
  const user = context.user;
  const menus: RouteRecordStringComponent[] = [];

  if (!user) return menus;

  if (user.is_staff || user.is_superuser) {
    menus.push({
      component: 'BasicLayout',
      meta: {
        icon: 'lucide:layout-dashboard',
        order: -1,
        title: '总览',
      },
      name: 'Dashboard',
      path: '/dashboard',
      children: [
        {
          component: '/dashboard/overview/index',
          meta: {
            affixTab: true,
            icon: 'lucide:chart-no-axes-combined',
            title: '运营总览',
          },
          name: 'DashboardOverview',
          path: '/dashboard/overview',
        },
      ],
    });

    menus.push({
      component: 'BasicLayout',
      meta: {
        icon: 'lucide:settings-2',
        order: 10,
        title: '管理',
      },
      name: 'Admin',
      path: '/admin',
      children: [
        {
          component: '/admin/users',
          meta: { icon: 'lucide:users', title: '用户管理' },
          name: 'AdminUsers',
          path: '/admin/users',
        },
        {
          component: '/admin/organizations',
          meta: { icon: 'lucide:building-2', title: '租户管理' },
          name: 'AdminOrganizations',
          path: '/admin/organizations',
        },
        {
          component: '/admin/teams',
          meta: { icon: 'lucide:network', title: '团队管理' },
          name: 'AdminTeams',
          path: '/admin/teams',
        },
        {
          component: '/settings/admin',
          meta: { icon: 'lucide:sliders-horizontal', title: '系统设置' },
          name: 'AdminSettings',
          path: '/settings/admin',
        },
      ],
    });

    if (user.is_superuser) {
      menus[menus.length - 1]?.children?.splice(3, 0, {
        component: '/admin/real-name',
        meta: { icon: 'lucide:badge-check', title: '实名认证' },
        name: 'AdminRealName',
        path: '/admin/real-name-verifications',
      });
    }
  }

  menus.push({
    component: 'BasicLayout',
    meta: {
      icon: 'lucide:user-round',
      order: 20,
      title: '我的',
    },
    name: 'Personal',
    path: '/personal',
    children: [
      {
        component: '/_core/profile/index',
        meta: { icon: 'lucide:user', title: '个人中心' },
        name: 'Profile',
        path: '/profile',
      },
      {
        component: '/notifications/index',
        meta: { icon: 'lucide:bell', title: '通知中心' },
        name: 'Notifications',
        path: '/notifications',
      },
    ],
  });

  return menus;
}
