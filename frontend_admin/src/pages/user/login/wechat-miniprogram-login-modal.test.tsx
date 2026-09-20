import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  create: vi.fn(),
  status: vi.fn(),
}));

vi.mock('@/services/manual/wechatMiniprogramPcLogin', () => ({
  completeWechatMiniprogramPcLogin: mocks.complete,
  createWechatMiniprogramPcLoginQr: mocks.create,
  getWechatMiniprogramPcLoginStatus: mocks.status,
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

import WechatMiniprogramLoginModal from './wechat-miniprogram-login-modal';

const qr = {
  login_id: 'login-1',
  poll_token: 'poll-token',
  qr_image_url: 'data:image/png;base64,cXI=',
  expires_in: 300,
  poll_interval: 2,
};

describe('WechatMiniprogramLoginModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue(qr);
    mocks.status.mockImplementation(() => new Promise(() => {}));
  });

  it('在登录卡片中展示小程序码', async () => {
    render(
      <WechatMiniprogramLoginModal
        embedded
        open
        redirectPath="/rental/workbench/overview"
        onAuthenticated={vi.fn()}
        onCancel={vi.fn()}
        onPendingAuthentication={vi.fn().mockResolvedValue(false)}
      />,
    );

    expect(await screen.findByText('打开微信扫一扫')).toBeInTheDocument();
    expect(await screen.findByAltText('微信小程序登录二维码')).toHaveAttribute(
      'src',
      qr.qr_image_url,
    );
    expect(screen.getByText('扫码后将在小程序中自动确认')).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith('/rental/workbench/overview');
  });

  it('小程序确认后完成电脑登录', async () => {
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    mocks.status.mockResolvedValueOnce({ status: 'scanned', expires_in: 298 });
    mocks.complete.mockResolvedValueOnce({});

    render(
      <WechatMiniprogramLoginModal
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
});
