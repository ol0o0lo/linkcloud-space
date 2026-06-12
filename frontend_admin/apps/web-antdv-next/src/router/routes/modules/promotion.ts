import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/promotion/index.vue'),
    meta: {
      icon: 'lucide:megaphone',
      order: 15,
      title: '推广奖励',
    },
    name: 'Promotion',
    path: '/promotion',
  },
];

export default routes;
