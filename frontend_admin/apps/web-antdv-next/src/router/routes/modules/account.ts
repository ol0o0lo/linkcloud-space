import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/_core/profile/social-callback.vue'),
    meta: {
      hideInBreadcrumb: true,
      hideInMenu: true,
      hideInTab: true,
      ignoreAccess: true,
      title: 'Social Callback',
    },
    name: 'AccountSocialCallback',
    path: '/account/social/callback',
  },
];

export default routes;
