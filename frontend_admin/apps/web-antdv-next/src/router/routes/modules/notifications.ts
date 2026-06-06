import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/notifications/index.vue'),
    meta: {
      icon: 'lucide:bell',
      order: 20,
      title: '通知中心',
    },
    name: 'Notifications',
    path: '/notifications',
  },
];

export default routes;
