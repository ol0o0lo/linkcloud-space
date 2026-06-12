import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allauthRequest, djangoGet, getAllauthErrors } = vi.hoisted(() => ({
  allauthRequest: vi.fn(),
  djangoGet: vi.fn(),
  getAllauthErrors: vi.fn(() => '发生了未预期的错误。'),
}));

vi.mock('../client', () => ({
  allauthRequest,
  djangoGet,
  getAllauthErrors,
}));

import { getPendingFlow, signupApi } from '../auth';

describe('signup api', () => {
  beforeEach(() => {
    allauthRequest.mockReset();
    djangoGet.mockReset();
    getAllauthErrors.mockClear();
  });

  it('注册直接成功时返回 session accessToken', async () => {
    allauthRequest.mockResolvedValue({ meta: { is_authenticated: true } });

    await expect(signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' })).resolves.toEqual({
      accessToken: 'session',
      pendingFlow: null,
    });
  });

  it('命中 verify_phone pending flow 时不抛错', async () => {
    allauthRequest.mockRejectedValue({
      response: { status: 401 },
      data: { data: { flows: [{ id: 'verify_phone', is_pending: true }] } },
    });

    await expect(signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' })).resolves.toEqual({
      accessToken: null,
      pendingFlow: 'verify_phone',
    });
  });

  it('其余错误继续抛出可读消息', async () => {
    allauthRequest.mockRejectedValue({ response: { status: 400 }, data: { errors: [] } });

    await expect(signupApi({ email: 'demo@example.com', password: 'pass123456', phone: '+8613800138000' })).rejects.toThrow(
      '发生了未预期的错误。',
    );
  });

  it('helper 能同时识别 data.data.flows 与 data.flows', () => {
    expect(getPendingFlow({ data: { data: { flows: [{ id: 'verify_phone', is_pending: true }] } } }, 'verify_phone')).toBe(true);
    expect(getPendingFlow({ data: { flows: [{ id: 'verify_phone', is_pending: true }] } }, 'verify_phone')).toBe(true);
  });
});
