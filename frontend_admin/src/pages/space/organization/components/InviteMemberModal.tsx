import { MailOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Form, Input, Modal, message, Radio, Select, Typography } from 'antd';
import React, { useState } from 'react';
import { formatPersonLabel, useTenantWorkspace } from '@/pages/space/shared';
import { appsAccessApiListOrgRoles } from '@/services/openapi/accessOrganizationRoles';
import { appsOrganizationsApiCreateInvite } from '@/services/openapi/organizationInvites';
import { appsOrganizationsApiSearchMembers } from '@/services/openapi/organizationMembers';
import { normalizeEmailLikeInput } from '@/utils/email';
import { organizationQueryKeys } from '../queryKeys';

type InviteMode = 'email' | 'phone' | 'internal';

function buildPayload(mode: InviteMode, values: API.InviteIn): API.InviteIn {
  const role = values.access_role ? { access_role: values.access_role } : {};
  if (mode === 'email')
    return {
      ...role,
      invitee_email: normalizeEmailLikeInput(values.invitee_email || ''),
    };
  if (mode === 'phone') return { ...role, invitee_phone: values.invitee_phone };
  return { ...role, invitee: values.invitee };
}

export const InviteMemberModal: React.FC<{
  canViewRoles: boolean;
  open: boolean;
  onClose: () => void;
}> = ({ canViewRoles, onClose, open }) => {
  const workspace = useTenantWorkspace();
  const [mode, setMode] = useState<InviteMode>('email');
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [form] = Form.useForm<API.InviteIn>();
  const rolesQuery = useQuery({
    queryKey: ['access', 'organization-roles', workspace.selectedOrgSlug],
    queryFn: () => appsAccessApiListOrgRoles(),
    enabled: Boolean(workspace.selectedOrgSlug && open && canViewRoles),
  });
  const candidatesQuery = useQuery({
    queryKey: [
      'organization-workspace',
      workspace.selectedOrgSlug,
      'invite-candidates',
      candidateKeyword,
    ],
    queryFn: () =>
      appsOrganizationsApiSearchMembers({ keyword: candidateKeyword }),
    enabled: open && mode === 'internal' && candidateKeyword.trim().length > 2,
  });
  const createMutation = useMutation({
    mutationFn: (payload: API.InviteIn) =>
      appsOrganizationsApiCreateInvite(payload),
    onSuccess: async () => {
      message.success('邀请已发送');
      setMode('email');
      setCandidateKeyword('');
      form.resetFields();
      onClose();
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.invites(workspace.selectedOrgSlug),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.navigation(workspace.selectedOrgSlug),
      });
    },
  });

  const close = () => {
    setMode('email');
    setCandidateKeyword('');
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="邀请成员"
      open={open}
      okText="发送邀请"
      confirmLoading={createMutation.isPending}
      onCancel={close}
      onOk={async () =>
        createMutation.mutateAsync(
          buildPayload(mode, await form.validateFields()),
        )
      }
    >
      <Typography.Paragraph type="secondary">
        邀请接受后成员会进入“未分组成员”，不会预设团队；可选预设一个组织级访问角色。
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item label="邀请方式">
          <Radio.Group
            value={mode}
            onChange={(event) => {
              setMode(event.target.value);
              form.resetFields(['invitee_email', 'invitee_phone', 'invitee']);
            }}
            options={[
              { label: '邮箱', value: 'email' },
              { label: '手机号', value: 'phone' },
              { label: '站内用户', value: 'internal' },
            ]}
          />
        </Form.Item>
        {mode === 'email' ? (
          <Form.Item
            label="邮箱"
            name="invitee_email"
            normalize={normalizeEmailLikeInput}
            rules={[
              { required: true, type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="name@example.com" />
          </Form.Item>
        ) : null}
        {mode === 'phone' ? (
          <Form.Item
            label="手机号"
            name="invitee_phone"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="例如：+8613800138000" />
          </Form.Item>
        ) : null}
        {mode === 'internal' ? (
          <Form.Item
            label="站内用户"
            name="invitee"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              showSearch={{
                filterOption: false,
                onSearch: setCandidateKeyword,
              }}
              placeholder="输入至少 3 个字符搜索"
              loading={candidatesQuery.isFetching}
              options={(candidatesQuery.data || []).map((item) => ({
                value: item.pk,
                label: `${formatPersonLabel(item)} (${item.email || item.username})`,
              }))}
            />
          </Form.Item>
        ) : null}
        {canViewRoles ? (
          <Form.Item label="预设组织角色" name="access_role">
            <Select
              allowClear
              placeholder="普通成员"
              options={(rolesQuery.data || [])
                .filter((role) => role.is_active)
                .map((role) => ({ value: role.id, label: role.name }))}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
};
