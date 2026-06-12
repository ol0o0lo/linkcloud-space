import { createApp, defineComponent, h, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { finalizeAuthenticatedSessionMock, pushMock, resendLoginCodeApiMock, routeState, verifyPhoneApiMock } = vi.hoisted(() => ({
  finalizeAuthenticatedSessionMock: vi.fn(),
  pushMock: vi.fn(),
  resendLoginCodeApiMock: vi.fn(),
  routeState: {
    query: {} as Record<string, string>,
  },
  verifyPhoneApiMock: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({
      push: pushMock,
    }),
  };
});

vi.mock('@vben/common-ui', () => ({
  AuthenticationCodeLogin: defineComponent({
    name: 'AuthenticationCodeLogin',
    emits: ['submit'],
    setup(_props, { emit, slots }) {
      return () =>
        h('div', [
          h('div', slots.subTitle ? slots.subTitle() : []),
          h(
            'button',
            {
              onClick: () => emit('submit', { code: '1234' }),
            },
            'verify',
          ),
        ]);
    },
  }),
  z: {
    string: () => ({ length: () => ({}) }),
  },
}));

vi.mock('@vben/locales', async () => {
  const actual = await vi.importActual<typeof import('@vben/locales')>('@vben/locales');
  return {
    ...actual,
    $t: (key: string) => key,
  };
});

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  }),
  notification: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('#/api/django/auth', () => ({
  resendLoginCodeApi: resendLoginCodeApiMock,
  verifyPhoneApi: verifyPhoneApiMock,
}));

vi.mock('#/store', () => ({
  useAuthStore: () => ({
    finalizeAuthenticatedSession: finalizeAuthenticatedSessionMock,
  }),
}));

import VerifyPhoneView from '../verify-phone.vue';

async function mountComponent() {
  const container = document.createElement('div');
  createApp(VerifyPhoneView).mount(container);
  await nextTick();
  return container;
}

describe('verify phone view', () => {
  beforeEach(() => {
    routeState.query = {};
    pushMock.mockReset();
    resendLoginCodeApiMock.mockReset();
    verifyPhoneApiMock.mockReset();
    finalizeAuthenticatedSessionMock.mockReset();
  });

  it('验证成功后进入 redirect 页面', async () => {
    routeState.query = { redirect: '/promotion', phone: '+8613800138000' };
    verifyPhoneApiMock.mockResolvedValue(undefined);
    finalizeAuthenticatedSessionMock.mockImplementation(async (callback?: () => Promise<void> | void) => {
      await callback?.();
    });

    const container = await mountComponent();
    container.querySelector('button')?.dispatchEvent(new Event('click'));
    await nextTick();

    expect(verifyPhoneApiMock).toHaveBeenCalledWith('1234');
    expect(pushMock).toHaveBeenCalledWith('/promotion');
  });

  it('展示当前手机号提示', async () => {
    routeState.query = { phone: '+8613800138000' };

    const container = await mountComponent();
    expect(container.textContent).toContain('+8613800138000');
  });

  it('点击重发时调用 resend 接口', async () => {
    routeState.query = { phone: '+8613800138000' };
    resendLoginCodeApiMock.mockResolvedValue(undefined);

    const container = await mountComponent();
    const buttons = [...container.querySelectorAll('button')];
    buttons[1]?.dispatchEvent(new Event('click'));
    await nextTick();

    expect(resendLoginCodeApiMock).toHaveBeenCalledTimes(1);
  });
});
