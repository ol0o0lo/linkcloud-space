import {
  LockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { LoginForm, ProFormCheckbox, ProFormText } from '@ant-design/pro-components';
import {
  FormattedMessage,
  Helmet,
  SelectLang,
  useIntl,
  useModel,
} from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
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
import { normalizeEmailLikeInput } from '@/utils/email';
import Settings from '../../../../config/defaultSettings';
import logoUrl from '../../../../public/logo.svg';

type LoginFormValues = {
  username?: string;
  password?: string;
  code?: string;
  autoLogin?: boolean;
  type?: string;
};

type LoginResult = {
  status?: 'ok' | 'error';
  type?: string;
  currentAuthority?: string;
};

type PendingMfaState = {
  active: boolean;
  types: string[];
};

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
  return detail?.message || error?.response?.data?.message || error?.message || fallback;
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
  const [pendingMfa, setPendingMfa] = useState<PendingMfaState>({
    active: false,
    types: [],
  });
  const type = 'account';
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();
  const intl = useIntl();
  const welcomePath = '/welcome';

  /**
   * Validate redirect URL to prevent open redirect attacks
   * Only allow same-origin relative paths starting with '/'
   */
  const getSafeRedirectUrl = (redirect: string | null): string => {
    if (!redirect?.startsWith('/')) return welcomePath;

    // Block protocol-relative URLs (//example.com)
    if (redirect.startsWith('//')) return welcomePath;

    try {
      const parsed = new URL(redirect, window.location.origin);
      // Only allow same-origin URLs
      if (parsed.origin !== window.location.origin) return welcomePath;
      // Return the path with query and hash preserved
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return welcomePath;
    }
  };

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      startTransition(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
  };

  const finishLogin = async () => {
    const defaultLoginSuccessMessage = intl.formatMessage({
      id: 'pages.login.success',
      defaultMessage: '登录成功！',
    });
    message.success(defaultLoginSuccessMessage);
    await fetchUserInfo();
    const currentHref = window.location.href || '/user/login';
    const currentOrigin = window.location.origin || 'http://localhost';
    const currentUrl = new URL(currentHref, currentOrigin);
    const urlParams = currentUrl.searchParams;
    const redirectUrl = getSafeRedirectUrl(urlParams.get('redirect'));
    window.location.href = redirectUrl;
  };

  const handleSubmit = async (values: LoginFormValues) => {
    if (pendingMfa.active) {
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

        message.error(getAllauthErrorMessage(error, '验证码校验失败，请重试！'));
        return;
      }
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
      const flowState = parseLoginFlowState(error);
      if (flowState?.kind === 'pending_mfa') {
        setPendingMfa({
          active: true,
          types: Array.isArray(flowState.flow.types) ? flowState.flow.types : [],
        });
        setUserLoginState({});
        return;
      }

      if (flowState?.kind === 'unsupported_flow') {
        message.error(formatUnsupportedFlowMessage(flowState.flowIds));
        return;
      }

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
                title="请输入身份验证器验证码或恢复码"
                description={
                  pendingMfa.types.includes('recovery_codes')
                    ? '当前账号开启了多因素认证，请输入 6 位验证码，或直接输入恢复码完成登录。'
                    : '当前账号开启了多因素认证，请输入身份验证器当前显示的 6 位验证码完成登录。'
                }
                type="info"
                showIcon
              />
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
            </>
          ) : (
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
                <a
                  href="#"
                  style={{
                    float: 'right',
                  }}
                >
                  <FormattedMessage
                    id="pages.login.forgotPassword"
                    defaultMessage="忘记密码"
                  />
                </a>
              </div>
            </>
          )}
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
