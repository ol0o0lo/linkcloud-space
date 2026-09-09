import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { history, useModel, useParams } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Popconfirm,
  Result,
  Space,
  Spin,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import { PageContainer } from '@/components/PageContainer';
import { getNavigationAccessCapabilities } from '@/services/manual/navigationAccess';
import { getTeamOperationsCapabilities } from '@/services/manual/teamOperations';
import { appsOrganizationsApiSwitchList } from '@/services/openapi/organizations';
import {
  appsOrganizationsApiAcceptInviteByKey,
  appsOrganizationsApiDeclineInviteByKey,
  appsOrganizationsApiGetInviteByKey,
} from '@/services/openapi/publicOrganizationInvites';
import { LOGIN_PATH, SPACE_PATHS } from '@/utils/adminRouting';
import { setSelectedOrgSlug } from '@/utils/orgSelection';

function inviteTargetLabel(invite?: API.PublicInviteOut) {
  if (invite?.invitee_phone) {
    return `手机号：${invite.invitee_phone}`;
  }
  if (invite?.invitee_email) {
    return `邮箱：${invite.invitee_email}`;
  }
  return '';
}

const InvitationAcceptPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const queryClient = useQueryClient();
  const { setInitialState } = useModel('@@initialState');
  const [syncWarning, setSyncWarning] = useState('');
  const redirectToLogin = () => {
    const invitationPath = `/invitations/${encodeURIComponent(key || '')}`;
    history.push(
      `${LOGIN_PATH}?redirect=${encodeURIComponent(invitationPath)}`,
    );
  };
  const handleActionError = (error: unknown) => {
    if ((error as any)?.response?.status === 401) {
      redirectToLogin();
    }
  };
  const inviteQuery = useQuery({
    queryKey: ['public-invite', key],
    queryFn: () => appsOrganizationsApiGetInviteByKey({ key: key || '' }),
    enabled: Boolean(key),
  });
  const acceptMutation = useMutation({
    mutationFn: () => appsOrganizationsApiAcceptInviteByKey({ key: key || '' }),
    onSuccess: async () => {
      try {
        const organizations = await appsOrganizationsApiSwitchList();
        const selectedOrgSlug = setSelectedOrgSlug(
          organizations.find((item) => item.is_current)?.slug,
        );
        const [teamOperationsCapabilities, navigationCapabilities] =
          await Promise.all([
            getTeamOperationsCapabilities().catch(() => undefined),
            getNavigationAccessCapabilities().catch(() => undefined),
          ]);
        queryClient.setQueryData(['tenant', 'organizations'], organizations);
        setInitialState((state) => ({
          ...state,
          organizations,
          selectedOrgSlug,
          teamOperationsCapabilities,
          navigationCapabilities,
        }));
        await queryClient.invalidateQueries({ queryKey: ['tenant'] });
      } catch {
        setSyncWarning(
          '空间已加入，但导航状态刷新失败；进入空间后如显示异常，请刷新页面。',
        );
      }
    },
    onError: handleActionError,
  });
  const declineMutation = useMutation({
    mutationFn: () =>
      appsOrganizationsApiDeclineInviteByKey({ key: key || '' }),
    onError: handleActionError,
  });

  const actionError = acceptMutation.error || declineMutation.error;
  const actionErrorMessage = actionError
    ? String(
        (actionError as any)?.response?.data?.message ||
          (actionError as any)?.data?.message ||
          (actionError as any)?.message ||
          '邀请处理失败，请稍后重试。',
      )
    : '';

  if (!key) {
    return (
      <PageContainer>
        <Result status="error" title="邀请链接无效" />
      </PageContainer>
    );
  }

  if (inviteQuery.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <PageContainer>
        <Result
          status="error"
          title="邀请不可用"
          subTitle="链接可能已失效、被取消或不存在。"
          extra={
            <Button onClick={() => void inviteQuery.refetch()}>重新加载</Button>
          }
        />
      </PageContainer>
    );
  }

  const invite = inviteQuery.data;
  if (declineMutation.isSuccess) {
    return (
      <PageContainer>
        <Result
          status="info"
          title="已拒绝邀请"
          subTitle={`你没有加入「${invite.organization_name}」。`}
          extra={
            <Button type="primary" onClick={() => history.push('/')}>
              返回管理端
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (invite.is_expired) {
    return (
      <PageContainer>
        <Result
          status="warning"
          title="邀请已过期"
          subTitle="请联系空间管理员重新发送邀请。"
        />
      </PageContainer>
    );
  }

  if (invite.is_already_member || acceptMutation.isSuccess) {
    const enterSpace = async () => {
      if (invite.is_already_member && !acceptMutation.isSuccess) {
        try {
          await acceptMutation.mutateAsync();
        } catch {
          return;
        }
      }
      history.push(SPACE_PATHS.organization);
    };

    return (
      <PageContainer>
        <Result
          status="success"
          title="已加入空间"
          subTitle={`您已成为「${invite.organization_name}」的成员。`}
          extra={
            <Button
              type="primary"
              loading={acceptMutation.isPending}
              onClick={() => void enterSpace()}
            >
              进入空间
            </Button>
          }
        />
        {syncWarning ? (
          <Alert
            className="mx-auto max-w-xl"
            type="warning"
            showIcon
            title={syncWarning}
          />
        ) : null}
        {actionErrorMessage ? (
          <Alert
            className="mx-auto max-w-xl"
            type="error"
            showIcon
            title={actionErrorMessage}
          />
        ) : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-xl py-6">
        <Card>
          <Result
            status="info"
            title={`加入空间 ${invite.organization_name}`}
            subTitle={`${invite.sender_name} 邀请您加入此空间。`}
            extra={
              <Space wrap>
                <Button
                  type="primary"
                  loading={acceptMutation.isPending}
                  disabled={declineMutation.isPending}
                  onClick={() => acceptMutation.mutate()}
                >
                  接受邀请
                </Button>
                <Popconfirm
                  title="拒绝这次空间邀请吗？"
                  description="拒绝后邀请将失效，如需加入只能请管理员重新邀请。"
                  okText="拒绝邀请"
                  cancelText="取消"
                  onConfirm={() => declineMutation.mutate()}
                >
                  <Button
                    danger
                    loading={declineMutation.isPending}
                    disabled={acceptMutation.isPending}
                  >
                    拒绝邀请
                  </Button>
                </Popconfirm>
              </Space>
            }
          />
          {actionErrorMessage ? (
            <Alert type="error" showIcon title={actionErrorMessage} />
          ) : null}
          <Typography.Paragraph type="secondary" className="mb-0 text-center">
            {inviteTargetLabel(invite)}
          </Typography.Paragraph>
          {invite.invitee_phone && (
            <Typography.Paragraph type="secondary" className="mb-0 text-center">
              请使用已验证该手机号的账号登录后接受邀请。
            </Typography.Paragraph>
          )}
        </Card>
      </div>
    </PageContainer>
  );
};

export default InvitationAcceptPage;
