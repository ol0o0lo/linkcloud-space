import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeWechatMiniprogramPcLogin,
  createWechatMiniprogramPcLoginQr,
  getWechatMiniprogramPcLoginStatus,
} from './wechatMiniprogramPcLogin';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('wechatMiniprogramPcLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('使用小程序码接口创建、查询并完成电脑登录', async () => {
    mockRequest.mockResolvedValue({});

    await createWechatMiniprogramPcLoginQr('/rental/workbench/overview');
    await getWechatMiniprogramPcLoginStatus('login-1', 'poll-secret');
    await completeWechatMiniprogramPcLogin('login-1', 'poll-secret');

    expect(mockRequest).toHaveBeenNthCalledWith(
      1,
      '/api/users/auth/wechat-miniprogram/qr/',
      expect.objectContaining({
        method: 'POST',
        data: { redirect: '/rental/workbench/overview' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/api/users/auth/wechat-miniprogram/qr/login-1/',
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-WeChat-Login-Token': 'poll-secret' },
      }),
    );
    expect(mockRequest).toHaveBeenNthCalledWith(
      3,
      '/api/users/auth/wechat-miniprogram/qr/login-1/complete/',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-WeChat-Login-Token': 'poll-secret' },
      }),
    );
  });
});

