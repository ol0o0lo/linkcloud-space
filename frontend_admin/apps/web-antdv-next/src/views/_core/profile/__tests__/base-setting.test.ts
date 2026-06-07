import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  deleteCurrentUserAvatarApi,
  fetchUserInfo,
  getCurrentUserApi,
  messageSuccess,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
} = vi.hoisted(() => ({
  deleteCurrentUserAvatarApi: vi.fn(),
  fetchUserInfo: vi.fn(),
  getCurrentUserApi: vi.fn(),
  messageSuccess: vi.fn(),
  updateCurrentUserApi: vi.fn(),
  uploadCurrentUserAvatarApi: vi.fn(),
}));

vi.mock('#/store', () => ({
  useAuthStore: () => ({
    fetchUserInfo,
  }),
}));

vi.mock('#/api/django/resources', () => ({
  deleteCurrentUserAvatarApi,
  getCurrentUserApi,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
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
      loading: Boolean,
      type: String,
    },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
  Card: defineComponent({
    name: 'Card',
    template: '<section><slot /></section>',
  }),
  Input: defineComponent({
    name: 'Input',
    props: {
      disabled: Boolean,
      placeholder: String,
      value: {
        default: '',
        type: String,
      },
    },
    emits: ['update:value'],
    template: '<input :disabled="disabled" :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)">',
  }),
  Select: defineComponent({
    name: 'Select',
    props: {
      options: {
        default: () => [],
        type: Array,
      },
      value: {
        default: '',
        type: String,
      },
    },
    emits: ['update:value'],
    template: '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="item in options" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
  }),
  Spin: defineComponent({
    name: 'Spin',
    template: '<div><slot /></div>',
  }),
  Tag: defineComponent({
    name: 'Tag',
    template: '<span><slot /></span>',
  }),
  message: {
    success: messageSuccess,
  },
}));

import BaseSetting from '../base-setting.vue';

function buildUser() {
  return {
    avatar_url: 'https://example.com/avatar.png',
    email: 'lan@example.com',
    first_name: 'Lan',
    id: 1,
    last_name: 'Kong',
    phone: '13800000000',
    phone_verified: true,
    timezone: 'Asia/Shanghai',
    username: 'lan',
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

function findButton(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
}

function mountBaseSetting(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const editEvents: boolean[] = [];
  let updatedCount = 0;

  const app = createApp(BaseSetting, {
    ...props,
    onEditChange: (editing: boolean) => {
      editEvents.push(editing);
    },
    onProfileUpdated: () => {
      updatedCount += 1;
    },
  });

  app.mount(container);

  return {
    app,
    container,
    getEditEvents: () => [...editEvents],
    getUpdatedCount: () => updatedCount,
  };
}

describe('base-setting.vue', () => {
  beforeEach(() => {
    fetchUserInfo.mockReset();
    deleteCurrentUserAvatarApi.mockReset();
    getCurrentUserApi.mockReset();
    updateCurrentUserApi.mockReset();
    uploadCurrentUserAvatarApi.mockReset();
    messageSuccess.mockReset();
    getCurrentUserApi.mockResolvedValue(buildUser());
    updateCurrentUserApi.mockResolvedValue(buildUser());
    deleteCurrentUserAvatarApi.mockResolvedValue(undefined);
    fetchUserInfo.mockResolvedValue(undefined);
  });

  it('在其他模块编辑时禁用资料编辑入口', async () => {
    const view = mountBaseSetting({
      activeEditSection: 'security',
    });

    await flushPromises();

    const editButton = findButton(view.container, '编辑资料');
    expect(editButton).toBeTruthy();
    expect(editButton?.getAttribute('disabled')).not.toBeNull();

    view.app.unmount();
  });

  it('保存资料后通知父层刷新并结束编辑', async () => {
    const view = mountBaseSetting();

    await flushPromises();
    findButton(view.container, '编辑资料')?.click();
    await nextTick();

    const firstNameInput = view.container.querySelector('input[placeholder="请输入姓氏"]') as HTMLInputElement | null;
    firstNameInput!.value = 'Lin';
    firstNameInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '保存资料')?.click();
    await flushPromises();

    expect(updateCurrentUserApi).toHaveBeenCalledWith(1, {
      first_name: 'Lin',
      last_name: 'Kong',
      timezone: 'Asia/Shanghai',
    });
    expect(view.getEditEvents()).toEqual([true, false]);
    expect(view.getUpdatedCount()).toBe(1);

    view.app.unmount();
  });

  it('移除头像后通知父层刷新', async () => {
    const view = mountBaseSetting();

    await flushPromises();
    findButton(view.container, '移除头像')?.click();
    await flushPromises();

    expect(deleteCurrentUserAvatarApi).toHaveBeenCalledTimes(1);
    expect(view.getUpdatedCount()).toBe(1);

    view.app.unmount();
  });
});
