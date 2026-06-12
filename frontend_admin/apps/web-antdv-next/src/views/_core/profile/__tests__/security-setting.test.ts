// @vitest-environment happy-dom

import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  activateTotpApi,
  addPasskeyApi,
  beginAddPasskeyApi,
  deactivateTotpApi,
  disconnectSocialApi,
  getSocialAccountsApi,
  getTotpStatusApi,
  isWebAuthnSupported,
  listAuthenticatorsApi,
  listRecoveryCodesApi,
  modalConfirm,
  parseAllauthErrors,
  reauthenticateApi,
  redirectProviderConnect,
  regenerateRecoveryCodesApi,
  removePasskeyApi,
  renamePasskeyApi,
  messageError,
  messageSuccess,
} = vi.hoisted(() => ({
  activateTotpApi: vi.fn(),
  addPasskeyApi: vi.fn(),
  beginAddPasskeyApi: vi.fn(),
  deactivateTotpApi: vi.fn(),
  disconnectSocialApi: vi.fn(),
  getSocialAccountsApi: vi.fn(),
  getTotpStatusApi: vi.fn(),
  isWebAuthnSupported: vi.fn(),
  listAuthenticatorsApi: vi.fn(),
  listRecoveryCodesApi: vi.fn(),
  modalConfirm: vi.fn(async ({ onOk }: { onOk?: () => Promise<void> | void }) => {
    await onOk?.();
  }),
  parseAllauthErrors: vi.fn((payload: any) => payload),
  reauthenticateApi: vi.fn(),
  redirectProviderConnect: vi.fn(),
  regenerateRecoveryCodesApi: vi.fn(),
  removePasskeyApi: vi.fn(),
  renamePasskeyApi: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock('#/api/django/auth', () => ({
  activateTotpApi,
  addPasskeyApi,
  beginAddPasskeyApi,
  changePasswordApi: vi.fn(),
  deactivateTotpApi,
  disconnectSocialApi,
  getSocialAccountsApi,
  getTotpStatusApi,
  listAuthenticatorsApi,
  listRecoveryCodesApi,
  parseAllauthErrors,
  reauthenticateApi,
  redirectProviderConnect,
  regenerateRecoveryCodesApi,
  removePasskeyApi,
  renamePasskeyApi,
}));

vi.mock('#/api/django/webauthn', () => ({
  createPasskeyCredential: vi.fn(),
  isWebAuthnSupported,
}));

vi.mock('antdv-next', () => {
  const Modal = defineComponent({
    name: 'Modal',
    props: {
      open: Boolean,
    },
    emits: ['cancel', 'ok', 'update:open'],
    template: '<div v-if="open"><slot /><button data-role="modal-ok" @click="$emit(\'ok\')">OK</button><button data-role="modal-cancel" @click="$emit(\'cancel\')">Cancel</button></div>',
  });

  return {
    Alert: defineComponent({
      name: 'Alert',
      props: { message: String },
      template: '<div>{{ message }}</div>',
    }),
    Button: defineComponent({
      name: 'Button',
      props: {
        danger: Boolean,
        disabled: Boolean,
        ghost: Boolean,
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
    Empty: defineComponent({
      name: 'Empty',
      props: { description: String },
      template: '<div>{{ description }}</div>',
    }),
    Input: defineComponent({
      name: 'Input',
      props: {
        placeholder: String,
        value: {
          default: '',
          type: String,
        },
      },
      emits: ['update:value'],
      template: '<input :placeholder="placeholder" :value="value" @input="$emit(\'update:value\', $event.target.value)">',
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
    Modal: Object.assign(Modal, { confirm: modalConfirm }),
    Space: defineComponent({
      name: 'Space',
      template: '<div><slot /></div>',
    }),
    Spin: defineComponent({
      name: 'Spin',
      template: '<div><slot /></div>',
    }),
    Switch: defineComponent({
      name: 'Switch',
      props: {
        checked: Boolean,
      },
      emits: ['change', 'update:checked'],
      template: '<input :checked="checked" type="checkbox" @change="$emit(\'change\', $event.target.checked); $emit(\'update:checked\', $event.target.checked)">',
    }),
    Tag: defineComponent({
      name: 'Tag',
      template: '<span><slot /></span>',
    }),
    message: {
      error: messageError,
      success: messageSuccess,
    },
  };
});

import SecuritySetting from '../security-setting.vue';

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

function mountSecuritySetting(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const editEvents: boolean[] = [];
  let statusChangeCount = 0;

  const app = createApp(SecuritySetting, {
    ...props,
    onEditChange: (editing: boolean) => {
      editEvents.push(editing);
    },
    onStatusChange: () => {
      statusChangeCount += 1;
    },
  });

  app.mount(container);

  return {
    app,
    container,
    getEditEvents: () => [...editEvents],
    getStatusChangeCount: () => statusChangeCount,
  };
}

describe('独立的安全设置组件', () => {
  beforeEach(() => {
    activateTotpApi.mockReset();
    addPasskeyApi.mockReset();
    beginAddPasskeyApi.mockReset();
    deactivateTotpApi.mockReset();
    disconnectSocialApi.mockReset();
    getSocialAccountsApi.mockReset();
    getTotpStatusApi.mockReset();
    isWebAuthnSupported.mockReset();
    listAuthenticatorsApi.mockReset();
    listRecoveryCodesApi.mockReset();
    modalConfirm.mockClear();
    parseAllauthErrors.mockClear();
    reauthenticateApi.mockReset();
    redirectProviderConnect.mockReset();
    regenerateRecoveryCodesApi.mockReset();
    removePasskeyApi.mockReset();
    renamePasskeyApi.mockReset();
    messageError.mockReset();
    messageSuccess.mockReset();

    activateTotpApi.mockResolvedValue(undefined);
    deactivateTotpApi.mockResolvedValue(undefined);
    disconnectSocialApi.mockResolvedValue(undefined);
    getSocialAccountsApi.mockResolvedValue({
      data: [{ display: 'lan', provider: { id: 'github', name: 'GitHub' }, uid: 'github-1' }],
    });
    getTotpStatusApi.mockResolvedValue({ data: { secret: 'SECRET', totp_url: 'otpauth://totp/demo' } });
    isWebAuthnSupported.mockReturnValue(true);
    listAuthenticatorsApi.mockImplementation(async () => ({
      data: [
        { total_code_count: 8, type: 'recovery_codes', unused_code_count: 8 },
        { id: 2, name: 'MacBook', type: 'webauthn' },
      ],
    }));
    listRecoveryCodesApi.mockResolvedValue({ data: { codes: ['code-1'], total_code_count: 1, unused_codes: ['code-1'] } });
    reauthenticateApi.mockResolvedValue(undefined);
    regenerateRecoveryCodesApi.mockResolvedValue(undefined);
    removePasskeyApi.mockResolvedValue(undefined);
    renamePasskeyApi.mockResolvedValue(undefined);
  });

  it('默认展示安全概览，旧的工作台 props 不再切成密码专用模式', async () => {
    const view = mountSecuritySetting({
      activeEditSection: 'basic',
      displayMode: 'password',
      requestedEditKey: 1,
      requestedIntent: 'password',
      requestedIntentKey: 1,
    });

    await flushPromises();

    expect(view.container.textContent).toContain('账户安全');
    expect(view.container.textContent).toContain('两步验证与设备');
    expect(view.container.textContent).toContain('第三方账号');
    expect(view.container.textContent).not.toContain('当前密码');
    expect(findButton(view.container, '管理安全方式')).toBeTruthy();
    expect(view.getEditEvents()).toEqual([]);

    view.app.unmount();
  });

  it('点击管理安全方式后才展开详细操作区', async () => {
    const view = mountSecuritySetting();

    await flushPromises();

    expect(view.container.textContent).not.toContain('验证器与恢复码');

    findButton(view.container, '管理安全方式')?.click();
    await flushPromises();

    expect(view.container.textContent).toContain('验证器与恢复码');
    expect(view.container.textContent).toContain('Passkey');
    expect(view.container.textContent).toContain('第三方账号绑定');
    expect(view.getEditEvents()).toEqual([true]);

    view.app.unmount();
  });

  it('启用验证器成功后会刷新状态并通知父层', async () => {
    const view = mountSecuritySetting();

    await flushPromises();
    findButton(view.container, '管理安全方式')?.click();
    await flushPromises();

    const codeInput = [...view.container.querySelectorAll('input')].find((input) => input.getAttribute('placeholder') === '请输入 6 位验证码');
    expect(codeInput).toBeTruthy();
    codeInput!.value = '123456';
    codeInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '启用验证器')?.click();
    await flushPromises();

    expect(activateTotpApi).toHaveBeenCalledWith('123456');
    expect(messageSuccess).toHaveBeenCalledWith('验证器已启用');
    expect(view.getStatusChangeCount()).toBe(1);

    view.app.unmount();
  });
});
