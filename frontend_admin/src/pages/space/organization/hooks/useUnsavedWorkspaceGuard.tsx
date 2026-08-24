import { history } from '@umijs/max';
import { Button, Modal, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export type UnsavedWorkspaceRegistration = {
  dirty: boolean;
  reset: () => void;
  save?: () => Promise<void>;
};

type PendingTransition = {
  resolve: (continued: boolean) => void;
  transition: () => void | Promise<void>;
};

export function useUnsavedWorkspaceGuard(
  registration: UnsavedWorkspaceRegistration,
) {
  const registrationRef = useRef(registration);
  const bypassRef = useRef(false);
  const [pending, setPending] = useState<PendingTransition>();
  const [saving, setSaving] = useState(false);
  registrationRef.current = registration;

  const requestTransition = useCallback(
    async (transition: () => void | Promise<void>) => {
      if (!registrationRef.current.dirty) {
        await transition();
        return true;
      }

      return new Promise<boolean>((resolve) => {
        setPending({ resolve, transition });
      });
    },
    [],
  );

  const continueEditing = () => {
    pending?.resolve(false);
    setPending(undefined);
  };

  const executePending = async () => {
    if (!pending) return;
    const current = pending;
    setPending(undefined);
    bypassRef.current = true;
    try {
      await current.transition();
      current.resolve(true);
    } finally {
      queueMicrotask(() => {
        bypassRef.current = false;
      });
    }
  };

  const discardAndContinue = async () => {
    registrationRef.current.reset();
    await executePending();
  };

  const saveAndContinue = async () => {
    const save = registrationRef.current.save;
    if (!save) return;
    setSaving(true);
    try {
      await save();
      await executePending();
    } catch (_error) {
      // 请求层负责展示保存失败原因；保留弹窗和草稿供用户继续处理。
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!registration.dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    const unblock = history.block((transition) => {
      if (bypassRef.current) {
        bypassRef.current = false;
        unblock();
        transition.retry();
        return;
      }
      void requestTransition(() => {
        unblock();
        transition.retry();
      });
    });

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      unblock();
    };
  }, [registration.dirty, requestTransition]);

  return {
    dialog: (
      <Modal
        open={Boolean(pending)}
        title="存在未保存修改"
        closable={false}
        mask={{ closable: false }}
        onCancel={continueEditing}
        footer={[
          <Button key="continue" onClick={continueEditing}>
            继续编辑
          </Button>,
          <Button
            key="discard"
            danger
            onClick={() => void discardAndContinue()}
          >
            放弃修改
          </Button>,
          registration.save ? (
            <Button
              key="save"
              type="primary"
              loading={saving}
              onClick={() => void saveAndContinue()}
            >
              保存并继续
            </Button>
          ) : null,
        ]}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          切换后当前草稿会丢失。你可以继续编辑、放弃修改，或先保存再继续。
        </Typography.Paragraph>
      </Modal>
    ) as React.ReactNode,
    requestTransition,
  };
}
