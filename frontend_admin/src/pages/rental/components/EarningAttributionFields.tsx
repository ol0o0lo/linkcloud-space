import { LockOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useModel } from '@umijs/max';
import {
  Alert,
  Avatar,
  Button,
  Form,
  type FormInstance,
  Select,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { useTenantWorkspace } from '@/pages/space/shared';
import {
  type AllocationCapabilities,
  allocationApi,
} from '@/services/manual/allocation';

type EarningAttributionFormValues = {
  beneficiary_user_ids?: number[];
  team_id?: number | null;
};

type EarningAttributionFieldsProps<
  Values extends EarningAttributionFormValues,
> = {
  disabled?: boolean;
  enabled: boolean;
  form: FormInstance<Values>;
  onCapabilitiesChange?: (capabilities?: AllocationCapabilities) => void;
  variant?: 'compact' | 'default';
};

const useStyles = createStyles(({ css, token }) => ({
  summary: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid ${token.colorInfoBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(
      110deg,
      ${token.colorInfoBg} 0%,
      ${token.colorBgContainer} 100%
    );
  `,
  person: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  `,
  avatar: css`
    flex: 0 0 auto;
    color: ${token.colorTextLightSolid};
    background: linear-gradient(
      135deg,
      ${token.colorPrimary},
      ${token.colorPrimaryHover}
    );
  `,
  summaryCopy: css`
    min-width: 0;
  `,
  summaryName: css`
    display: block;
    overflow: hidden;
    color: ${token.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  summaryMeta: css`
    display: block;
    margin-top: 2px;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.45;
  `,
  action: css`
    flex: 0 0 auto;
    padding-inline: 6px;
  `,
  expandedHeader: css`
    display: flex;
    justify-content: flex-end;
    margin-bottom: -4px;
  `,
  locked: css`
    color: ${token.colorTextSecondary};
  `,
}));

function userDisplayName(user?: API.MeOut) {
  if (!user) return '当前操作人';
  return (
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.username ||
    user.email ||
    `用户 #${user.id}`
  );
}

function avatarText(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '我';
}

function EarningAttributionFields<Values extends EarningAttributionFormValues>({
  disabled,
  enabled,
  form,
  onCapabilitiesChange,
  variant = 'default',
}: EarningAttributionFieldsProps<Values>) {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const { initialState } = useModel('@@initialState');
  const attributionForm =
    form as unknown as FormInstance<EarningAttributionFormValues>;
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [expanded, setExpanded] = useState(variant !== 'compact');
  const selectedBeneficiaryIds =
    Form.useWatch('beneficiary_user_ids', attributionForm) || [];
  const selectedTeamId = Form.useWatch('team_id', attributionForm);
  const currentUser = initialState?.currentUser;
  const currentUserName = userDisplayName(currentUser);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearchText(searchText.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const capabilitiesQuery = useQuery({
    queryKey: ['allocation', 'capabilities', workspace.selectedOrgSlug],
    queryFn: allocationApi.getCapabilities,
    enabled: enabled && Boolean(workspace.selectedOrgSlug),
  });
  const capabilities = capabilitiesQuery.data;

  const beneficiariesQuery = useQuery({
    queryKey: [
      'allocation',
      'beneficiaries',
      workspace.selectedOrgSlug,
      debouncedSearchText,
    ],
    queryFn: () =>
      allocationApi.listBeneficiaries({
        page: 1,
        page_size: 100,
        keyword: debouncedSearchText || undefined,
      }),
    enabled:
      enabled &&
      Boolean(workspace.selectedOrgSlug) &&
      Boolean(capabilities?.change_beneficiaries),
  });

  useEffect(() => {
    onCapabilitiesChange?.(capabilities);
  }, [capabilities, onCapabilitiesChange]);

  useEffect(() => {
    if (!enabled || !currentUser?.id || !capabilities) return;
    const currentIds = attributionForm.getFieldValue('beneficiary_user_ids');
    if (!Array.isArray(currentIds) || currentIds.length === 0) {
      attributionForm.setFieldValue('beneficiary_user_ids', [currentUser.id]);
    }
    if (capabilities.signing_teams.length === 1) {
      attributionForm.setFieldValue(
        'team_id',
        capabilities.signing_teams[0].id,
      );
    } else if (capabilities.signing_teams.length === 0) {
      attributionForm.setFieldValue('team_id', null);
    }
  }, [attributionForm, capabilities, currentUser?.id, enabled]);

  useEffect(() => {
    if (variant !== 'compact' || !capabilities) return;
    const needsTeam = capabilities.signing_teams.length > 1 && !selectedTeamId;
    if (needsTeam) setExpanded(true);
  }, [capabilities, selectedTeamId, variant]);

  const beneficiaryOptions = useMemo(() => {
    const values = new Map<number, string>();
    if (currentUser?.id) values.set(currentUser.id, currentUserName);
    for (const item of beneficiariesQuery.data?.items || []) {
      values.set(item.user_id, item.name);
    }
    return Array.from(values, ([value, label]) => ({ value, label }));
  }, [beneficiariesQuery.data?.items, currentUser?.id, currentUserName]);

  const selectedBeneficiaryNames = selectedBeneficiaryIds.map(
    (id) =>
      beneficiaryOptions.find((option) => option.value === id)?.label ||
      `成员 #${id}`,
  );
  const primaryBeneficiaryName = selectedBeneficiaryNames[0] || currentUserName;
  const selectedTeam = capabilities?.signing_teams.find(
    (team) => team.id === selectedTeamId,
  );
  const teamSummary = capabilities
    ? capabilities.signing_teams.length === 0
      ? '空间收益规则'
      : selectedTeam?.name ||
        (capabilities.signing_teams.length === 1
          ? capabilities.signing_teams[0].name
          : '待选择归属团队')
    : '收益规则加载中';

  if (capabilitiesQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 2 }} title={false} />;
  }

  if (capabilitiesQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="收益归属信息加载失败"
        action={
          <Typography.Link onClick={() => capabilitiesQuery.refetch()}>
            重试
          </Typography.Link>
        }
      />
    );
  }

  if (!capabilities?.submit) {
    return (
      <Alert type="error" showIcon title="你没有提交签约收益分配申请的权限" />
    );
  }

  const teamField =
    capabilities.signing_teams.length > 1 ? (
      <Form.Item
        label="归属团队"
        name="team_id"
        rules={[{ required: true, message: '请选择本次签约的归属团队' }]}
      >
        <Select
          disabled={disabled}
          placeholder="选择你所在的团队"
          options={capabilities.signing_teams.map((team) => ({
            value: team.id,
            label: team.name,
          }))}
        />
      </Form.Item>
    ) : capabilities.signing_teams.length === 1 ? (
      <Typography.Text type="secondary">
        归属团队：{capabilities.signing_teams[0].name}
      </Typography.Text>
    ) : (
      <Typography.Text type="secondary">
        当前未加入团队，本次签约使用空间收益规则。
      </Typography.Text>
    );

  const beneficiaryField = capabilities.change_beneficiaries ? (
    <Form.Item
      label="收益归属"
      name="beneficiary_user_ids"
      rules={[{ required: true, message: '请至少选择一名收益受益人' }]}
      extra={
        selectedBeneficiaryIds.length > 1
          ? `已选择 ${selectedBeneficiaryIds.length} 人，最终可分配收益将由系统平均分配。`
          : '系统会根据当前收益规则自动计算，无需填写比例和金额。'
      }
    >
      <Select
        mode="multiple"
        allowClear
        disabled={disabled}
        maxTagCount="responsive"
        placeholder="选择当前空间的有效成员"
        options={beneficiaryOptions}
        loading={beneficiariesQuery.isFetching}
        showSearch={{ filterOption: false, onSearch: setSearchText }}
        notFoundContent={
          beneficiariesQuery.isFetching ? '搜索中…' : '未找到有效成员'
        }
      />
    </Form.Item>
  ) : (
    <>
      <Form.Item
        name="beneficiary_user_ids"
        hidden
        rules={[{ required: true }]}
      >
        <Select mode="multiple" />
      </Form.Item>
      <div>
        <Typography.Text type="secondary">收益归属</Typography.Text>
        <br />
        <Tooltip title="默认归属当前操作人。你没有修改受益人的权限。">
          <Space size={6}>
            <Typography.Text strong>{currentUserName}</Typography.Text>
            <LockOutlined aria-label="收益归属已锁定" />
          </Space>
        </Tooltip>
      </div>
    </>
  );

  if (variant !== 'compact') {
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {teamField}
        {beneficiaryField}
      </Space>
    );
  }

  if (expanded) {
    const canCollapse =
      selectedBeneficiaryIds.length > 0 &&
      (capabilities.signing_teams.length <= 1 || Boolean(selectedTeamId));
    return (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {canCollapse ? (
          <div className={styles.expandedHeader}>
            <Button
              type="link"
              size="small"
              disabled={disabled}
              onClick={() => setExpanded(false)}
            >
              收起调整
            </Button>
          </div>
        ) : null}
        {teamField}
        {beneficiaryField}
      </Space>
    );
  }

  return (
    <>
      {capabilities.signing_teams.length > 1 ? (
        <Form.Item
          name="team_id"
          hidden
          rules={[{ required: true, message: '请选择本次签约的归属团队' }]}
        >
          <Select />
        </Form.Item>
      ) : null}
      <Form.Item
        name="beneficiary_user_ids"
        hidden
        rules={[{ required: true, message: '请至少选择一名收益受益人' }]}
      >
        <Select mode="multiple" />
      </Form.Item>
      <div className={styles.summary}>
        <div className={styles.person}>
          <Avatar size={34} className={styles.avatar}>
            {avatarText(primaryBeneficiaryName)}
          </Avatar>
          <div className={styles.summaryCopy}>
            <Typography.Text strong className={styles.summaryName}>
              {primaryBeneficiaryName}
              {selectedBeneficiaryNames.length > 1
                ? ` 等 ${selectedBeneficiaryNames.length} 人`
                : ''}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.summaryMeta}>
              {teamSummary} · 按收益规则计算，提交后待审核
            </Typography.Text>
          </div>
        </div>
        {capabilities.change_beneficiaries ? (
          <Button
            type="link"
            size="small"
            disabled={disabled}
            className={styles.action}
            onClick={() => setExpanded(true)}
          >
            调整
          </Button>
        ) : (
          <Tooltip title="默认归属当前操作人。你没有修改受益人的权限。">
            <LockOutlined
              className={styles.locked}
              aria-label="收益归属已锁定"
            />
          </Tooltip>
        )}
      </div>
    </>
  );
}

export default EarningAttributionFields;
