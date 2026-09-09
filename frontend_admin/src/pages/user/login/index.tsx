import {
  LockOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
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
import { Alert, App, Button, Spin, Tabs } from 'antd';
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
import { loadAuthenticatedState } from '@/services/manual/authenticatedState';
import {
  confirmPublicLoginCode,
  getPublicAuthErrorMessage,
  requestPublicPhoneLoginCode,
} from '@/services/manual/publicAuth';
import { authenticateMfaWithWebauthn } from '@/services/manual/webauthn';
import {
  buildAuthRedirectPath,
  DEFAULT_POST_LOGIN_PATH,
  getSafeAdminRedirect,
  PASSWORD_RESET_PATH,
  REGISTER_PATH,
  VERIFY_PHONE_PATH,
} from '@/utils/adminRouting';
import { normalizeEmailLikeInput } from '@/utils/email';
import Settings from '../../../../config/defaultSettings';
import logoUrl from '../../../../public/logo.svg';
import WechatOfficialLoginModal from './wechat-official-login-modal';

type LoginFormValues = {
  email?: string;
  username?: string;
  password?: string;
  code?: string;
  autoLogin?: boolean;
  type?: string;
};

type LoginMethod = 'account' | 'phone' | 'wechat';

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
      top: 18,
      right: 20,
      zIndex: 2,
      backgroundColor: token.colorBgContainer,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadius,
      boxShadow: token.boxShadowTertiary,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      position: 'relative',
      isolation: 'isolate',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      overflowX: 'hidden',
      overflowY: 'auto',
      backgroundColor: token.colorBgLayout,
      backgroundImage: `radial-gradient(circle at 14% 12%, ${token.colorPrimaryBg} 0%, transparent 32%), radial-gradient(circle at 88% 86%, ${token.colorInfoBg} 0%, transparent 34%), linear-gradient(140deg, ${token.colorBgLayout} 0%, ${token.colorBgContainer} 52%, ${token.colorPrimaryBg} 150%)`,
    },
    backgroundPattern: {
      position: 'fixed',
      inset: 0,
      zIndex: -3,
      pointerEvents: 'none',
      opacity: 0.46,
      backgroundImage: `linear-gradient(${token.colorBorderSecondary} 1px, transparent 1px), linear-gradient(90deg, ${token.colorBorderSecondary} 1px, transparent 1px), radial-gradient(circle, ${token.colorPrimaryBorder} 1px, transparent 1.5px)`,
      backgroundSize: '64px 64px, 64px 64px, 22px 22px',
      maskImage:
        'radial-gradient(ellipse 84% 78% at 50% 48%, rgba(0, 0, 0, 0.92), transparent 88%)',
    },
    backgroundAura: {
      position: 'fixed',
      inset: 0,
      zIndex: -2,
      overflow: 'hidden',
      pointerEvents: 'none',
      '&::before': {
        position: 'absolute',
        top: -220,
        left: '8%',
        width: 620,
        height: 520,
        content: '""',
        backgroundColor: token.colorPrimaryBg,
        borderRadius: '50%',
        filter: 'blur(72px)',
        opacity: 0.82,
      },
      '&::after': {
        position: 'absolute',
        right: '4%',
        bottom: -260,
        width: 600,
        height: 520,
        content: '""',
        backgroundColor: token.colorInfoBg,
        borderRadius: '50%',
        filter: 'blur(82px)',
        opacity: 0.78,
      },
    },
    backgroundShape: {
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      overflow: 'hidden',
      pointerEvents: 'none',
      '&::before': {
        position: 'absolute',
        top: -310,
        left: -250,
        width: 720,
        height: 720,
        content: '""',
        border: `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: '46%',
        boxShadow: `0 0 0 52px ${token.colorPrimaryBg}`,
        transform: 'rotate(32deg)',
        opacity: 0.72,
      },
      '&::after': {
        position: 'absolute',
        right: -230,
        bottom: -280,
        width: 650,
        height: 650,
        content: '""',
        border: `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: '50%',
        boxShadow: `0 0 0 42px ${token.colorPrimaryBg}`,
        opacity: 0.7,
      },
    },
    backgroundNetwork: {
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      overflow: 'hidden',
      pointerEvents: 'none',
      '&::before, &::after': {
        position: 'absolute',
        width: 300,
        height: 220,
        content: '""',
        backgroundImage: `radial-gradient(circle at 10% 32%, ${token.colorPrimary} 0 2px, transparent 3px), radial-gradient(circle at 38% 12%, ${token.colorPrimaryBorder} 0 3px, transparent 4px), radial-gradient(circle at 68% 40%, ${token.colorPrimary} 0 2px, transparent 3px), radial-gradient(circle at 88% 18%, ${token.colorInfoBorder} 0 3px, transparent 4px), radial-gradient(circle at 82% 78%, ${token.colorPrimary} 0 2px, transparent 3px), radial-gradient(circle at 28% 84%, ${token.colorPrimaryBorder} 0 3px, transparent 4px), linear-gradient(24deg, transparent 0 37%, ${token.colorPrimaryBorder} 37.4% 37.8%, transparent 38.2%), linear-gradient(-25deg, transparent 0 49%, ${token.colorBorderSecondary} 49.4% 49.8%, transparent 50.2%), linear-gradient(68deg, transparent 0 58%, ${token.colorPrimaryBorder} 58.4% 58.8%, transparent 59.2%)`,
        maskImage:
          'radial-gradient(ellipse at center, rgba(0, 0, 0, 1), transparent 76%)',
        opacity: 0.6,
      },
      '&::before': {
        top: '16%',
        left: '4%',
        transform: 'rotate(-9deg)',
      },
      '&::after': {
        right: '4%',
        bottom: '14%',
        transform: 'rotate(171deg)',
      },
    },
    loginStage: {
      position: 'relative',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      padding: '32px 16px 24px',
      '&::before': {
        position: 'absolute',
        zIndex: -1,
        width: 'min(78vw, 920px)',
        aspectRatio: '1',
        content: '""',
        backgroundImage: `radial-gradient(circle, transparent 0 37%, ${token.colorPrimaryBg} 37.2% 37.7%, transparent 38% 55%, ${token.colorBorderSecondary} 55.2% 55.5%, transparent 55.8% 70%, ${token.colorPrimaryBg} 70.2% 70.5%, transparent 70.8%)`,
        borderRadius: '50%',
        opacity: 0.62,
      },
    },
    loginCard: {
      position: 'relative',
      width: 'min(100%, 420px)',
      padding: '56px 36px 50px',
      backgroundColor: token.colorBgContainer,
      border: `1px solid ${token.colorPrimaryBg}`,
      borderRadius: token.borderRadiusLG,
      boxShadow: token.boxShadowSecondary,
      '&::before': {
        position: 'absolute',
        top: -1,
        left: '50%',
        width: 148,
        height: 2,
        content: '""',
        backgroundImage: `linear-gradient(90deg, transparent, ${token.colorPrimary}, transparent)`,
        transform: 'translateX(-50%)',
      },
      '& .ant-pro-form-login-container': {
        padding: 0,
      },
      '& .ant-pro-form-login-top': {
        marginBottom: 44,
      },
      '& .ant-pro-form-login-desc': {
        marginTop: 8,
        marginBottom: 0,
      },
      '& .ant-pro-form-login-main': {
        width: '100%',
      },
      '& .ant-form-item': {
        marginBottom: 24,
      },
      '@media (max-width: 575px)': {
        width: '100%',
        padding: '36px 20px 32px',
        '& .ant-pro-form-login-top': {
          marginBottom: 34,
        },
      },
    },
    methodTabs: {
      width: '100%',
      '& .ant-tabs-nav': {
        marginBottom: 32,
      },
      '& .ant-tabs-tab': {
        padding: '8px 4px 12px',
      },
    },
    accountActions: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 30,
    },
    signupPrompt: {
      marginTop: 8,
      marginBottom: 32,
      color: token.colorText,
      textAlign: 'center',
      '& a': {
        marginInlineStart: 6,
      },
    },
    phoneSignupPrompt: {
      marginTop: 76,
    },
    codeButton: {
      paddingInline: 0,
      '&&:not(:disabled)': {
        color: token.colorPrimary,
      },
    },
    sessionLoading: {
      minHeight: 240,
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
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('account');
  const [loginCodePhone, setLoginCodePhone] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);
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

  const hydrateAuthenticatedState = async () => {
    const nextState = await loadAuthenticatedState(
      initialState?.fetchUserInfo,
      initialState?.currentUser,
    );
    if (!nextState) {
      return false;
    }

    startTransition(() => {
      setInitialState((s) => ({
        ...s,
        ...nextState,
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

    if (flowState?.kind === 'pending_phone_verification') {
      const params = new URLSearchParams();
      if (requestedRedirect) {
        params.set(
          'redirect',
          getSafeAdminRedirect(requestedRedirect, DEFAULT_POST_LOGIN_PATH),
        );
      }
      history.push(
        `${VERIFY_PHONE_PATH}${params.size ? `?${params.toString()}` : ''}`,
      );
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
      await requestPublicPhoneLoginCode(loginCodePhone);
      message.success('验证码已发送，请查看手机短信');
    } catch (error) {
      message.error(
        getPublicAuthErrorMessage(error, '验证码发送失败，请重试！'),
      );
    } finally {
      setRequestingCode(false);
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

    if (loginMethod === 'phone') {
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
      <div className={styles.backgroundPattern} aria-hidden />
      <div className={styles.backgroundAura} aria-hidden />
      <div className={styles.backgroundShape} aria-hidden />
      <div className={styles.backgroundNetwork} aria-hidden />
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
      <main className={styles.loginStage}>
        {checkingSession ? (
          <div
            className={styles.sessionLoading}
            role="status"
            aria-live="polite"
          >
            <Spin size="large" description="正在恢复登录状态…" />
          </div>
        ) : (
          <section className={styles.loginCard} aria-label="管理端登录">
            <LoginForm
              contentStyle={{
                width: '100%',
                minWidth: 0,
                maxWidth: 360,
                marginInline: 'auto',
              }}
              logo={<img alt="链云空间" src={logoUrl} />}
              title={Settings.title}
              subTitle="使用微信、手机号或邮箱登录"
              initialValues={{
                autoLogin: true,
              }}
              submitter={
                pendingMfa.active || loginMethod !== 'wechat'
                  ? {
                      searchConfig: {
                        submitText: pendingMfa.active ? '验证并登录' : '登录',
                      },
                    }
                  : false
              }
              onFinish={async (values) => {
                await handleSubmit(values as LoginFormValues);
              }}
            >
              {status === 'error' &&
                loginType === 'account' &&
                loginMethod === 'account' && (
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
                        ? '当前账号支持通行密钥登录，也可使用账号已启用的其他验证方式。'
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
                        autoComplete: 'one-time-code',
                        size: 'large',
                      }}
                      placeholder="6 位验证码或恢复码"
                      rules={[
                        {
                          required: true,
                          message: '请输入验证码或恢复码',
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
                  <Tabs
                    activeKey={loginMethod}
                    centered
                    className={styles.methodTabs}
                    items={[
                      { key: 'account', label: '账号登录' },
                      { key: 'phone', label: '手机号登录' },
                      { key: 'wechat', label: '扫码登录' },
                    ]}
                    onChange={(key) => {
                      setLoginMethod(key as LoginMethod);
                      setUserLoginState({});
                    }}
                  />
                  {loginMethod === 'account' && (
                    <>
                      <ProFormText
                        name="username"
                        fieldProps={{
                          autoComplete: 'username',
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
                                defaultMessage="请输入邮箱或手机号"
                              />
                            ),
                          },
                        ]}
                      />
                      <ProFormText.Password
                        name="password"
                        fieldProps={{
                          autoComplete: 'current-password',
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
                                defaultMessage="请输入密码"
                              />
                            ),
                          },
                        ]}
                      />
                    </>
                  )}
                  {loginMethod === 'phone' && (
                    <>
                      <ProFormText
                        name="phone"
                        fieldProps={{
                          autoComplete: 'tel',
                          inputMode: 'tel',
                          size: 'large',
                          prefix: (
                            <span className="flex items-center gap-2">
                              <span className="border-e pe-2">+86</span>
                              <PhoneOutlined />
                            </span>
                          ),
                          onChange: (event) =>
                            setLoginCodePhone(event.target.value),
                        }}
                        placeholder="请输入手机号"
                        rules={[
                          { required: true, message: '请输入手机号' },
                          {
                            pattern: /^1\d{10}$/,
                            message: '请输入有效的 11 位手机号',
                          },
                        ]}
                      />
                      <ProFormText
                        name="code"
                        fieldProps={{
                          autoComplete: 'one-time-code',
                          inputMode: 'numeric',
                          prefix: <SafetyCertificateOutlined />,
                          size: 'large',
                          suffix: (
                            <Button
                              className={styles.codeButton}
                              disabled={
                                !/^1\d{10}$/.test(loginCodePhone.trim())
                              }
                              htmlType="button"
                              loading={requestingCode}
                              size="small"
                              type="link"
                              onClick={() => void handleRequestLoginCode()}
                            >
                              获取验证码
                            </Button>
                          ),
                        }}
                        placeholder="请输入短信验证码"
                        rules={[{ required: true, message: '请输入验证码' }]}
                      />
                    </>
                  )}
                  {loginMethod === 'wechat' && (
                    <WechatOfficialLoginModal
                      embedded
                      open
                      redirectPath={getPostLoginRedirectUrl()}
                      onAuthenticated={finishLogin}
                      onCancel={() => undefined}
                      onPendingAuthentication={handlePendingAuthenticationFlow}
                    />
                  )}
                  {loginMethod === 'account' && (
                    <div className={styles.accountActions}>
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
                      >
                        <FormattedMessage
                          id="pages.login.forgotPassword"
                          defaultMessage="忘记密码"
                        />
                      </Link>
                    </div>
                  )}
                  {loginMethod !== 'wechat' && (
                    <div
                      className={
                        loginMethod === 'phone'
                          ? `${styles.signupPrompt} ${styles.phoneSignupPrompt}`
                          : styles.signupPrompt
                      }
                    >
                      还没有账号？
                      <Link
                        to={buildAuthRedirectPath(
                          REGISTER_PATH,
                          requestedRedirect,
                        )}
                      >
                        注册账号
                      </Link>
                    </div>
                  )}
                </>
              )}
            </LoginForm>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Login;
