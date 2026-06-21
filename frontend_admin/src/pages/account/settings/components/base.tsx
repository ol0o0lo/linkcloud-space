import { UploadOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Descriptions, message, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import React, { startTransition } from 'react';
import type { CurrentUser } from '../data';
import { queryCurrent, updateCurrentUser, uploadAvatar } from '../service';
import useStyles from './index.style';

const { Link } = Typography;

function formatPhone(user?: CurrentUser): string {
  if (!user?.phone_national_number) {
    return '-';
  }
  const cc = user.phone_country_code ? `+${user.phone_country_code} ` : '';
  return `${cc}${user.phone_national_number}`;
}

function avatarURL(user?: Pick<CurrentUser, 'avatar'>): string {
  return user?.avatar?.[0]?.thumbnail || user?.avatar?.[0]?.url || 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';
}

function goToSecurity(): void {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', 'security');
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  window.location.reload();
}

const BaseView: React.FC = () => {
  const { styles } = useStyles();
  const queryClient = useQueryClient();
  const { setInitialState } = useModel('@@initialState');

  const { data: currentUser, isLoading: loading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => queryCurrent().then((res) => res.data),
  });

  const syncCurrentUser = (patch: Partial<CurrentUser>) => {
    queryClient.setQueryData<CurrentUser | undefined>(['current-user'], (previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
    startTransition(() => {
      setInitialState((state) => {
        if (!state?.currentUser) {
          return state;
        }
        return {
          ...state,
          currentUser: {
            ...state.currentUser,
            ...patch,
          },
        };
      });
    });
  };

  const { mutateAsync: saveNickname, isPending: savingNickname } = useMutation({
    mutationFn: async (nickname: string) => {
      if (!currentUser?.id) {
        throw new Error('当前用户信息不存在，无法更新昵称');
      }
      await updateCurrentUser(currentUser.id, {
        last_name: nickname,
      });
      return nickname;
    },
    onSuccess: (nickname) => {
      syncCurrentUser({
        last_name: nickname,
      });
      message.success('更新基本信息成功');
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });

  const { mutateAsync: saveAvatar, isPending: savingAvatar } = useMutation({
    mutationFn: async (file: File) => {
      if (!currentUser?.id) {
        throw new Error('当前用户信息不存在，无法更新头像');
      }
      return uploadAvatar(currentUser.id, file);
    },
    onSuccess: (result) => {
      syncCurrentUser({
        avatar: result.avatar,
      });
      message.success('头像更新成功');
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });

  const handleFinish = async (values: { name?: string }) => {
    const nickname = (values.name || '').trim();
    await saveNickname(nickname);
    return true;
  };

  const handleAvatarUpload: UploadProps['customRequest'] = async (options) => {
    try {
      const result = await saveAvatar(options.file as File);
      options.onSuccess?.(result as never);
    } catch (error) {
      options.onError?.(error as Error);
    }
  };

  return (
    <div className={styles.baseView}>
      {loading ? null : (
        <>
          <div className={styles.left}>
            <ProForm
              layout="vertical"
              onFinish={handleFinish}
              submitter={{
                searchConfig: {
                  submitText: '更新基本信息',
                },
                submitButtonProps: {
                  loading: savingNickname,
                },
                render: (_, dom) => dom[1],
              }}
              initialValues={{
                ...currentUser,
                name: currentUser?.last_name || '',
              }}
              requiredMark={false}
            >
              <ProFormText
                width="md"
                name="name"
                label="昵称"
                rules={[
                  {
                    required: true,
                    message: '请输入您的昵称!',
                  },
                ]}
              />
            </ProForm>
            <Descriptions column={1} size="small" bordered style={{ marginTop: 24 }}>
              <Descriptions.Item label="邮箱">
                {currentUser?.email || '-'}{' '}
                <Link onClick={goToSecurity}>前往账号安全修改</Link>
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                {formatPhone(currentUser)}{' '}
                <Link onClick={goToSecurity}>前往账号安全修改</Link>
              </Descriptions.Item>
              <Descriptions.Item label="时区">{currentUser?.timezone || '-'}</Descriptions.Item>
            </Descriptions>
          </div>
          <div className={styles.right}>
            <AvatarView
              avatar={avatarURL(currentUser)}
              loading={savingAvatar}
              onUpload={handleAvatarUpload}
            />
          </div>
        </>
      )}
    </div>
  );
};
export default BaseView;

const AvatarView = ({
  avatar,
  loading,
  onUpload,
}: {
  avatar: string;
  loading: boolean;
  onUpload: UploadProps['customRequest'];
}) => {
  const { styles } = useStyles();

  return (
    <>
      <div className={styles.avatar_title}>头像</div>
      <div className={styles.avatar}>
        <img src={avatar} alt="avatar" />
      </div>
      <Upload
        accept="image/png,image/jpeg,image/webp"
        customRequest={onUpload}
        showUploadList={false}
      >
        <div className={styles.button_view}>
          <Button loading={loading}>
            <UploadOutlined />
            更换头像
          </Button>
        </div>
      </Upload>
    </>
  );
};
