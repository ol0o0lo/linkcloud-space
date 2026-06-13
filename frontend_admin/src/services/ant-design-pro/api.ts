// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

const ALLAUTH_BROWSER_BASE = '/api/allauth/browser/v1';

type MeResponse = {
  avatar_url?: string | null;
  email?: string;
  first_name?: string;
  id?: number;
  is_staff?: boolean;
  is_superuser?: boolean;
  last_name?: string;
  phone?: string | null;
  username?: string;
};

function getCookie(name: string) {
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

function buildAllauthLoginData(body: API.LoginParams) {
  const identifier = (body.username || '').trim();
  const password = body.password || '';
  if (identifier.includes('@')) {
    return { email: identifier, password };
  }
  const phone = /^1\d{10}$/.test(identifier) ? `+86${identifier}` : identifier;
  return { phone, password };
}

function isAllauthValidationError(error: any) {
  const status = error?.response?.status;
  const errors = error?.response?.data?.errors || error?.data?.errors;
  return status === 400 && Array.isArray(errors);
}

function mapMeToCurrentUser(user: MeResponse): API.CurrentUser {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || '';
  const isAdmin = Boolean(user.is_staff || user.is_superuser);
  return {
    name,
    avatar: user.avatar_url || undefined,
    userid: user.username,
    email: user.email,
    access: isAdmin ? 'admin' : 'user',
    title: isAdmin ? '管理员' : '成员',
    group: isAdmin ? '后台管理' : '普通用户',
    phone: user.phone || '',
    tags: [],
    notifyCount: 0,
    unreadCount: 0,
  };
}

/** 获取当前的用户 GET /api/users/me/ */
export async function currentUser(options?: { [key: string]: any }) {
  const user = await request<MeResponse>('/api/users/me/', {
    method: 'GET',
    ...(options || {}),
  });
  return { data: mapMeToCurrentUser(user) };
}

/** 退出登录接口 DELETE /api/allauth/browser/v1/auth/session */
export async function outLogin(options?: { [key: string]: any }) {
  const csrfToken = await ensureCsrfToken();
  try {
    return await request<Record<string, any>>(`${ALLAUTH_BROWSER_BASE}/auth/session`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'X-CSRFToken': csrfToken,
      },
      skipErrorHandler: true,
      ...(options || {}),
    } as any);
  } catch (error: any) {
    if (error?.response?.status === 401) {
      return { success: true, data: {} };
    }
    throw error;
  }
}

/** 登录接口 POST /api/allauth/browser/v1/auth/login */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  const csrfToken = await ensureCsrfToken();
  try {
    await request(`${ALLAUTH_BROWSER_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      data: buildAllauthLoginData(body),
      skipErrorHandler: true,
      ...(options || {}),
    } as any);
    return {
      status: 'ok',
      type: body.type,
      currentAuthority: undefined,
    };
  } catch (error) {
    if (isAllauthValidationError(error)) {
      return {
        status: 'error',
        type: body.type,
        currentAuthority: 'guest',
      };
    }
    throw error;
  }
}

/** 此处后端没有提供注释 GET /api/notices */
export async function getNotices(options?: { [key: string]: any }) {
  return request<API.NoticeIconList>('/api/notices', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取规则列表 GET /api/rule */
export async function rule(
  params: {
    // query
    /** 当前的页码 */
    current?: number;
    /** 页面的容量 */
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  return request<API.RuleList>('/api/rule', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 更新规则 PUT /api/rule */
export async function updateRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'update',
      ...(options || {}),
    },
  });
}

/** 新建规则 POST /api/rule */
export async function addRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'post',
      ...(options || {}),
    },
  });
}

/** 删除规则 DELETE /api/rule */
export async function removeRule(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/rule', {
    method: 'POST',
    data: {
      method: 'delete',
      ...(options || {}),
    },
  });
}
