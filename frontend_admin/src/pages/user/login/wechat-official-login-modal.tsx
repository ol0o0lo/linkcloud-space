import { Alert, Button, Modal, Spin, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  completeWechatOfficialLogin,
  createWechatOfficialLoginQr,
  getWechatOfficialLoginStatus,
  type WechatOfficialLoginQr,
} from '@/services/manual/wechatOfficialLogin';

type LoginPhase =
  | 'idle'
  | 'loading'
  | 'pending'
  | 'processing'
  | 'expired'
  | 'error';

type Props = {
  embedded?: boolean;
  open: boolean;
  redirectPath: string;
  onCancel: () => void;
  onAuthenticated: () => Promise<void>;
  onPendingAuthentication: (error: unknown) => Promise<boolean>;
};

function getErrorMessage(error: any, fallback: string) {
  return String(
    error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.data?.message ||
      error?.message ||
      fallback,
  );
}

const WechatOfficialLoginModal: React.FC<Props> = ({
  embedded = false,
  open,
  redirectPath,
  onCancel,
  onAuthenticated,
  onPendingAuthentication,
}) => {
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [loginQr, setLoginQr] = useState<WechatOfficialLoginQr | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [generation, setGeneration] = useState(0);
  const requestGenerationRef = useRef(0);
  const callbacksRef = useRef({
    onAuthenticated,
    onCancel,
    onPendingAuthentication,
  });

  useEffect(() => {
    callbacksRef.current = {
      onAuthenticated,
      onCancel,
      onPendingAuthentication,
    };
  }, [onAuthenticated, onCancel, onPendingAuthentication]);

  useEffect(() => {
    if (!open) {
      requestGenerationRef.current += 1;
      setPhase('idle');
      setLoginQr(null);
      setRemainingSeconds(0);
      setErrorMessage('');
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    setPhase('loading');
    setLoginQr(null);
    setErrorMessage('');

    void createWechatOfficialLoginQr(redirectPath)
      .then((qr) => {
        if (requestGenerationRef.current !== requestGeneration) return;
        setLoginQr(qr);
        setRemainingSeconds(qr.expires_in);
        setPhase('pending');
      })
      .catch((error) => {
        if (requestGenerationRef.current !== requestGeneration) return;
        setErrorMessage(
          getErrorMessage(error, '微信登录二维码生成失败，请重试。'),
        );
        setPhase('error');
      });

    return () => {
      requestGenerationRef.current += 1;
    };
  }, [generation, open, redirectPath]);

  useEffect(() => {
    if (!open || phase !== 'pending' || !loginQr) return;
    const countdown = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setPhase('expired');
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(countdown);
  }, [loginQr, open, phase]);

  useEffect(() => {
    if (!open || phase !== 'pending' || !loginQr) return;
    let stopped = false;
    let polling = false;

    const poll = async () => {
      if (polling || stopped) return;
      polling = true;
      try {
        const result = await getWechatOfficialLoginStatus(
          loginQr.login_id,
          loginQr.poll_token,
        );
        if (stopped) return;
        setRemainingSeconds(result.expires_in);
        if (result.status === 'pending') return;
        if (result.status === 'expired') {
          setPhase('expired');
          return;
        }
        if (result.status === 'failed') {
          setErrorMessage('微信登录失败，请重新获取二维码。');
          setPhase('error');
          return;
        }
        if (result.status !== 'scanned') return;
        setPhase('processing');
      } catch (error) {
        if (stopped) return;
        if ((error as any)?.response?.status === 410) {
          setPhase('expired');
          return;
        }
        setErrorMessage(
          getErrorMessage(error, '微信登录状态查询失败，请重试。'),
        );
        setPhase('error');
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(
      () => void poll(),
      Math.max(loginQr.poll_interval, 1) * 1000,
    );
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [loginQr, open, phase]);

  useEffect(() => {
    if (!open || phase !== 'processing' || !loginQr) return;
    let stopped = false;

    void completeWechatOfficialLogin(loginQr.login_id, loginQr.poll_token)
      .then(async () => {
        if (stopped) return;
        await callbacksRef.current.onAuthenticated();
        if (!stopped) callbacksRef.current.onCancel();
      })
      .catch(async (error) => {
        if (stopped) return;
        if (await callbacksRef.current.onPendingAuthentication(error)) {
          if (!stopped) callbacksRef.current.onCancel();
          return;
        }
        if (stopped) return;
        setErrorMessage(
          getErrorMessage(error, '微信登录失败，请重新获取二维码。'),
        );
        setPhase('error');
      });

    return () => {
      stopped = true;
    };
  }, [loginQr, open, phase]);

  const processing = phase === 'processing';
  const refresh = () => setGeneration((current) => current + 1);

  const content = (
    <div
      className="flex min-h-72 flex-col items-center justify-center gap-3 text-center"
      aria-live="polite"
    >
      {phase === 'loading' && (
        <Spin size="large" description="正在生成登录二维码…" />
      )}
      {phase === 'pending' && loginQr && (
        <>
          <div className="text-base font-medium">打开微信扫一扫</div>
          <img
            alt="微信公众号登录二维码"
            className="size-56 rounded-md"
            src={loginQr.qr_image_url}
            onError={() => {
              setErrorMessage('微信登录二维码加载失败，请重新获取。');
              setPhase('error');
            }}
          />
          <div>
            <div>
              <Typography.Text type="secondary">
                扫码后将在当前电脑自动登录
              </Typography.Text>
            </div>
            <div className="mt-1">
              <Typography.Text type="secondary">
                未关注公众号时，关注后将自动登录
              </Typography.Text>
            </div>
            <div className="mt-1">
              <Typography.Text type="secondary">
                二维码将在 {remainingSeconds} 秒后失效
              </Typography.Text>
            </div>
          </div>
        </>
      )}
      {phase === 'processing' && (
        <Spin size="large" description="已扫码，正在登录…" />
      )}
      {phase === 'expired' && (
        <>
          <Alert
            className="w-full"
            title="二维码已过期，请重新获取"
            type="warning"
            showIcon
          />
          <Button type="primary" onClick={refresh}>
            刷新二维码
          </Button>
        </>
      )}
      {phase === 'error' && (
        <>
          <Alert
            className="w-full"
            title={errorMessage}
            type="error"
            showIcon
          />
          <Button type="primary" onClick={refresh}>
            重新获取二维码
          </Button>
        </>
      )}
    </div>
  );

  if (embedded) {
    return open ? content : null;
  }

  return (
    <Modal
      centered
      closable={!processing}
      destroyOnHidden
      footer={null}
      keyboard={!processing}
      mask={{ closable: !processing }}
      open={open}
      title="微信扫码登录"
      width={360}
      onCancel={() => {
        if (!processing) onCancel();
      }}
    >
      {content}
    </Modal>
  );
};

export default WechatOfficialLoginModal;
