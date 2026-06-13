import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser, login, outLogin } from './api';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('ant-design-pro api auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: '',
    });
  });

  it('logs in through allauth browser endpoint with email credentials', async () => {
    document.cookie = 'csrftoken=csrf-token';
    mockRequest.mockResolvedValueOnce({ status: 200 });

    const result = await login({
      username: 'admin@example.com',
      password: 'secret123',
      type: 'account',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        data: { email: 'admin@example.com', password: 'secret123' },
        headers: expect.objectContaining({ 'X-CSRFToken': 'csrf-token' }),
      }),
    );
    expect(result).toEqual({
      status: 'ok',
      type: 'account',
      currentAuthority: undefined,
    });
  });

  it('normalizes mainland China mobile numbers before allauth login', async () => {
    document.cookie = 'csrftoken=csrf-token';
    mockRequest.mockResolvedValueOnce({ status: 200 });

    await login({
      username: '13800138000',
      password: 'secret123',
      type: 'account',
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/auth/login',
      expect.objectContaining({
        data: { phone: '+8613800138000', password: 'secret123' },
      }),
    );
  });

  it('fetches allauth config first when csrf cookie is missing', async () => {
    mockRequest.mockResolvedValueOnce({ status: 200 });
    document.cookie = 'csrftoken=fetched-token';
    mockRequest.mockResolvedValueOnce({ status: 200 });

    await login({
      username: 'admin@example.com',
      password: 'secret123',
      type: 'account',
    });

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/allauth/browser/v1/config',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/allauth/browser/v1/auth/login',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-CSRFToken': 'fetched-token' }),
      }),
    );
  });

  it('maps allauth validation errors to the login form error state', async () => {
    document.cookie = 'csrftoken=csrf-token';
    mockRequest.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          errors: [{ message: 'The email address and/or password you specified are not correct.' }],
        },
      },
    });

    const result = await login({
      username: 'admin@example.com',
      password: 'wrong',
      type: 'account',
    });

    expect(result).toEqual({
      status: 'error',
      type: 'account',
      currentAuthority: 'guest',
    });
  });

  it('logs out through allauth browser session endpoint', async () => {
    document.cookie = 'csrftoken=csrf-token';
    mockRequest.mockResolvedValueOnce({ status: 200 });

    await outLogin();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/allauth/browser/v1/auth/session',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-CSRFToken': 'csrf-token' }),
      }),
    );
  });

  it('maps the existing users/me endpoint to the admin current user shape', async () => {
    mockRequest.mockResolvedValueOnce({
      avatar_url: '/media/avatar.jpg',
      country: 'China',
      email: 'admin@example.com',
      first_name: 'Ada',
      is_staff: true,
      is_superuser: false,
      last_name: 'Lovelace',
      notice: [
        {
          description: '待审核 3 项',
          href: '',
          id: 'notice-1',
          logo: '/logo.svg',
          member: '内容审核组',
          memberLink: '',
          title: '审核中心',
          updatedAt: '2026-06-13T09:00:00+08:00',
        },
      ],
      notify_count: 5,
      phone: '+8613800138000',
      phone_country_code: '+86',
      phone_national_number: '13800138000',
      signature: '保持发布节奏',
      tags: [{ key: 'ops', label: '运营' }],
      unread_count: 2,
      username: 'admin',
    });

    const result = await currentUser();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        access: 'admin',
        avatar: '/media/avatar.jpg',
        country: 'China',
        email: 'admin@example.com',
        notifyCount: 5,
        notice: [
          expect.objectContaining({ title: '审核中心' }),
        ],
        name: 'Ada Lovelace',
        phone: '+8613800138000',
        phoneCountryCode: '+86',
        phoneNationalNumber: '13800138000',
        signature: '保持发布节奏',
        tags: [{ key: 'ops', label: '运营' }],
        unreadCount: 2,
        userid: 'admin',
      }),
    );
  });
});
