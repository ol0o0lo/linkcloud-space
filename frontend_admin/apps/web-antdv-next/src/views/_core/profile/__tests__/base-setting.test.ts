// @vitest-environment happy-dom

import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  changeAccountPhoneApi,
  deleteCurrentUserAvatarApi,
  fetchUserInfo,
  getCurrentUserApi,
  messageSuccess,
  parseAllauthErrors,
  reauthenticateApi,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
  verifyPhoneApi,
} = vi.hoisted(() => ({
  changeAccountPhoneApi: vi.fn(),
  deleteCurrentUserAvatarApi: vi.fn(),
  fetchUserInfo: vi.fn(),
  getCurrentUserApi: vi.fn(),
  messageSuccess: vi.fn(),
  parseAllauthErrors: vi.fn((payload: any) => payload),
  reauthenticateApi: vi.fn(),
  updateCurrentUserApi: vi.fn(),
  uploadCurrentUserAvatarApi: vi.fn(),
  verifyPhoneApi: vi.fn(),
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

vi.mock('#/api/django/auth', () => ({
  changeAccountPhoneApi,
  parseAllauthErrors,
  reauthenticateApi,
  verifyPhoneApi,
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'Alert',
    props: { message: String },
    template: '<div>{{ message }}</div>',
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
  InputPassword: defineComponent({
    name: 'InputPassword',
    props: {
      placeholder: String,
      value: {
        default: '',
        type: String,
      },
    },
    emits: ['update:value'],
    template: '<input :placeholder="placeholder" :value="value" type="password" @input="$emit(\'update:value\', $event.target.value)">',
  }),
  Modal: defineComponent({
    name: 'Modal',
    props: { open: Boolean },
    emits: ['cancel', 'ok', 'update:open'],
    template: '<div v-if="open"><slot /><button data-role="modal-ok" @click="$emit(\'ok\')">OK</button><button data-role="modal-cancel" @click="$emit(\'cancel\')">Cancel</button></div>',
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
    changeAccountPhoneApi.mockReset();
    fetchUserInfo.mockReset();
    deleteCurrentUserAvatarApi.mockReset();
    getCurrentUserApi.mockReset();
    parseAllauthErrors.mockClear();
    reauthenticateApi.mockReset();
    updateCurrentUserApi.mockReset();
    uploadCurrentUserAvatarApi.mockReset();
    verifyPhoneApi.mockReset();
    messageSuccess.mockReset();
    getCurrentUserApi.mockResolvedValue(buildUser());
    changeAccountPhoneApi.mockResolvedValue({ data: [{ phone: '+8613800000001', verified: false }] });
    updateCurrentUserApi.mockResolvedValue(buildUser());
    deleteCurrentUserAvatarApi.mockResolvedValue(undefined);
    fetchUserInfo.mockResolvedValue(undefined);
    reauthenticateApi.mockResolvedValue(undefined);
    verifyPhoneApi.mockResolvedValue(undefined);
  });

  it('默认保持查看态，旧 props 不再禁用或自动打开资料编辑', async () => {
    const view = mountBaseSetting({
      activeEditSection: 'security',
      requestedEditKey: 1,
    });

    await flushPromises();

    expect(view.container.textContent).toContain('基本信息');
    expect(view.container.textContent).toContain('姓名');
    const editButton = findButton(view.container, '编辑资料');
    expect(editButton).toBeTruthy();
    expect(editButton?.getAttribute('disabled')).toBeNull();
    expect(view.container.textContent).not.toContain('保存资料');
    expect(view.getEditEvents()).toEqual([]);

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

  it('更换手机号时完成验证码发送和确认闭环', async () => {
    getCurrentUserApi
      .mockResolvedValueOnce(buildUser())
      .mockResolvedValueOnce({
        ...buildUser(),
        phone: '+8613800000001',
        phone_verified: true,
      });

    const view = mountBaseSetting();

    await flushPromises();
    findButton(view.container, '更换手机号')?.click();
    await nextTick();

    const phoneInput = view.container.querySelector('input[placeholder="例如：+8613800000000"]') as HTMLInputElement | null;
    phoneInput!.value = '+8613800000001';
    phoneInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '发送验证码')?.click();
    await flushPromises();

    const codeInput = view.container.querySelector('input[placeholder="请输入短信验证码"]') as HTMLInputElement | null;
    codeInput!.value = '123456';
    codeInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '确认更换')?.click();
    await flushPromises();

    expect(changeAccountPhoneApi).toHaveBeenCalledWith('+8613800000001');
    expect(verifyPhoneApi).toHaveBeenCalledWith('123456');
    expect(view.getUpdatedCount()).toBe(1);

    view.app.unmount();
  });

  it('更换手机号在重新验密后仍能继续完成改绑', async () => {
    changeAccountPhoneApi
      .mockRejectedValueOnce({
        data: {
          data: {
            flows: [{ id: 'reauthenticate' }],
          },
        },
        response: {
          status: 401,
        },
      })
      .mockResolvedValueOnce({ data: [{ phone: '+8613800000002', verified: false }] });

    getCurrentUserApi
      .mockResolvedValueOnce(buildUser())
      .mockResolvedValueOnce({
        ...buildUser(),
        phone: '+8613800000002',
        phone_verified: true,
      });

    const view = mountBaseSetting();

    await flushPromises();
    findButton(view.container, '更换手机号')?.click();
    await nextTick();

    const phoneInput = view.container.querySelector('input[placeholder="例如：+8613800000000"]') as HTMLInputElement | null;
    phoneInput!.value = '+8613800000002';
    phoneInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '发送验证码')?.click();
    await flushPromises();

    const reauthInput = view.container.querySelector('input[placeholder="请输入当前密码"]') as HTMLInputElement | null;
    reauthInput!.value = 'reauth-password';
    reauthInput!.dispatchEvent(new Event('input'));

    (view.container.querySelector('[data-role="modal-ok"]') as HTMLButtonElement | null)?.click();
    await flushPromises();

    const codeInput = view.container.querySelector('input[placeholder="请输入短信验证码"]') as HTMLInputElement | null;
    codeInput!.value = '654321';
    codeInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '确认更换')?.click();
    await flushPromises();

    expect(reauthenticateApi).toHaveBeenCalledWith('reauth-password');
    expect(changeAccountPhoneApi).toHaveBeenCalledTimes(2);
    expect(verifyPhoneApi).toHaveBeenCalledWith('654321');
    expect(view.getUpdatedCount()).toBe(1);

    view.app.unmount();
  });
});
