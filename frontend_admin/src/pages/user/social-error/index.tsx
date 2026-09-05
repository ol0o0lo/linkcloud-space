import { Link, useSearchParams } from '@umijs/max';
import { Result } from 'antd';
import React from 'react';

const SocialLoginErrorPage: React.FC = () => {
  const [params] = useSearchParams();
  const detail = params.get('error') || '第三方账号授权未完成，请重试。';
  return (
    <Result
      status="error"
      title="第三方登录失败"
      subTitle={detail}
      extra={<Link to="/user/login">返回登录</Link>}
    />
  );
};

export default SocialLoginErrorPage;
