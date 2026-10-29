import { useMutation, useQuery } from '@tanstack/react-query';
import { history, useParams } from '@umijs/max';
import { Alert, Button, Card, Result, Space, Spin, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { PageContainer } from '@/components/PageContainer';
import { houseApi } from '@/services/manual/house';

const LandlordInvitationAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const invitation = useQuery({
    queryKey: ['landlord-invitation', token],
    queryFn: () => houseApi.getLandlordInvitation(token || ''),
    enabled: Boolean(token),
    retry: false,
  });
  const acceptInvitation = useMutation({
    mutationFn: () => houseApi.acceptLandlordInvitation(token || ''),
  });

  if (!token) {
    return (
      <PageContainer>
        <Result status="error" title="邀请链接无效" />
      </PageContainer>
    );
  }

  if (invitation.isPending) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (invitation.isError || !invitation.data) {
    return (
      <PageContainer>
        <Result
          status="warning"
          title="邀请无效或已过期"
          subTitle="请联系经纪人重新发送房东邀请。"
          extra={
            <Button onClick={() => void invitation.refetch()}>重新加载</Button>
          }
        />
      </PageContainer>
    );
  }

  if (acceptInvitation.isSuccess) {
    return (
      <PageContainer>
        <Result
          status="success"
          title="房东档案已关联"
          subTitle={`已关联「${acceptInvitation.data.organization_name}」的房东档案，可查看相关房源与租约。`}
          extra={
            <Button
              type="primary"
              onClick={() => history.push('/personal-business/landlord')}
            >
              进入房东中心
            </Button>
          }
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
            title={`关联「${invitation.data.organization_name}」的房东档案`}
            subTitle={`联系人：${invitation.data.contact_name}`}
            extra={
              <Button
                type="primary"
                loading={acceptInvitation.isPending}
                onClick={() => void acceptInvitation.mutateAsync()}
              >
                接受邀请并关联
              </Button>
            }
          />
          <Space orientation="vertical" size={8} className="w-full">
            <Typography.Paragraph type="secondary" className="mb-0 text-center">
              受邀手机号：{invitation.data.invitee_phone_masked}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" className="mb-0 text-center">
              有效期至：
              {dayjs(invitation.data.expires_at).format('YYYY-MM-DD HH:mm')}
            </Typography.Paragraph>
            <Alert
              type="info"
              showIcon
              title="请使用已验证受邀手机号的账号关联房东档案；手机号不一致时无法关联。"
            />
            {acceptInvitation.isError ? (
              <Alert
                type="error"
                showIcon
                title="关联失败"
                description="请确认当前账号已验证受邀手机号，或联系经纪人重新发送邀请。"
              />
            ) : null}
          </Space>
        </Card>
      </div>
    </PageContainer>
  );
};

export default LandlordInvitationAcceptPage;
