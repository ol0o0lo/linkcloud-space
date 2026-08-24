import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { history } from '@umijs/max';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type UnsavedWorkspaceRegistration,
  useUnsavedWorkspaceGuard,
} from './useUnsavedWorkspaceGuard';

vi.mock('@umijs/max', () => ({
  history: { block: vi.fn() },
}));

type Guard = ReturnType<typeof useUnsavedWorkspaceGuard>;

function renderGuard(registration: UnsavedWorkspaceRegistration) {
  const guardRef: { current?: Guard } = {};

  const Harness = () => {
    const guard = useUnsavedWorkspaceGuard(registration);
    guardRef.current = guard;
    return guard.dialog;
  };

  const result = render(<Harness />);
  return { ...result, guardRef };
}

describe('useUnsavedWorkspaceGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(history.block).mockReturnValue(vi.fn());
  });

  afterEach(cleanup);

  it('没有未保存修改时立即执行切换', async () => {
    const transition = vi.fn();
    const { guardRef } = renderGuard({ dirty: false, reset: vi.fn() });

    await act(async () => guardRef.current?.requestTransition(transition));

    expect(transition).toHaveBeenCalledOnce();
    expect(screen.queryByText('存在未保存修改')).not.toBeInTheDocument();
  });

  it('继续编辑时保留当前页面', async () => {
    const transition = vi.fn();
    const { guardRef } = renderGuard({ dirty: true, reset: vi.fn() });

    await act(async () => {
      void guardRef.current?.requestTransition(transition);
    });
    expect(screen.getByText('存在未保存修改')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));

    expect(transition).not.toHaveBeenCalled();
  });

  it('放弃修改后重置草稿并执行切换', async () => {
    const reset = vi.fn();
    const transition = vi.fn();
    const { guardRef } = renderGuard({ dirty: true, reset });

    await act(async () => {
      void guardRef.current?.requestTransition(transition);
    });
    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }));

    await waitFor(() => expect(transition).toHaveBeenCalledOnce());
    expect(reset).toHaveBeenCalledOnce();
  });

  it('保存成功后执行切换', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const transition = vi.fn();
    const { guardRef } = renderGuard({ dirty: true, reset: vi.fn(), save });

    await act(async () => {
      void guardRef.current?.requestTransition(transition);
    });
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }));

    await waitFor(() => expect(transition).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledOnce();
  });

  it('保存失败时保留当前页面', async () => {
    const transition = vi.fn();
    const { guardRef } = renderGuard({
      dirty: true,
      reset: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error('保存失败')),
    });

    await act(async () => {
      void guardRef.current?.requestTransition(transition);
    });
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }));

    await waitFor(() =>
      expect(screen.getByText('存在未保存修改')).toBeInTheDocument(),
    );
    expect(transition).not.toHaveBeenCalled();
  });

  it('存在修改时拦截浏览器离开并在卸载时解除', () => {
    const unblock = vi.fn();
    vi.mocked(history.block).mockReturnValue(unblock);
    const { unmount } = renderGuard({ dirty: true, reset: vi.fn() });
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(history.block).toHaveBeenCalledOnce();
    unmount();
    expect(unblock).toHaveBeenCalledOnce();
  });
});
