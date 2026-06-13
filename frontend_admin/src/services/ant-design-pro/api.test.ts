import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, outLogin } from './api';

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
      '/_allauth/browser/v1/auth/login',
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
      '/_allauth/browser/v1/auth/login',
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
      '/_allauth/browser/v1/config',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/_allauth/browser/v1/auth/login',
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
      '/_allauth/browser/v1/auth/session',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-CSRFToken': 'csrf-token' }),
      }),
    );
  });
});
