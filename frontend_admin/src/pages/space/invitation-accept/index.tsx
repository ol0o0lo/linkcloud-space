import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from '@umijs/max';
import { Button, Card, Result, Spin, Typography } from 'antd';
import React from 'react';
import { PageContainer } from '@/components/PageContainer';
import {
  appsOrganizationsApiAcceptInviteByKey,
  appsOrganizationsApiGetInviteByKey,
} from '@/services/openapi/publicOrganizationInvites';

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
  const inviteQuery = useQuery({
    queryKey: ['public-invite', key],
    queryFn: () => appsOrganizationsApiGetInviteByKey({ key: key || '' }),
    enabled: Boolean(key),
  });
  const acceptMutation = useMutation({
    mutationFn: () => appsOrganizationsApiAcceptInviteByKey({ key: key || '' }),
  });

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
    return (
      <PageContainer>
        <Result
          status="success"
          title="已加入空间"
          subTitle={`您已成为「${invite.organization_name}」的成员。`}
        />
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
              <Button
                type="primary"
                loading={acceptMutation.isPending}
                onClick={() => void acceptMutation.mutateAsync()}
              >
                接受邀请
              </Button>
            }
          />
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
