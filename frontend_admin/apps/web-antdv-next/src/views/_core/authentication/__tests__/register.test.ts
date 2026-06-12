import { createApp, defineComponent, h, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pushMock, routeState, signupApiMock, finalizeAuthenticatedSessionMock, authLoginMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  routeState: {
    query: {} as Record<string, string>,
  },
  signupApiMock: vi.fn(),
  finalizeAuthenticatedSessionMock: vi.fn(),
  authLoginMock: vi.fn(),
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
  AuthenticationLogin: defineComponent({
    name: 'AuthenticationLogin',
    props: {
      showRegister: Boolean,
    },
    setup(props) {
      return () => h('div', props.showRegister ? '注册' : '');
    },
  }),
  AuthenticationRegister: defineComponent({
    name: 'AuthenticationRegister',
    emits: ['submit'],
    setup(_props, { emit, slots }) {
      return () =>
        h('div', [
          h('div', slots.title ? slots.title() : []),
          h('div', slots.subTitle ? slots.subTitle() : []),
          h(
            'button',
            {
              onClick: () =>
                emit('submit', {
                  email: 'demo@example.com',
                  phone: '+8613800138000',
                  password: 'pass123456',
                  confirmPassword: 'pass123456',
                  agreePolicy: true,
                }),
            },
            'submit',
          ),
        ]);
    },
  }),
  z: {
    boolean: () => ({ refine: () => ({}) }),
    string: () => ({ min: () => ({ refine: () => ({}) }) }),
  },
}));

vi.mock('@vben/locales', async () => {
  const actual = await vi.importActual<typeof import('@vben/locales')>('@vben/locales');
  return {
    ...actual,
    $t: (key: string) => key,
  };
});

vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));

vi.mock('@vben/icons', () => ({
  SvgGithubIcon: defineComponent({ template: '<span>github</span>' }),
}));

vi.mock('antdv-next', () => ({
  Button: defineComponent({ template: '<button><slot /></button>' }),
  Divider: defineComponent({ template: '<div><slot /></div>' }),
  Tooltip: defineComponent({ template: '<div><slot /></div>' }),
  notification: {
    error: vi.fn(),
  },
}));

vi.mock('#/api', () => ({
  signupApi: signupApiMock,
  redirectProviderLogin: vi.fn(),
}));

vi.mock('#/store', () => ({
  useAuthStore: () => ({
    authLogin: authLoginMock,
    finalizeAuthenticatedSession: finalizeAuthenticatedSessionMock,
    loginLoading: false,
  }),
}));

import { coreRoutes } from '#/router/routes/core';

import LoginView from '../login.vue';
import RegisterView from '../register.vue';

async function mountComponent(component: any) {
  const container = document.createElement('div');
  createApp(component).mount(container);
  await nextTick();
  return container;
}

describe('authentication entry', () => {
  beforeEach(() => {
    routeState.query = {};
    pushMock.mockReset();
    signupApiMock.mockReset();
    finalizeAuthenticatedSessionMock.mockReset();
    authLoginMock.mockReset();
  });

  it('register 路由不再重定向回登录', () => {
    const registerRoute = coreRoutes.find((route) => route.path === '/auth')?.children?.find((child) => child.path === 'register');
    expect(registerRoute?.redirect).toBeUndefined();
  });

  it('登录页展示注册入口', async () => {
    const container = await mountComponent(LoginView);
    expect(container.textContent).toContain('注册');
  });

  it('展示 invite_code 并在注册成功后跳转 redirect', async () => {
    routeState.query = { invite_code: 'AQPSQ6OVNA', redirect: '/promotion' };
    signupApiMock.mockResolvedValue({ accessToken: 'session', pendingFlow: null });
    finalizeAuthenticatedSessionMock.mockImplementation(async (callback?: () => Promise<void> | void) => {
      await callback?.();
      return { homePath: '/dashboard/overview' };
    });

    const container = await mountComponent(RegisterView);
    expect(container.textContent).toContain('AQPSQ6OVNA');

    container.querySelector('button')?.dispatchEvent(new Event('click'));
    await nextTick();

    expect(signupApiMock).toHaveBeenCalledWith({ email: 'demo@example.com', phone: '+8613800138000', password: 'pass123456' });
    expect(pushMock).toHaveBeenCalledWith('/promotion');
  });

  it('命中 verify_phone flow 时跳去验证页并保留 query', async () => {
    routeState.query = { invite_code: 'AQPSQ6OVNA', redirect: '/promotion' };
    signupApiMock.mockResolvedValue({ accessToken: null, pendingFlow: 'verify_phone' });

    const container = await mountComponent(RegisterView);
    container.querySelector('button')?.dispatchEvent(new Event('click'));
    await nextTick();

    expect(pushMock).toHaveBeenCalledWith({
      path: '/auth/verify-phone',
      query: {
        ...routeState.query,
        phone: '+8613800138000',
      },
    });
  });
});
