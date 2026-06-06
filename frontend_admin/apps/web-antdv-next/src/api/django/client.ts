import { requestClient } from '#/api/request';

type QueryParams = Record<string, boolean | number | string | undefined>;

function getCookie(name: string) {
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return '';
}

function buildQuery(params?: QueryParams) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function csrfHeaders() {
  const token = getCookie('csrftoken');
  return token ? { 'X-CSRFToken': token } : {};
}

export async function djangoGet<T>(url: string, params?: QueryParams) {
  return requestClient.get<T>(`${url}${buildQuery(params)}`, {
    responseReturn: 'body',
  });
}

export async function djangoPost<T>(url: string, data?: unknown) {
  return requestClient.post<T>(url, data, {
    headers: csrfHeaders(),
    responseReturn: 'body',
  });
}

export async function djangoPatch<T>(url: string, data?: unknown) {
  return requestClient.request<T>(url, {
    data,
    headers: csrfHeaders(),
    method: 'PATCH',
    responseReturn: 'body',
  });
}

export async function djangoPut<T>(url: string, data?: unknown) {
  return requestClient.put<T>(url, data, {
    headers: csrfHeaders(),
    responseReturn: 'body',
  });
}

export async function djangoDelete<T = null>(url: string) {
  return requestClient.delete<T>(url, {
    headers: csrfHeaders(),
    responseReturn: 'body',
  });
}

export async function allauthRequest<T>(
  url: string,
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const csrf = getCookie('csrftoken');
  if (csrf) headers.set('X-CSRFToken', csrf);

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });

  let body: any = null;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`) as Error & {
      data?: any;
      response?: Response;
    };
    error.response = response;
    error.data = body;
    throw error;
  }

  return body as T;
}

export function getAllauthErrors(error: any) {
  const messages: string[] = [];
  const errors = error?.data?.errors ?? error?.data?.data?.errors ?? [];
  for (const item of errors) {
    if (item?.message) messages.push(item.message);
  }
  if (messages.length > 0) return messages.join('；');
  return error?.data?.detail ?? error?.data?.message ?? error?.message ?? '请求失败';
}
