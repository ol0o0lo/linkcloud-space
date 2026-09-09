import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  create: vi.fn(),
  status: vi.fn(),
}));

vi.mock('@/services/manual/wechatOfficialLogin', () => ({
  completeWechatOfficialLogin: mocks.complete,
  createWechatOfficialLoginQr: mocks.create,
  getWechatOfficialLoginStatus: mocks.status,
}));

vi.mock('antd', () => ({
  Alert: ({ title }: any) => <div>{title}</div>,
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Modal: ({ children, open, title }: any) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
  Spin: ({ description }: any) => <div>{description}</div>,
  Typography: {
    Text: ({ children }: any) => <span>{children}</span>,
  },
}));

import WechatOfficialLoginModal from './wechat-official-login-modal';

const qr = {
  login_id: 'login-1',
  poll_token: 'poll-token',
  qr_image_url: 'https://mp.weixin.qq.com/qr/test',
  expires_in: 300,
  poll_interval: 2,
};

describe('WechatOfficialLoginModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(qr);
    mocks.status.mockImplementation(() => new Promise(() => {}));
  });

  it('在站内弹窗展示公众号二维码', async () => {
    render(
      <WechatOfficialLoginModal
        open
        redirectPath="/rental/workbench/overview"
        onAuthenticated={vi.fn()}
        onCancel={vi.fn()}
        onPendingAuthentication={vi.fn().mockResolvedValue(false)}
      />,
    );

    expect(
      await screen.findByRole('dialog', { name: '微信扫码登录' }),
    ).toBeInTheDocument();
    expect(await screen.findByAltText('微信公众号登录二维码')).toHaveAttribute(
      'src',
      qr.qr_image_url,
    );
    expect(mocks.create).toHaveBeenCalledWith('/rental/workbench/overview');
  });

  it('支持直接嵌入登录卡片展示二维码', async () => {
    render(
      <WechatOfficialLoginModal
        embedded
        open
        redirectPath="/rental/workbench/overview"
        onAuthenticated={vi.fn()}
        onCancel={vi.fn()}
        onPendingAuthentication={vi.fn().mockResolvedValue(false)}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('打开微信扫一扫')).toBeInTheDocument();
    expect(await screen.findByAltText('微信公众号登录二维码')).toHaveAttribute(
      'src',
      qr.qr_image_url,
    );
  });

  it('扫码后完成登录并通知登录页恢复状态', async () => {
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    mocks.status.mockResolvedValueOnce({ status: 'scanned', expires_in: 298 });
    mocks.complete.mockResolvedValueOnce({});

    render(
      <WechatOfficialLoginModal
        open
        redirectPath="/rental/workbench/overview"
        onAuthenticated={onAuthenticated}
        onCancel={onCancel}
        onPendingAuthentication={vi.fn().mockResolvedValue(false)}
      />,
    );

    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith('login-1', 'poll-token'),
    );
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('完成登录返回待处理认证流程时交还登录页继续处理', async () => {
    const pendingFlowError = {
      response: {
        status: 401,
        data: {
          flows: [
            { id: 'mfa_authenticate', is_pending: true, types: ['totp'] },
          ],
        },
      },
    };
    const onPendingAuthentication = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    mocks.status.mockResolvedValueOnce({ status: 'scanned', expires_in: 298 });
    mocks.complete.mockRejectedValueOnce(pendingFlowError);

    render(
      <WechatOfficialLoginModal
        open
        redirectPath="/rental/workbench/overview"
        onAuthenticated={vi.fn()}
        onCancel={onCancel}
        onPendingAuthentication={onPendingAuthentication}
      />,
    );

    await waitFor(() =>
      expect(onPendingAuthentication).toHaveBeenCalledWith(pendingFlowError),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
