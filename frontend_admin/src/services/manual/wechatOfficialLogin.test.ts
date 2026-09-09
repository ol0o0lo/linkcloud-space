import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeWechatOfficialLogin,
  createWechatOfficialLoginQr,
  getWechatOfficialLoginStatus,
} from './wechatOfficialLogin';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('wechatOfficialLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('创建二维码并把登录目标提交给后端', async () => {
    mockRequest.mockResolvedValueOnce({ login_id: 'login-1' });

    await createWechatOfficialLoginQr('/rental/workbench/overview');

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/auth/wechat-official/qr/',
      expect.objectContaining({
        method: 'POST',
        data: { redirect: '/rental/workbench/overview' },
        skipErrorHandler: true,
      }),
    );
  });

  it('使用请求头中的一次性密钥查询并完成登录', async () => {
    mockRequest.mockResolvedValue({});

    await getWechatOfficialLoginStatus('login-1', 'poll-secret');
    await completeWechatOfficialLogin('login-1', 'poll-secret');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/users/auth/wechat-official/qr/login-1/',
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-WeChat-Login-Token': 'poll-secret' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/users/auth/wechat-official/qr/login-1/complete/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-WeChat-Login-Token': 'poll-secret' },
      }),
    );
  });
});
