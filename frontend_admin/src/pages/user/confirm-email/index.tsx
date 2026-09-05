import { Link, useParams } from '@umijs/max';
import { Result, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  confirmPublicEmail,
  getPublicAuthErrorMessage,
} from '@/services/manual/publicAuth';

const ConfirmEmailPage: React.FC = () => {
  const { key = '' } = useParams<{ key: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let decodedKey = key;
    try {
      decodedKey = decodeURIComponent(key);
    } catch {
      decodedKey = key;
    }
    void confirmPublicEmail(decodedKey)
      .then(() => {
        if (active) setState('success');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          getPublicAuthErrorMessage(
            requestError,
            '验证链接无效或已过期，请登录后重新发送验证邮件。',
          ),
        );
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [key]);

  if (state === 'loading') {
    return <Spin fullscreen size="large" description="正在验证邮箱…" />;
  }

  return (
    <Result
      status={state === 'success' ? 'success' : 'error'}
      title={state === 'success' ? '邮箱验证成功' : '邮箱验证失败'}
      subTitle={state === 'error' ? error : '该邮箱已完成验证。'}
      extra={<Link to="/user/login">返回登录</Link>}
    />
  );
};

export default ConfirmEmailPage;
