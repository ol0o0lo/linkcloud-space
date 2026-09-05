import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Col,
  Form,
  type FormInstance,
  Input,
  Row,
  Segmented,
  Select,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import type { ContactOut } from '@/services/manual/house';
import { houseApi } from '@/services/manual/house';
import { CONTACT_ROLE, contactLabel } from '../constants';
import { usePagedSelectOptions } from '../usePagedSelectOptions';

export type DealSigningTenantMode = 'identity' | 'existing';

export type DealSigningTenantValues = {
  tenant_mode: DealSigningTenantMode;
  tenant_id?: number;
  tenant_identity?: {
    name?: string;
    phone?: string;
  };
};

type DealSigningTenantFieldsProps<Values extends DealSigningTenantValues> = {
  disabled?: boolean;
  enabled: boolean;
  form: FormInstance<Values>;
  onModeChange?: () => void;
  open: boolean;
  organizationSlug?: string;
};

const useStyles = createStyles(({ css, token }) => ({
  modeControl: css`
    padding: 3px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  fields: css`
    margin-top: 16px;
  `,
  matchHint: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;

    > svg {
      flex: 0 0 auto;
      color: ${token.colorSuccess};
    }
  `,
  selection: css`
    margin-top: 16px;
  `,
}));

function normalizePhoneForMatch(value?: string) {
  const compact = (value || '').trim().replace(/[\s-]/g, '');
  return compact.startsWith('+86') && compact.length === 14
    ? compact.slice(3)
    : compact;
}

function DealSigningTenantFields<Values extends DealSigningTenantValues>({
  disabled,
  enabled,
  form,
  onModeChange,
  open,
  organizationSlug,
}: DealSigningTenantFieldsProps<Values>) {
  const { styles } = useStyles();
  const tenantForm = form as unknown as FormInstance<DealSigningTenantValues>;
  const mode = Form.useWatch('tenant_mode', tenantForm) || 'identity';
  const selectedTenantId = Form.useWatch('tenant_id', tenantForm);
  const tenantName = Form.useWatch(['tenant_identity', 'name'], tenantForm);
  const tenantPhone = Form.useWatch(['tenant_identity', 'phone'], tenantForm);
  const [matchIdentity, setMatchIdentity] = useState({ name: '', phone: '' });

  useEffect(() => {
    if (mode !== 'identity' || !tenantName?.trim() || !tenantPhone?.trim()) {
      setMatchIdentity({ name: '', phone: '' });
      return;
    }
    const timer = window.setTimeout(
      () =>
        setMatchIdentity({
          name: tenantName.trim(),
          phone: tenantPhone.trim(),
        }),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [mode, tenantName, tenantPhone]);

  const tenantSelect = usePagedSelectOptions<ContactOut>({
    enabled: open && enabled,
    getOptionLabel: contactLabel,
    getSelectedFallbackLabel: (id) => `租客 #${id}`,
    queryKey: ['house', 'deal-signing', 'tenants', organizationSlug],
    queryFn: (params) =>
      houseApi.listContacts({
        ...params,
        role: CONTACT_ROLE.TENANT,
        task: 'active',
      }),
    selectedIds: [selectedTenantId],
  });
  const exactMatchQuery = useQuery({
    queryKey: [
      'house',
      'deal-signing',
      'tenant-match',
      organizationSlug,
      matchIdentity.name,
      normalizePhoneForMatch(matchIdentity.phone),
    ],
    queryFn: () =>
      houseApi.listContacts({
        role: CONTACT_ROLE.TENANT,
        task: 'active',
        keyword: matchIdentity.phone,
        page: 1,
        page_size: 20,
      }),
    enabled:
      open &&
      enabled &&
      mode === 'identity' &&
      Boolean(matchIdentity.name && matchIdentity.phone),
    staleTime: 30_000,
  });
  const exactMatch = useMemo(
    () =>
      exactMatchQuery.data?.items.find(
        (contact) =>
          contact.name.trim() === matchIdentity.name &&
          normalizePhoneForMatch(contact.phone) ===
            normalizePhoneForMatch(matchIdentity.phone),
      ),
    [exactMatchQuery.data?.items, matchIdentity],
  );

  const handleModeChange = (value: string | number) => {
    const nextMode = value as DealSigningTenantMode;
    tenantForm.setFieldValue('tenant_mode', nextMode);
    if (nextMode === 'identity')
      tenantForm.setFieldValue('tenant_id', undefined);
    else tenantForm.setFieldValue('tenant_identity', undefined);
    onModeChange?.();
  };

  return (
    <>
      <Form.Item name="tenant_mode" hidden>
        <Input />
      </Form.Item>
      <Segmented
        block
        disabled={disabled}
        className={styles.modeControl}
        value={mode}
        options={[
          { label: '手动填写', value: 'identity' },
          { label: '选择已有租客', value: 'existing' },
        ]}
        onChange={handleModeChange}
      />

      {mode === 'identity' ? (
        <Row gutter={[16, 0]} className={styles.fields}>
          <Col xs={24} md={12}>
            <Form.Item
              label="租客姓名"
              name={['tenant_identity', 'name']}
              normalize={(value) => value?.replace(/^\s+/, '')}
              rules={[{ required: true, message: '请输入租客姓名' }]}
            >
              <Input
                allowClear
                disabled={disabled}
                maxLength={100}
                placeholder="例如：王小明"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="手机号码"
              name={['tenant_identity', 'phone']}
              normalize={(value) => value?.replace(/^\s+/, '')}
              rules={[{ required: true, message: '请输入手机号码' }]}
              extra={
                exactMatch ? (
                  <span className={styles.matchHint}>
                    <AppIcon name="contact" width={14} height={14} />
                    将关联已有租客：{exactMatch.name}
                  </span>
                ) : undefined
              }
            >
              <Input
                allowClear
                disabled={disabled}
                maxLength={32}
                inputMode="tel"
                placeholder="请输入常用手机号"
              />
            </Form.Item>
          </Col>
        </Row>
      ) : (
        <div className={styles.selection}>
          {tenantSelect.isError ? (
            <Alert
              type="error"
              showIcon
              title="租客列表加载失败"
              action={
                <Typography.Link onClick={() => tenantSelect.refetch()}>
                  重试
                </Typography.Link>
              }
              style={{ marginBottom: 12 }}
            />
          ) : null}
          <Form.Item
            label="已有租客"
            name="tenant_id"
            rules={[{ required: true, message: '请选择租客' }]}
          >
            <Select
              aria-label="已有租客"
              disabled={disabled}
              placeholder="按姓名或手机号搜索"
              options={tenantSelect.options}
              loading={tenantSelect.loading}
              notFoundContent={tenantSelect.notFoundContent}
              showSearch={tenantSelect.showSearch}
              onOpenChange={tenantSelect.onOpenChange}
              onPopupScroll={tenantSelect.onPopupScroll}
            />
          </Form.Item>
        </div>
      )}
    </>
  );
}

export default DealSigningTenantFields;
