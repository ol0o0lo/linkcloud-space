import { history } from '@umijs/max';
import { Modal } from 'antd';
import { useEffect } from 'react';

export function useUnsavedWorkbenchGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    const unblock = history.block((transition) => {
      Modal.confirm({
        title: '放弃未保存的工作台调整？',
        content: '离开后，本次排序、显隐和宽度修改不会保存。',
        okText: '放弃并离开',
        cancelText: '继续编辑',
        onOk: () => {
          unblock();
          transition.retry();
        },
      });
    });

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      unblock();
    };
  }, [active]);
}
