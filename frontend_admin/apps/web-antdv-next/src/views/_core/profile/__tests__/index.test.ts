// @vitest-environment happy-dom

import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();

const route = {
  query: {},
};

const {
  getCurrentUserApi,
  getUnreadCountApi,
  listNotificationsApi,
  listAuthenticatorsApi,
} = vi.hoisted(() => ({
  getCurrentUserApi: vi.fn(),
  getUnreadCountApi: vi.fn(),
  listAuthenticatorsApi: vi.fn(),
  listNotificationsApi: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push, replace }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'Page',
    template: '<div><slot /></div>',
  }),
}));

vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    name: 'IconifyIcon',
    props: {
      icon: String,
    },
    template: '<span>{{ icon }}</span>',
  }),
}));

vi.mock('antdv-next', () => ({
  Avatar: defineComponent({
    name: 'Avatar',
    template: '<div><slot /></div>',
  }),
  Button: defineComponent({
    name: 'Button',
    props: {
      disabled: Boolean,
      ghost: Boolean,
      type: String,
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
  Modal: defineComponent({
    name: 'Modal',
    props: {
      open: Boolean,
    },
    template: '<div v-if="open"><slot /></div>',
  }),
  Spin: defineComponent({
    name: 'Spin',
    template: '<div><slot /></div>',
  }),
}));

vi.mock('#/api/django/auth', () => ({
  listAuthenticatorsApi,
}));

vi.mock('#/api/django/resources', () => ({
  getCurrentUserApi,
  getUnreadCountApi,
  listNotificationsApi,
}));

vi.mock('../base-setting.vue', () => ({
  default: defineComponent({
    name: 'ProfileBase',
    template: '<div>基础资料内容</div>',
  }),
}));

vi.mock('../overview.vue', () => ({
  default: defineComponent({
    name: 'ProfileOverview',
    emits: ['openSection'],
    template: `
      <section>
        <div>账户总览</div>
        <button @click="$emit('openSection', 'security')">账户安全入口</button>
        <button @click="$emit('openSection', 'password')">修改密码入口</button>
        <button @click="$emit('openSection', 'notifications')">通知设置入口</button>
      </section>
    `,
  }),
}));

import ProfileIndex from '../index.vue';

async function flushPromises() {
  for (const _ of [0, 1, 2, 3]) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}

describe('profile index page', () => {
  beforeEach(() => {
    route.query = {};
    push.mockReset();
    replace.mockReset();
    getCurrentUserApi.mockResolvedValue({
      avatar_url: null,
      email: 'lan@example.com',
      first_name: 'Lan',
      id: 1,
      is_staff: false,
      is_superuser: false,
      last_name: '',
      phone: '13800000000',
      phone_verified: true,
      real_name_status: 'verified',
      timezone: 'Asia/Shanghai',
      username: 'lan',
    });
    getUnreadCountApi.mockResolvedValue({ count: 2 });
    listAuthenticatorsApi.mockResolvedValue({ data: [{ id: 1, type: 'totp' }] });
    listNotificationsApi.mockResolvedValue([]);
  });

  it('按长页顺序渲染总览、基础资料和独立入口', async () => {
    const container = document.createElement('div');

    createApp(ProfileIndex).mount(container);
    await flushPromises();

    expect(container.textContent).toContain('账户总览');
    expect(container.textContent).toContain('基础资料内容');
    expect(container.textContent).toContain('账户安全入口');
    expect(container.textContent).toContain('修改密码入口');
    expect(container.textContent).toContain('通知设置入口');
    expect(findButton(container, '基础资料')).toBeUndefined();
  });

  it('旧的安全 tab query 进入时会跳转到独立安全页', async () => {
    route.query = { tab: 'security' };
    const container = document.createElement('div');

    createApp(ProfileIndex).mount(container);
    await flushPromises();

    expect(replace).toHaveBeenCalledWith({ path: '/profile/security', replace: true });
  });

  it('点击账户入口会跳转到对应的独立页面', async () => {
    const container = document.createElement('div');

    createApp(ProfileIndex).mount(container);
    await flushPromises();

    findButton(container, '账户安全入口')?.click();
    await nextTick();
    expect(push).toHaveBeenCalledWith('/profile/security');

    findButton(container, '修改密码入口')?.click();
    await nextTick();
    expect(push).toHaveBeenCalledWith('/profile/password');

    findButton(container, '通知设置入口')?.click();
    await nextTick();
    expect(push).toHaveBeenCalledWith('/profile/notifications');
  });
});
