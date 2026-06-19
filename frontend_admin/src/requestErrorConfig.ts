import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { getIntl, history, request } from '@umijs/max';
import { message } from 'antd';
import { getSelectedOrgSlug } from './utils/orgSelection';

const LOGIN_PATH = '/user/login';
const ALLAUTH_BROWSER_BASE = '/api/allauth/browser/v1';

function getCookie(name: string) {
  if (typeof document === 'undefined') {
    return '';
  }
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : '';
}

async function ensureCsrfToken() {
  let token = getCookie('csrftoken');
  if (!token) {
    await request(`${ALLAUTH_BROWSER_BASE}/config`, {
      method: 'GET',
      credentials: 'include',
      skipErrorHandler: true,
    } as any);
    token = getCookie('csrftoken');
  }
  return token;
}

function isSafeMethod(method?: string) {
  const normalized = (method || 'GET').toUpperCase();
  return ['GET', 'HEAD', 'OPTIONS'].includes(normalized);
}

interface ApiEnvelope<T = unknown> {
  code: number;
  message?: string;
  data: T;
  timestamp: number;
  traceId: string;
  error?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    isPlainObject(value) &&
    typeof value.code === 'number' &&
    'data' in value &&
    typeof value.timestamp === 'number' &&
    typeof value.traceId === 'string'
  );
}

function getApiErrorMessage(data: unknown): string | undefined {
  if (!isApiEnvelope(data)) {
    return undefined;
  }
  return data.message || data.error || `Response status:${data.code}`;
}

/**
 * @name 错误处理
 * pro 自带的错误处理， 可以在这里做自己的改动
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  // 错误处理： umi@3 的错误处理方案。
  errorConfig: {
    // 错误抛出
    errorThrower: (res) => {
      if (isApiEnvelope(res) && res.code !== 200) {
        const error: any = new Error(res.message || res.error);
        error.name = 'BizError';
        error.info = res;
        throw error; // 抛出自制的错误
      }
    },
    // 错误接收及处理
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      // 我们的 errorThrower 抛出的错误。
      if (error.name === 'BizError') {
        const errorInfo: ApiEnvelope | undefined = error.info;
        if (errorInfo?.code === 401) {
          history.push(LOGIN_PATH);
        } else if (errorInfo) {
          message.error(errorInfo.message || errorInfo.error || 'Request error, please retry.');
        }
      } else if (error.response) {
        // Axios 的错误
        // 请求成功发出且服务器也响应了状态码，但状态代码超出了 2xx 的范围
        message.error(getApiErrorMessage(error.response.data) || `Response status:${error.response.status}`);
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error(
          getIntl().formatMessage({
            id: 'app.request.offline',
            defaultMessage:
              'Network unavailable. Please check your connection and try again.',
          }),
        );
      } else if (error.request) {
        message.error('None response! Please retry.');
      } else {
        message.error('Request error, please retry.');
      }
    },
  },

  // 请求拦截器
  requestInterceptors: [
    async (config: RequestOptions) => {
      const selectedOrgSlug = getSelectedOrgSlug();
      const headers = {
        ...(config.headers || {}),
        ...(selectedOrgSlug ? { 'X-Org-Slug': selectedOrgSlug } : {}),
      };

      if (isSafeMethod(config.method)) {
        return {
          ...config,
          headers,
        };
      }

      const csrfToken = await ensureCsrfToken();

      return {
        ...config,
        credentials: 'include',
        headers: {
          ...headers,
          'X-CSRFToken': csrfToken,
        },
      };
    },
  ],

  // 响应拦截器
  responseInterceptors: [
    (response) => {
      if (isApiEnvelope(response.data) && response.data.code === 200) {
        response.data = response.data.data as typeof response.data;
      }
      return response;
    },
  ],
};
