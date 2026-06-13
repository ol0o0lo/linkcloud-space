import { useQuery } from '@tanstack/react-query';
import { Alert, List, Skeleton } from 'antd';
import React, { useMemo, useState } from 'react';
import type { CurrentUser } from '../data';
import { listAuthenticators, queryCurrent } from '../service';
import { SecurityModals } from './security.modals';
import type {
  AuthenticatorSummary,
  SecurityAction,
  SecurityItem,
} from './security.types';
import { buildMfaDescription, maskEmail, maskPhone } from './security.utils';

const SecurityView: React.FC = () => {
  const [activeModal, setActiveModal] = useState<SecurityAction | null>(null);

  const {
    data: currentUser,
    isLoading: currentUserLoading,
    error: currentUserError,
  } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => queryCurrent().then((res) => res.data),
  });

  const {
    data: authenticators = [],
    isLoading: authenticatorsLoading,
    error: authenticatorsError,
  } = useQuery({
    queryKey: ['security-authenticators'],
    queryFn: async () => {
      const response = await listAuthenticators();
      return (response.data || []) as AuthenticatorSummary[];
    },
  });

  const items = useMemo<SecurityItem[]>(() => {
    const user = currentUser as CurrentUser | undefined;
    return [
      {
        key: 'password',
        title: '账户密码',
        description: '已设置登录密码',
        actionText: '修改',
      },
      {
        key: 'phone',
        title: '密保手机',
        description: maskPhone(
          user?.phoneCountryCode,
          user?.phoneNationalNumber,
        ),
        actionText: user?.phoneNationalNumber ? '修改' : '绑定',
      },
      {
        key: 'email',
        title: '邮箱地址',
        description: maskEmail(user?.email),
        actionText: user?.email ? '修改' : '绑定',
      },
      {
        key: 'mfa',
        title: 'MFA 设备',
        description: buildMfaDescription(authenticators),
        actionText: authenticators.length ? '管理' : '绑定',
      },
    ];
  }, [authenticators, currentUser]);

  if (currentUserLoading || authenticatorsLoading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  return (
    <>
      {currentUserError || authenticatorsError ? (
        <Alert
          showIcon
          style={{ marginBottom: 16 }}
          type="error"
          message="安全设置加载失败，请稍后重试"
        />
      ) : null}
      <List<SecurityItem>
        itemLayout="horizontal"
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            actions={[
              <a key={item.key} onClick={() => setActiveModal(item.key)}>
                {item.actionText}
              </a>,
            ]}
          >
            <List.Item.Meta title={item.title} description={item.description} />
          </List.Item>
        )}
      />
      <SecurityModals
        activeModal={activeModal}
        currentUser={currentUser}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
};

export default SecurityView;
