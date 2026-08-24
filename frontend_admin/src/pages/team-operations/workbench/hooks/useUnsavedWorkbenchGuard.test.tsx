import { renderHook } from '@testing-library/react';
import { Modal } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { history } from '@umijs/max';
import { useUnsavedWorkbenchGuard } from './useUnsavedWorkbenchGuard';

vi.mock('@umijs/max', () => ({
  history: { block: vi.fn() },
}));

vi.mock('antd', () => ({
  Modal: { confirm: vi.fn() },
}));

describe('useUnsavedWorkbenchGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not block navigation without unsaved changes', () => {
    renderHook(() => useUnsavedWorkbenchGuard(false));
    expect(history.block).not.toHaveBeenCalled();
  });

  it('blocks navigation and retries after confirmation', () => {
    const unblock = vi.fn();
    let blocker: ((transition: { retry: () => void }) => void) | undefined;
    vi.mocked(history.block).mockImplementation((nextBlocker) => {
      blocker = nextBlocker as typeof blocker;
      return unblock;
    });
    const retry = vi.fn();

    const { unmount } = renderHook(() => useUnsavedWorkbenchGuard(true));
    blocker?.({ retry });

    const confirmOptions = vi.mocked(Modal.confirm).mock.calls[0]?.[0];
    expect(confirmOptions?.title).toBe('放弃未保存的工作台调整？');
    confirmOptions?.onOk?.();
    expect(unblock).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();

    unmount();
  });

  it('prevents browser unload while active', () => {
    vi.mocked(history.block).mockReturnValue(vi.fn());
    const { unmount } = renderHook(() => useUnsavedWorkbenchGuard(true));
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    unmount();
  });
});
