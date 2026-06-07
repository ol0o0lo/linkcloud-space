import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  activateTotpApi,
  addPasskeyApi,
  beginAddPasskeyApi,
  changePasswordApi,
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
} = vi.hoisted(() => ({
  activateTotpApi: vi.fn(),
  addPasskeyApi: vi.fn(),
  beginAddPasskeyApi: vi.fn(),
  changePasswordApi: vi.fn(),
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
}));

vi.mock('#/api/django/auth', () => ({
  activateTotpApi,
  addPasskeyApi,
  beginAddPasskeyApi,
  changePasswordApi,
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
    template: '<div v-if="open"><slot /></div>',
  });

  return {
    Alert: defineComponent({
      name: 'Alert',
      props: {
        message: String,
      },
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
    Card: defineComponent({
      name: 'Card',
      template: '<section><slot /></section>',
    }),
    Empty: defineComponent({
      name: 'Empty',
      props: {
        description: String,
      },
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
      emits: ['update:checked'],
      template: '<input :checked="checked" type="checkbox" @change="$emit(\'update:checked\', $event.target.checked)">',
    }),
    Tag: defineComponent({
      name: 'Tag',
      template: '<span><slot /></span>',
    }),
    message: {
      success: vi.fn(),
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

describe('security-setting.vue', () => {
  beforeEach(() => {
    activateTotpApi.mockReset();
    addPasskeyApi.mockReset();
    beginAddPasskeyApi.mockReset();
    changePasswordApi.mockReset();
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

    activateTotpApi.mockResolvedValue(undefined);
    changePasswordApi.mockResolvedValue(undefined);
    disconnectSocialApi.mockResolvedValue(undefined);
    getSocialAccountsApi.mockResolvedValue({
      data: [{ display: 'lan', provider: { id: 'github', name: 'GitHub' }, uid: 'github-1' }],
    });
    getTotpStatusApi.mockResolvedValue({ data: { secret: 'SECRET', totp_url: 'otpauth://totp/demo' } });
    isWebAuthnSupported.mockReturnValue(true);
    listAuthenticatorsApi.mockResolvedValue({ data: [{ total_code_count: 8, type: 'recovery_codes', unused_code_count: 8 }, { id: 2, name: 'MacBook', type: 'webauthn' }] });
    listRecoveryCodesApi.mockResolvedValue({ data: { codes: ['code-1'], total_code_count: 1, unused_codes: ['code-1'] } });
    reauthenticateApi.mockResolvedValue(undefined);
    regenerateRecoveryCodesApi.mockResolvedValue(undefined);
    removePasskeyApi.mockResolvedValue(undefined);
    renamePasskeyApi.mockResolvedValue(undefined);
  });

  it('在其他模块编辑时禁用安全管理入口并展示摘要', async () => {
    const view = mountSecuritySetting({ activeEditSection: 'basic' });

    await flushPromises();

    const manageButton = findButton(view.container, '管理安全方式');
    expect(manageButton).toBeTruthy();
    expect(manageButton?.getAttribute('disabled')).not.toBeNull();
    expect(view.container.textContent).toContain('已添加 1 个');
    expect(view.container.textContent).toContain('已绑定 1 个');

    view.app.unmount();
  });

  it('展开详情并启用验证器后通知父层刷新', async () => {
    listAuthenticatorsApi
      .mockResolvedValueOnce({ data: [{ total_code_count: 8, type: 'recovery_codes', unused_code_count: 8 }, { id: 2, name: 'MacBook', type: 'webauthn' }] })
      .mockResolvedValueOnce({
        data: [
          { total_code_count: 8, type: 'recovery_codes', unused_code_count: 8 },
          { id: 1, type: 'totp' },
          { id: 2, name: 'MacBook', type: 'webauthn' },
        ],
      });

    const view = mountSecuritySetting();

    await flushPromises();
    findButton(view.container, '管理安全方式')?.click();
    await nextTick();

    const codeInput = view.container.querySelector('input[placeholder="请输入 6 位验证码"]') as HTMLInputElement | null;
    codeInput!.value = '123456';
    codeInput!.dispatchEvent(new Event('input'));

    findButton(view.container, '启用验证器')?.click();
    await flushPromises();

    expect(view.getEditEvents()).toEqual([true]);
    expect(activateTotpApi).toHaveBeenCalledWith('123456');
    expect(view.container.textContent).toContain('已开启');

    view.app.unmount();
  });

  it('解绑 GitHub 后通知父层刷新', async () => {
    getSocialAccountsApi
      .mockResolvedValueOnce({ data: [{ display: 'lan', provider: { id: 'github', name: 'GitHub' }, uid: 'github-1' }] })
      .mockResolvedValueOnce({ data: [] });

    const view = mountSecuritySetting();

    await flushPromises();
    findButton(view.container, '管理安全方式')?.click();
    await nextTick();
    findButton(view.container, '解除绑定')?.click();
    await flushPromises();

    expect(disconnectSocialApi).toHaveBeenCalledWith('github', 'github-1');
    expect(view.container.textContent).toContain('已绑定 0 个');

    view.app.unmount();
  });

  it('在安全区内展示并更新登录密码', async () => {
    const view = mountSecuritySetting();

    await flushPromises();
    expect(view.container.textContent).toContain('登录密码');
    expect(view.container.textContent).toContain('可按需更新');

    findButton(view.container, '管理安全方式')?.click();
    await nextTick();
    findButton(view.container, '修改密码')?.click();
    await nextTick();

    const inputs = [...view.container.querySelectorAll('input[type="password"]')] as HTMLInputElement[];
    inputs[0]!.value = 'old-password';
    inputs[0]!.dispatchEvent(new Event('input'));
    inputs[1]!.value = 'new-password';
    inputs[1]!.dispatchEvent(new Event('input'));
    inputs[2]!.value = 'new-password';
    inputs[2]!.dispatchEvent(new Event('input'));

    findButton(view.container, '更新密码')?.click();
    await flushPromises();

    expect(changePasswordApi).toHaveBeenCalledWith({
      current_password: 'old-password',
      new_password: 'new-password',
    });

    view.app.unmount();
  });
});
