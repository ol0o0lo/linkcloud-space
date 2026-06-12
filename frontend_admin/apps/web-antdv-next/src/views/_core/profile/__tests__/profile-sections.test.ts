// @vitest-environment happy-dom

import { createApp, defineComponent, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  changePasswordApi,
  listNotificationPreferencesApi,
  parseAllauthErrors,
  updateNotificationPreferenceApi,
} = vi.hoisted(() => ({
  changePasswordApi: vi.fn(),
  listNotificationPreferencesApi: vi.fn(),
  parseAllauthErrors: vi.fn((payload: any) => payload),
  updateNotificationPreferenceApi: vi.fn(),
}));

vi.mock('#/api/django/auth', () => ({
  changePasswordApi,
  parseAllauthErrors,
}));

vi.mock('#/api/django/resources', () => ({
  listNotificationPreferencesApi,
  updateNotificationPreferenceApi,
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
  Card: defineComponent({
    name: 'Card',
    template: '<section><slot /></section>',
  }),
  Empty: defineComponent({
    name: 'Empty',
    props: { description: String },
    template: '<div>{{ description }}</div>',
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
  Spin: defineComponent({
    name: 'Spin',
    template: '<div><slot /></div>',
  }),
  Switch: defineComponent({
    name: 'Switch',
    props: {
      checked: Boolean,
      loading: Boolean,
    },
    emits: ['change'],
    template: '<input :checked="checked" type="checkbox" @change="$emit(\'change\', $event.target.checked)">',
  }),
  message: {
    success: vi.fn(),
  },
}));

import NotificationSetting from '../notification-setting.vue';
import PasswordSetting from '../password-setting.vue';

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

function mountSection(component: any, props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  const editEvents: boolean[] = [];
  let statusChangeCount = 0;

  const app = createApp(component, {
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

describe('独立的密码与通知页面组件', () => {
  beforeEach(() => {
    changePasswordApi.mockReset();
    listNotificationPreferencesApi.mockReset();
    parseAllauthErrors.mockClear();
    updateNotificationPreferenceApi.mockReset();

    changePasswordApi.mockResolvedValue(undefined);
    listNotificationPreferencesApi.mockResolvedValue([
      { description: '邀请提醒', email: true, in_app: true, key: 'invite', label: '邀请' },
      { description: '系统通知', email: false, in_app: true, key: 'system', label: '系统' },
    ]);
    updateNotificationPreferenceApi.mockImplementation(async (key: string, payload: Record<string, boolean>) => ({
      description: key === 'invite' ? '邀请提醒' : '系统通知',
      email: key === 'invite' ? (payload.email ?? true) : payload.email ?? false,
      in_app: key === 'invite' ? payload.in_app ?? true : payload.in_app ?? true,
      key,
      label: key === 'invite' ? '邀请' : '系统',
    }));
  });

  it('密码页默认先展示摘要，旧的锁定 props 不再阻止进入编辑态', async () => {
    const view = mountSection(PasswordSetting, { activeEditSection: 'notification' });

    await flushPromises();

    expect(view.container.textContent).toContain('密码状态');
    const editButton = findButton(view.container, '修改密码');
    expect(editButton).toBeTruthy();
    expect(editButton?.getAttribute('disabled')).toBeNull();

    editButton?.click();
    await flushPromises();

    expect(view.container.textContent).toContain('当前密码');
    expect(view.getEditEvents()).toEqual([true]);

    view.app.unmount();
  });

  it('修改密码成功后结束编辑并通知父层', async () => {
    const view = mountSection(PasswordSetting);

    await flushPromises();
    findButton(view.container, '修改密码')?.click();
    await nextTick();

    const inputs = [...view.container.querySelectorAll('input')];
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
    expect(view.getEditEvents()).toEqual([true, false]);
    expect(view.getStatusChangeCount()).toBe(1);

    view.app.unmount();
  });

  it('通知页默认停留在摘要态，旧的请求编辑 props 不再自动打开表单', async () => {
    const view = mountSection(NotificationSetting, {
      activeEditSection: 'notification',
      requestedEditKey: 1,
    });

    await flushPromises();

    expect(view.container.textContent).toContain('站内提醒');
    expect(view.container.textContent).toContain('邮件通知');
    expect(view.container.textContent).not.toContain('应用内提醒');
    expect(view.getEditEvents()).toEqual([]);

    view.app.unmount();
  });

  it('通知开关更新后刷新摘要并通知父层', async () => {
    const view = mountSection(NotificationSetting, { activeEditSection: 'password' });

    await flushPromises();

    const editButton = findButton(view.container, '编辑通知');
    expect(editButton).toBeTruthy();
    expect(editButton?.getAttribute('disabled')).toBeNull();

    editButton?.click();
    await nextTick();

    const switches = [...view.container.querySelectorAll('input[type="checkbox"]')];
    (switches[1] as HTMLInputElement).checked = false;
    switches[1]!.dispatchEvent(new Event('change'));
    await flushPromises();
    findButton(view.container, '完成')?.click();
    await flushPromises();

    expect(updateNotificationPreferenceApi).toHaveBeenCalledWith('invite', { email: false });
    expect(view.getEditEvents()).toEqual([true, false]);
    expect(view.getStatusChangeCount()).toBe(1);
    expect(view.container.textContent).toContain('已开启 0 / 2 类');

    view.app.unmount();
  });
});
