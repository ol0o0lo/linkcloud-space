import { LockOutlined, UserOutlined } from '@ant-design/icons';
import {
  LoginForm,
  ProFormCheckbox,
  ProFormText,
} from '@ant-design/pro-components';
import {
  FormattedMessage,
  Helmet,
  history,
  Link,
  SelectLang,
  useIntl,
  useModel,
} from '@umijs/max';
import { Alert, App, Button, Spin } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useEffect, useRef, useState } from 'react';
import { Footer } from '@/components';
import { postBrowserV1AuthLogin } from '@/services/allauth/authAccount';
import {
  postBrowserV1AuthTwofaAuthenticate,
  postBrowserV1AuthTwofaTrust,
} from '@/services/allauth/authTwoFactor';
import {
  formatUnsupportedFlowMessage,
  parseLoginFlowState,
} from '@/services/manual/allauthFlow';
import {
  confirmPublicLoginCode,
  getPublicAuthErrorMessage,
  requestPublicLoginCode,
  startPublicProviderLogin,
} from '@/services/manual/publicAuth';
import {
  authenticateMfaWithWebauthn,
  loginWithPasskey,
} from '@/services/manual/webauthn';
import { appsOrganizationsApiSwitchList } from '@/services/openapi/organizations';
import {
  buildAuthRedirectPath,
  DEFAULT_POST_LOGIN_PATH,
  getSafeAdminRedirect,
  PASSWORD_RESET_PATH,
  REGISTER_PATH,
} from '@/utils/adminRouting';
import { normalizeEmailLikeInput } from '@/utils/email';
import { resolveSelectedOrgSlug } from '@/utils/orgSelection';
import Settings from '../../../../config/defaultSettings';
import logoUrl from '../../../../public/logo.svg';

type LoginFormValues = {
  email?: string;
  username?: string;
  password?: string;
  code?: string;
  autoLogin?: boolean;
  type?: string;
};

type LoginMethod = 'password' | 'code';

type LoginResult = {
  status?: 'ok' | 'error';
  type?: string;
  currentAuthority?: string;
};

type PendingMfaState = {
  active: boolean;
  types: string[];
};

function getPostLoginRedirectUrl(): string {
  const currentHref = window.location.href || '/user/login';
  const currentOrigin = window.location.origin || 'http://localhost';
  const currentUrl = new URL(currentHref, currentOrigin);
  return getSafeAdminRedirect(
    currentUrl.searchParams.get('redirect'),
    DEFAULT_POST_LOGIN_PATH,
  );
}

function buildAllauthLoginData(body: LoginFormValues) {
  const identifier = (body.username || '').trim();
  const normalizedEmailIdentifier = normalizeEmailLikeInput(identifier);
  const password = body.password || '';

  if (normalizedEmailIdentifier.includes('@')) {
    return { email: normalizedEmailIdentifier, password };
  }

  const phone = /^1\d{10}$/.test(identifier) ? `+86${identifier}` : identifier;
  return { phone, password };
}

function isAllauthValidationError(error: any) {
  const status = error?.response?.status;
  const errors = error?.response?.data?.errors || error?.data?.errors;
  return status === 400 && Array.isArray(errors);
}

function getAllauthErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.errors?.[0] || error?.data?.errors?.[0];
  return (
    detail?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

const useStyles = createStyles(({ token }) => {
  return {
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        'linear-gradient(135deg, #f6f8fb 0%, #eef6f2 45%, #f8fafc 100%)',
      backgroundSize: 'cover',
    },
    sessionLoading: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});

const Lang = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      title={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<LoginResult>({});
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [loginCodeEmail, setLoginCodeEmail] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [mfaWebauthnLoading, setMfaWebauthnLoading] = useState(false);
  const [pendingMfa, setPendingMfa] = useState<PendingMfaState>({
    active: false,
    types: [],
  });
  const sessionCheckRef = useRef<Promise<boolean> | null>(null);
  const type = 'account';
  const { initialState, setInitialState } = useModel('@@initialState');
  const requestedRedirect = new URL(
    window.location.href || '/user/login',
    window.location.origin || 'http://localhost',
  ).searchParams.get('redirect');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();

  const fetchOrganizations = async () => {
    try {
      return await appsOrganizationsApiSwitchList({
        skipErrorHandler: true,
      });
    } catch {
      return [];
    }
  };

  const hydrateAuthenticatedState = async () => {
    const userInfo =
      initialState?.currentUser || (await initialState?.fetchUserInfo?.());
    if (!userInfo) {
      return false;
    }

    const organizations = await fetchOrganizations();
    const selectedOrgSlug = resolveSelectedOrgSlug(organizations);

    startTransition(() => {
      setInitialState((s) => ({
        ...s,
        currentUser: userInfo,
        organizations,
        selectedOrgSlug,
      }));
    });
    return true;
  };

  const redirectAuthenticatedUser = () => {
    history.replace(getPostLoginRedirectUrl());
  };

  useEffect(() => {
    let active = true;
    sessionCheckRef.current ||= hydrateAuthenticatedState();

    void sessionCheckRef.current.then((authenticated) => {
      if (!active) return;
      if (authenticated) {
        redirectAuthenticatedUser();
        return;
      }
      setCheckingSession(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const finishLogin = async () => {
    const defaultLoginSuccessMessage = intl.formatMessage({
      id: 'pages.login.success',
      defaultMessage: '登录成功！',
    });
    message.success(defaultLoginSuccessMessage);
    await hydrateAuthenticatedState();
    redirectAuthenticatedUser();
  };

  const handlePendingAuthenticationFlow = async (error: unknown) => {
    const flowState = parseLoginFlowState(error);
    if (flowState?.kind === 'pending_mfa') {
      setPendingMfa({
        active: true,
        types: Array.isArray(flowState.flow.types) ? flowState.flow.types : [],
      });
      setUserLoginState({});
      return true;
    }

    if (flowState?.kind === 'pending_mfa_trust') {
      await postBrowserV1AuthTwofaTrust(
        { client: 'browser' } as any,
        { trust: false },
        { skipErrorHandler: true } as any,
      );
      await finishLogin();
      return true;
    }

    if (flowState?.kind === 'unsupported_flow') {
      message.error(formatUnsupportedFlowMessage(flowState.flowIds));
      return true;
    }
    return false;
  };

  const handleRequestLoginCode = async () => {
    setRequestingCode(true);
    try {
      await requestPublicLoginCode(loginCodeEmail);
      message.success('验证码已发送，请检查邮箱');
    } catch (error) {
      message.error(
        getPublicAuthErrorMessage(error, '验证码发送失败，请重试！'),
      );
    } finally {
      setRequestingCode(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      await loginWithPasskey();
      await finishLogin();
    } catch (error) {
      if (await handlePendingAuthenticationFlow(error)) return;
      message.error(
        getPublicAuthErrorMessage(error, '通行密钥登录失败，请重试！'),
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleWebauthnMfa = async () => {
    setMfaWebauthnLoading(true);
    try {
      await authenticateMfaWithWebauthn();
      await finishLogin();
    } catch (error) {
      if (await handlePendingAuthenticationFlow(error)) return;
      message.error(
        getPublicAuthErrorMessage(error, '安全密钥验证失败，请重试！'),
      );
    } finally {
      setMfaWebauthnLoading(false);
    }
  };

  const handleSubmit = async (values: LoginFormValues) => {
    if (pendingMfa.active) {
      const supportsCode =
        !pendingMfa.types.length ||
        pendingMfa.types.includes('totp') ||
        pendingMfa.types.includes('recovery_codes');
      if (!supportsCode && pendingMfa.types.includes('webauthn')) {
        await handleWebauthnMfa();
        return;
      }
      try {
        await postBrowserV1AuthTwofaAuthenticate(
          { client: 'browser' },
          { code: (values.code || '').trim() },
          {
            skipErrorHandler: true,
          } as any,
        );
        await finishLogin();
        return;
      } catch (error) {
        const flowState = parseLoginFlowState(error);
        if (flowState?.kind === 'pending_mfa_trust') {
          await postBrowserV1AuthTwofaTrust(
            { client: 'browser' } as any,
            { trust: false },
            {
              skipErrorHandler: true,
            } as any,
          );
          await finishLogin();
          return;
        }

        if (flowState?.kind === 'unsupported_flow') {
          message.error(formatUnsupportedFlowMessage(flowState.flowIds));
          return;
        }

        message.error(
          getAllauthErrorMessage(error, '验证码校验失败，请重试！'),
        );
        return;
      }
    }

    if (loginMethod === 'code') {
      try {
        await confirmPublicLoginCode((values.code || '').trim());
        await finishLogin();
      } catch (error) {
        if (await handlePendingAuthenticationFlow(error)) return;
        message.error(
          getPublicAuthErrorMessage(error, '验证码登录失败，请重试！'),
        );
      }
      return;
    }

    try {
      await postBrowserV1AuthLogin(
        { client: 'browser' },
        buildAllauthLoginData({ ...values, type }) as any,
        {
          skipErrorHandler: true,
        } as any,
      );

      const msg: LoginResult = {
        status: 'ok',
        type,
        currentAuthority: undefined,
      };

      if (msg.status === 'ok') {
        await finishLogin();
        return;
      }

      setUserLoginState(msg);
    } catch (error) {
      if ((error as any)?.response?.status === 409) {
        const authenticated = await hydrateAuthenticatedState();
        if (authenticated) {
          redirectAuthenticatedUser();
          return;
        }
      }

      if (await handlePendingAuthenticationFlow(error)) return;

      if (isAllauthValidationError(error)) {
        setUserLoginState({
          status: 'error',
          type,
          currentAuthority: 'guest',
        });
        return;
      }

      const defaultLoginFailureMessage = intl.formatMessage({
        id: 'pages.login.failure',
        defaultMessage: '登录失败，请重试！',
      });
      message.error(defaultLoginFailureMessage);
    }
  };
  const { status, type: loginType } = userLoginState;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'menu.login',
            defaultMessage: '登录页',
          })}
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <Lang />
      <div
        style={{
          flex: '1',
          padding: '32px 0',
        }}
      >
        {checkingSession ? (
          <div
            className={styles.sessionLoading}
            role="status"
            aria-live="polite"
          >
            <Spin size="large" description="正在恢复登录状态…" />
          </div>
        ) : (
          <LoginForm
            contentStyle={{
              minWidth: 280,
              maxWidth: '75vw',
            }}
            logo={<img alt="logo" src={logoUrl} />}
            title={Settings.title}
            subTitle={intl.formatMessage({
              id: 'pages.layouts.userLayout.title',
            })}
            initialValues={{
              autoLogin: true,
            }}
            onFinish={async (values) => {
              await handleSubmit(values as LoginFormValues);
            }}
          >
            {status === 'error' && loginType === 'account' && (
              <LoginMessage
                content={intl.formatMessage({
                  id: 'pages.login.accountLogin.errorMessage',
                  defaultMessage: '账户或密码错误',
                })}
              />
            )}
            {pendingMfa.active ? (
              <>
                <Alert
                  style={{
                    marginBottom: 24,
                  }}
                  title={
                    pendingMfa.types.length === 1 &&
                    pendingMfa.types.includes('webauthn')
                      ? '请使用安全密钥完成多因素认证'
                      : '请输入身份验证器验证码或恢复码'
                  }
                  description={
                    pendingMfa.types.includes('webauthn')
                      ? '当前账号支持 WebAuthn 安全密钥；也可使用账号已启用的其他验证方式。'
                      : pendingMfa.types.includes('recovery_codes')
                        ? '当前账号开启了多因素认证，请输入 6 位验证码，或直接输入恢复码完成登录。'
                        : '当前账号开启了多因素认证，请输入身份验证器当前显示的 6 位验证码完成登录。'
                  }
                  type="info"
                  showIcon
                />
                {(!pendingMfa.types.length ||
                  pendingMfa.types.includes('totp') ||
                  pendingMfa.types.includes('recovery_codes')) && (
                  <ProFormText
                    name="code"
                    fieldProps={{
                      size: 'large',
                    }}
                    placeholder="6 位验证码或恢复码"
                    rules={[
                      {
                        required: true,
                        message: '请输入验证码或恢复码！',
                      },
                    ]}
                  />
                )}
                {pendingMfa.types.includes('webauthn') && (
                  <Button
                    block
                    htmlType="button"
                    loading={mfaWebauthnLoading}
                    onClick={() => void handleWebauthnMfa()}
                  >
                    使用安全密钥验证
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="mb-6 flex gap-2">
                  <Button
                    block
                    htmlType="button"
                    type={loginMethod === 'password' ? 'primary' : 'default'}
                    onClick={() => setLoginMethod('password')}
                  >
                    密码登录
                  </Button>
                  <Button
                    block
                    htmlType="button"
                    type={loginMethod === 'code' ? 'primary' : 'default'}
                    onClick={() => setLoginMethod('code')}
                  >
                    邮箱验证码登录
                  </Button>
                </div>
                {loginMethod === 'password' ? (
                  <>
                    <ProFormText
                      name="username"
                      fieldProps={{
                        size: 'large',
                        prefix: <UserOutlined />,
                      }}
                      placeholder={intl.formatMessage({
                        id: 'pages.login.username.placeholder',
                        defaultMessage: '邮箱 / 手机号',
                      })}
                      rules={[
                        {
                          required: true,
                          message: (
                            <FormattedMessage
                              id="pages.login.username.required"
                              defaultMessage="请输入邮箱或手机号!"
                            />
                          ),
                        },
                      ]}
                    />
                    <ProFormText.Password
                      name="password"
                      fieldProps={{
                        size: 'large',
                        prefix: <LockOutlined />,
                      }}
                      placeholder={intl.formatMessage({
                        id: 'pages.login.password.placeholder',
                        defaultMessage: '密码',
                      })}
                      rules={[
                        {
                          required: true,
                          message: (
                            <FormattedMessage
                              id="pages.login.password.required"
                              defaultMessage="请输入密码！"
                            />
                          ),
                        },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <ProFormText
                      name="email"
                      fieldProps={{
                        size: 'large',
                        prefix: <UserOutlined />,
                        onChange: (event) =>
                          setLoginCodeEmail(event.target.value),
                      }}
                      placeholder="请输入邮箱"
                      rules={[
                        { required: true, message: '请输入邮箱！' },
                        { type: 'email', message: '请输入有效的邮箱地址！' },
                      ]}
                    />
                    <ProFormText
                      name="code"
                      fieldProps={{ size: 'large' }}
                      placeholder="请输入邮箱验证码"
                      rules={[{ required: true, message: '请输入验证码！' }]}
                    />
                    <Button
                      block
                      disabled={!loginCodeEmail.trim()}
                      htmlType="button"
                      loading={requestingCode}
                      onClick={() => void handleRequestLoginCode()}
                    >
                      发送验证码
                    </Button>
                  </>
                )}
                <div
                  style={{
                    marginBottom: 24,
                  }}
                >
                  <ProFormCheckbox noStyle name="autoLogin">
                    <FormattedMessage
                      id="pages.login.rememberMe"
                      defaultMessage="自动登录"
                    />
                  </ProFormCheckbox>
                  <Link
                    to={buildAuthRedirectPath(
                      PASSWORD_RESET_PATH,
                      requestedRedirect,
                    )}
                    style={{
                      float: 'right',
                    }}
                  >
                    <FormattedMessage
                      id="pages.login.forgotPassword"
                      defaultMessage="忘记密码"
                    />
                  </Link>
                </div>
                <div className="mb-4 flex gap-2">
                  <Button
                    block
                    htmlType="button"
                    loading={passkeyLoading}
                    onClick={() => void handlePasskeyLogin()}
                  >
                    使用通行密钥登录
                  </Button>
                  <Button
                    block
                    htmlType="button"
                    onClick={() => void startPublicProviderLogin('github')}
                  >
                    使用 GitHub 登录
                  </Button>
                </div>
                <div className="text-center">
                  还没有账号？
                  <Link
                    to={buildAuthRedirectPath(REGISTER_PATH, requestedRedirect)}
                  >
                    注册账号
                  </Link>
                </div>
              </>
            )}
          </LoginForm>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Login;
