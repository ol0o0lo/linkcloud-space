import {
  postBrowserV1AuthEmailVerify,
  postBrowserV1AuthPhoneVerify,
  postBrowserV1AuthPhoneVerifyResend,
  postBrowserV1AuthSignup,
} from '@/services/allauth/authAccount';
import {
  postBrowserV1AuthPasswordRequest,
  postBrowserV1AuthPasswordReset,
} from '@/services/allauth/authPasswordReset';
import {
  postBrowserV1AuthCodeConfirm,
  postBrowserV1AuthCodeRequest,
  postBrowserV1AuthCodeResend,
} from '@/services/allauth/authLoginByCode';
import { getBrowserV1Config } from '@/services/allauth/configuration';
import { ADMIN_BASE_PATH } from '@/utils/adminRouting';
import { normalizeEmailLikeInput } from '@/utils/email';
import { normalizeAccountPhoneParts } from '@/utils/phone';

const PUBLIC_AUTH_REQUEST_OPTIONS = {
  credentials: 'include',
  skipErrorHandler: true,
} as const;

const ALLAUTH_PROVIDER_REDIRECT_PATH =
  '/api/allauth/browser/v1/auth/provider/redirect';

export type PublicSignupInput = {
  email: string;
  phoneCountryCode: string;
  phoneNationalNumber: string;
  password: string;
  inviteCode?: string;
  referralSource?: 'code' | 'link';
};

export async function signupPublicAccount(input: PublicSignupInput) {
  const phone = normalizeAccountPhoneParts(
    input.phoneCountryCode,
    input.phoneNationalNumber,
  );
  const inviteCode = (input.inviteCode || '').trim().toUpperCase();
  return postBrowserV1AuthSignup(
    {
      client: 'browser',
      ...(inviteCode ? { invite_code: inviteCode } : {}),
      ...(inviteCode
        ? { referral_source: input.referralSource || 'code' }
        : {}),
    } as AllauthAPI.postBrowserV1AuthSignupParams,
    {
      email: normalizeEmailLikeInput(input.email),
      password: input.password,
      phone: `${phone.countryCode}${phone.nationalNumber}`,
    } as unknown as AllauthAPI.Signup,
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function verifyPublicPhone(code: string) {
  return postBrowserV1AuthPhoneVerify(
    { client: 'browser' },
    { code: code.trim() },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function resendPublicPhoneCode() {
  return postBrowserV1AuthPhoneVerifyResend(
    { client: 'browser' },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function requestPublicPasswordReset(email: string) {
  return postBrowserV1AuthPasswordRequest(
    { client: 'browser' },
    { email: normalizeEmailLikeInput(email) } as unknown as AllauthAPI.RequestPassword,
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function resetPublicPassword(key: string, password: string) {
  return postBrowserV1AuthPasswordReset(
    { client: 'browser' },
    { key, password },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function confirmPublicEmail(key: string) {
  return postBrowserV1AuthEmailVerify(
    { client: 'browser' },
    { key },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export async function requestPublicLoginCode(email: string) {
  try {
    await postBrowserV1AuthCodeRequest(
      { client: 'browser' },
      { email: normalizeEmailLikeInput(email) },
      PUBLIC_AUTH_REQUEST_OPTIONS as any,
    );
  } catch (error) {
    if (getPendingPublicAuthFlow(error) === 'login_by_code') {
      return;
    }
    throw error;
  }
}

export function confirmPublicLoginCode(code: string) {
  return postBrowserV1AuthCodeConfirm(
    { client: 'browser' },
    { code: code.trim() },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

export function resendPublicLoginCode() {
  return postBrowserV1AuthCodeResend(
    { client: 'browser' },
    PUBLIC_AUTH_REQUEST_OPTIONS as any,
  );
}

function getCookie(name: string) {
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

async function ensureCsrfToken() {
  let token = getCookie('csrftoken');
  if (!token) {
    await getBrowserV1Config(
      { client: 'browser' },
      PUBLIC_AUTH_REQUEST_OPTIONS as any,
    );
    token = getCookie('csrftoken');
  }
  return token;
}

function getProviderCallbackUrl() {
  const callbackUrl = new URL(
    `${window.location.origin}${ADMIN_BASE_PATH}/user/login`,
  );
  const currentUrl = new URL(window.location.href, window.location.origin);
  const redirect = currentUrl.searchParams.get('redirect');
  if (redirect) {
    callbackUrl.searchParams.set('redirect', redirect);
  }
  return callbackUrl.toString();
}

export async function startPublicProviderLogin(provider: 'github') {
  const csrfToken = await ensureCsrfToken();
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = ALLAUTH_PROVIDER_REDIRECT_PATH;
  form.style.display = 'none';

  [
    ['csrfmiddlewaretoken', csrfToken],
    ['provider', provider],
    ['callback_url', getProviderCallbackUrl()],
    ['process', 'login'],
  ].forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

export function getPublicAuthErrorMessage(error: any, fallback: string) {
  const details =
    error?.response?.data?.errors ||
    error?.response?.data?.data?.errors ||
    error?.data?.errors ||
    [];
  if (Array.isArray(details) && details[0]?.message) {
    return String(details[0].message);
  }
  return String(
    error?.response?.data?.message || error?.data?.message || error?.message || fallback,
  );
}

export function getPendingPublicAuthFlow(error: any) {
  if (error?.response?.status !== 401) return undefined;
  const flows =
    error?.response?.data?.flows ||
    error?.response?.data?.data?.flows ||
    error?.data?.flows ||
    [];
  return Array.isArray(flows)
    ? flows.find((flow) => flow?.is_pending)?.id
    : undefined;
}
