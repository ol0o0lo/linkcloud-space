import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasskeyManager } from './passkey-manager';

const mocks = vi.hoisted(() => ({
  createPasskey: vi.fn(),
  deletePasskey: vi.fn(),
  reauthenticate: vi.fn(),
  reauthenticateWithPasskey: vi.fn(),
  renamePasskey: vi.fn(),
}));

vi.mock('../service', () => mocks);

describe('PasskeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPasskey.mockResolvedValue({
      authenticator: { id: 11, type: 'webauthn', name: '办公 MacBook' },
      recoveryCodesGenerated: true,
    });
    mocks.renamePasskey.mockResolvedValue({});
    mocks.deletePasskey.mockResolvedValue({});
    mocks.reauthenticateWithPasskey.mockResolvedValue({});
  });

  it('可以添加通行密钥并在首次启用时展示恢复码', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const onRecoveryCodesGenerated = vi.fn().mockResolvedValue(undefined);
    render(
      <PasskeyManager
        authenticators={[]}
        loading={false}
        onError={vi.fn()}
        onRecoveryCodesGenerated={onRecoveryCodesGenerated}
        onRefresh={onRefresh}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '添加通行密钥' }));
    fireEvent.change(screen.getByPlaceholderText('例如：办公 MacBook'), {
      target: { value: '办公 MacBook' },
    });
    const submitButtons = screen.getAllByRole('button', {
      name: '添加通行密钥',
    });
    fireEvent.click(submitButtons.at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(mocks.createPasskey).toHaveBeenCalledWith('办公 MacBook');
      expect(onRefresh).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
      expect(onRecoveryCodesGenerated).toHaveBeenCalled();
    });
  });

  it('可以重命名和删除已有通行密钥', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    render(
      <PasskeyManager
        authenticators={[
          {
            id: 9,
            type: 'webauthn',
            name: '旧名称',
            is_passwordless: true,
          },
        ]}
        loading={false}
        onError={vi.fn()}
        onRecoveryCodesGenerated={vi.fn()}
        onRefresh={onRefresh}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重命名' }));
    fireEvent.change(screen.getByDisplayValue('旧名称'), {
      target: { value: '新名称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));
    await waitFor(() => {
      expect(mocks.renamePasskey).toHaveBeenCalledWith(9, '新名称');
    });

    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    fireEvent.click(screen.getByRole('button', { name: '删除通行密钥' }));
    await waitFor(() => {
      expect(mocks.deletePasskey).toHaveBeenCalledWith(9);
    });
  });

  it('无密码场景可使用已有通行密钥重新验证后继续操作', async () => {
    mocks.createPasskey
      .mockRejectedValueOnce({
        response: {
          status: 401,
          data: { flows: [{ id: 'reauthenticate', is_pending: true }] },
        },
      })
      .mockResolvedValueOnce({
        authenticator: { id: 10, type: 'webauthn', name: '备用设备' },
        recoveryCodesGenerated: false,
      });

    render(
      <PasskeyManager
        authenticators={[
          {
            id: 9,
            type: 'webauthn',
            name: '现有 Passkey',
            is_passwordless: true,
          },
        ]}
        loading={false}
        onError={vi.fn()}
        onRecoveryCodesGenerated={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onSuccess={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '添加通行密钥' }));
    fireEvent.change(screen.getByPlaceholderText('例如：办公 MacBook'), {
      target: { value: '备用设备' },
    });
    const submitButtons = screen.getAllByRole('button', {
      name: '添加通行密钥',
    });
    fireEvent.click(submitButtons.at(-1) as HTMLButtonElement);

    fireEvent.click(
      await screen.findByRole('button', { name: '使用通行密钥验证' }),
    );

    await waitFor(() => {
      expect(mocks.reauthenticateWithPasskey).toHaveBeenCalled();
      expect(mocks.createPasskey).toHaveBeenCalledTimes(2);
    });
  });
});
