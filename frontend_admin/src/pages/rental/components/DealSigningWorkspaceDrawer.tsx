import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Collapse,
  Drawer,
  Flex,
  Form,
  Grid,
  Input,
  Modal,
  message,
  Select,
  Space,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { drawerWidthXl } from '@/pages/_shared/adminLayout';
import { useTenantWorkspace } from '@/pages/space/shared';
import type { AllocationCapabilities } from '@/services/manual/allocation';
import {
  type DealSigningCreateInput,
  type HouseOut,
  houseApi,
  type LeaseOut,
  type ViewingRecordOut,
} from '@/services/manual/house';
import {
  HOUSE_MEDIA_RESOURCE_TYPE,
  HOUSE_MEDIA_TYPE,
  HOUSE_STATUS,
  houseLabel,
} from '../constants';
import { usePagedSelectOptions } from '../usePagedSelectOptions';
import DealSigningHero from './DealSigningHero';
import DealSigningLeaseFields, {
  type DealSigningAutoFilledField,
  type DealSigningDepositMode,
  type DealSigningLeaseTerm,
} from './DealSigningLeaseFields';
import DealSigningSection from './DealSigningSection';
import DealSigningTenantFields, {
  type DealSigningTenantValues,
} from './DealSigningTenantFields';
import EarningAttributionFields from './EarningAttributionFields';
import MediaRefsUpload from './MediaRefsUpload';

type DealSigningFormValues = DealSigningTenantValues & {
  house_id?: number;
  source_viewing_record_id?: number | null;
  start_date: string;
  end_date: string;
  monthly_rent: string;
  deposit?: string | null;
  payment_day: number;
  contract_files?: Record<string, unknown>[];
  notes?: string;
  beneficiary_user_ids: number[];
  team_id?: number | null;
};

type DealSigningDrawerProps = {
  house?: HouseOut | null;
  houseId?: number;
  onClose: () => void;
  onSuccess?: (lease: LeaseOut) => void;
  open: boolean;
  sourceViewing?: ViewingRecordOut | null;
};

const useStyles = createStyles(({ css, token }) => ({
  formPanel: css`
    min-width: 0;
    padding: 16px;
    background:
      linear-gradient(
        180deg,
        ${token.colorFillQuaternary} 0%,
        ${token.colorBgLayout} 180px
      ),
      ${token.colorBgLayout};

    @media (max-width: ${token.screenMD}px) {
      padding: 12px;
    }
  `,
  workspaceGrid: css`
    display: grid;
    grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);
    gap: 14px;
    align-items: start;

    @media (max-width: ${token.screenLG - 1}px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  column: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 14px;

    @media (max-width: ${token.screenLG - 1}px) {
      display: contents;
    }
  `,
  slot: css`
    min-width: 0;
  `,
  tenantSlot: css`
    order: 1;
  `,
  leaseSlot: css`
    order: 2;
  `,
  earningsSlot: css`
    order: 3;
  `,
  optionalSlot: css`
    order: 4;
  `,
  houseSelectorLabel: css`
    display: block;
    margin-bottom: 6px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  houseSelector: css`
    max-width: 440px;
    margin-bottom: 0;
  `,
  sourcePanel: css`
    margin-bottom: 16px;
    padding: 10px 11px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
  `,
  sourceRow: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  `,
  sourceIdentity: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  `,
  sourceIcon: css`
    display: grid;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    place-items: center;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  sourceCopy: css`
    min-width: 0;
  `,
  sourceTitle: css`
    display: block;
    color: ${token.colorText};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  sourceMeta: css`
    display: block;
    overflow: hidden;
    margin-top: 1px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  sourceAction: css`
    flex: 0 0 auto;
    padding-inline: 4px;
  `,
  sourceControl: css`
    margin-top: 10px;
    margin-bottom: 0;
  `,
  optionalCollapse: css`
    overflow: hidden;
    border: 1px dashed ${token.colorBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};

    .ant-collapse-header {
      align-items: center !important;
      padding: 13px 16px !important;
    }

    .ant-collapse-content {
      border-top-color: ${token.colorBorderSecondary};
    }

    .ant-collapse-content-box {
      padding: 16px !important;
    }
  `,
  optionalLabel: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  `,
  optionalIcon: css`
    display: grid;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    place-items: center;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillTertiary};
  `,
  optionalCopy: css`
    min-width: 0;
  `,
  optionalMeta: css`
    display: block;
    margin-top: 1px;
    font-size: ${token.fontSizeSM}px;
  `,
  fullWidth: css`
    width: 100%;
  `,
  footerNote: css`
    display: flex;
    align-items: center;
    gap: 7px;

    > svg {
      flex: 0 0 auto;
    }
  `,
  primaryAction: css`
    &.ant-btn-primary:not(:disabled) {
      background: linear-gradient(
        135deg,
        ${token.colorPrimary},
        ${token.colorPrimaryHover}
      );
      box-shadow: ${token.boxShadowSecondary};
    }
  `,
  errorAlert: css`
    margin-bottom: 14px;
  `,
}));

function formatDateInputValue(value: dayjs.Dayjs) {
  return value.format('YYYY-MM-DD');
}

function calculateEndDate(startDate: string, months: number) {
  return dayjs(startDate)
    .add(months, 'month')
    .subtract(1, 'day')
    .format('YYYY-MM-DD');
}

function stringAmount(value?: string | number | null) {
  return value === undefined || value === null || value === ''
    ? undefined
    : String(value);
}

const DEPOSIT_MONTHS_BY_MODE: Partial<Record<DealSigningDepositMode, number>> =
  {
    one_month: 1,
    two_months: 2,
    three_months: 3,
  };

function amountToCents(value?: string | number | null) {
  const amount = stringAmount(value)?.trim();
  const matched = amount?.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!matched) return undefined;
  const fraction = (matched[2] || '').padEnd(2, '0');
  return BigInt(matched[1]) * BigInt(100) + BigInt(fraction || '0');
}

function formatCents(value: bigint) {
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, '0')}`;
}

function multiplyAmount(
  value: string | number | null | undefined,
  multiplier: number,
) {
  const cents = amountToCents(value);
  return cents === undefined ? null : formatCents(cents * BigInt(multiplier));
}

function resolveDepositMode(
  monthlyRent?: string | number | null,
  deposit?: string | number | null,
): DealSigningDepositMode {
  const depositCents = amountToCents(deposit);
  if (depositCents === undefined || depositCents === BigInt(0)) return 'none';

  const monthlyRentCents = amountToCents(monthlyRent);
  if (monthlyRentCents !== undefined) {
    for (const [mode, months] of Object.entries(DEPOSIT_MONTHS_BY_MODE)) {
      if (depositCents === monthlyRentCents * BigInt(months)) {
        return mode as DealSigningDepositMode;
      }
    }
  }
  return 'custom';
}

function getDealSigningInitialValues(options: {
  house?: HouseOut | null;
  houseId?: number;
  sourceViewing?: ViewingRecordOut | null;
}): DealSigningFormValues {
  const { house, houseId, sourceViewing } = options;
  const startDate = dayjs();
  return {
    house_id: house?.id || houseId || sourceViewing?.house_id,
    source_viewing_record_id: sourceViewing?.id,
    tenant_mode: sourceViewing?.contact_id ? 'existing' : 'identity',
    tenant_id: sourceViewing?.contact_id || undefined,
    tenant_identity: sourceViewing?.contact_id
      ? undefined
      : {
          name: sourceViewing?.customer_name || undefined,
          phone: sourceViewing?.customer_phone || undefined,
        },
    start_date: formatDateInputValue(startDate),
    end_date: formatDateInputValue(
      startDate.add(12, 'month').subtract(1, 'day'),
    ),
    monthly_rent: stringAmount(house?.asking_rent) || '',
    deposit: stringAmount(house?.deposit_amount),
    payment_day: startDate.date(),
    beneficiary_user_ids: [],
  };
}

function mutationErrorText(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : '成交签约提交失败，请核对信息后重试。';
}

const DealSigningWorkspaceDrawer: React.FC<DealSigningDrawerProps> = ({
  house,
  houseId,
  onClose,
  onSuccess,
  open,
  sourceViewing,
}) => {
  const { styles } = useStyles();
  const screens = Grid.useBreakpoint();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<DealSigningFormValues>();
  const [dirty, setDirty] = useState(false);
  const [leaseTerm, setLeaseTerm] = useState<DealSigningLeaseTerm>('12');
  const [depositMode, setDepositMode] =
    useState<DealSigningDepositMode>('custom');
  const [allocationCapabilities, setAllocationCapabilities] =
    useState<AllocationCapabilities>();
  const [sourceViewingExpanded, setSourceViewingExpanded] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<
    DealSigningAutoFilledField[]
  >([]);
  const autoFillTimer = useRef<number | null>(null);
  const enabled = Boolean(workspace.selectedOrgSlug);
  const selectedHouseId = Form.useWatch('house_id', form);
  const selectedSourceViewingId = Form.useWatch(
    'source_viewing_record_id',
    form,
  );
  const contractFiles = Form.useWatch('contract_files', form) || [];
  const notes = Form.useWatch('notes', form);
  const fixedHouseId = house?.id || houseId || sourceViewing?.house_id;
  const resolvedHouseId = selectedHouseId || fixedHouseId;
  const houseLocked = Boolean(fixedHouseId);
  const sourceViewingLocked = Boolean(sourceViewing?.id);

  const highlightAutoFilled = useCallback(
    (...fields: DealSigningAutoFilledField[]) => {
      if (autoFillTimer.current) window.clearTimeout(autoFillTimer.current);
      setAutoFilledFields(fields);
      autoFillTimer.current = window.setTimeout(
        () => setAutoFilledFields([]),
        170,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (autoFillTimer.current) window.clearTimeout(autoFillTimer.current);
    },
    [],
  );

  const houseLookup = useQuery({
    queryKey: [
      'house',
      'deal-signing',
      'house',
      workspace.selectedOrgSlug,
      resolvedHouseId,
    ],
    queryFn: () => houseApi.getHouse(resolvedHouseId as number),
    enabled:
      open &&
      enabled &&
      Boolean(resolvedHouseId) &&
      house?.id !== resolvedHouseId,
  });
  const houseSelect = usePagedSelectOptions<HouseOut>({
    enabled: open && enabled && !houseLocked,
    getOptionLabel: houseLabel,
    getSelectedFallbackLabel: (id) => `房源 #${id}`,
    pinnedItems: [house, houseLookup.data],
    queryKey: ['house', 'deal-signing', 'houses', workspace.selectedOrgSlug],
    queryFn: (params) => houseApi.listHouses(params),
    selectedIds: [resolvedHouseId],
  });
  const sourceViewingSelect = usePagedSelectOptions<ViewingRecordOut>({
    enabled: open && enabled && !sourceViewingLocked,
    getOptionLabel: (item) => `${item.customer_name} / ${houseLabel(item)}`,
    getSelectedFallbackLabel: (id) => `成交带看 #${id}`,
    pinnedItems: [sourceViewing],
    queryKey: [
      'house',
      'deal-signing',
      'source-viewings',
      workspace.selectedOrgSlug,
    ],
    queryFn: (params) =>
      houseApi.listViewingRecords({
        ...params,
        pending_lease: true,
        contact_missing: false,
      }),
    selectedIds: [selectedSourceViewingId],
  });
  const selectedSourceViewing =
    sourceViewingSelect.items.find(
      (item) => item.id === selectedSourceViewingId,
    ) ||
    (sourceViewing?.id === selectedSourceViewingId ? sourceViewing : undefined);
  const resolvedHouse =
    (house?.id === resolvedHouseId ? house : undefined) ||
    houseSelect.items.find((item) => item.id === resolvedHouseId) ||
    houseLookup.data;
  const inactiveHouse = resolvedHouse?.status === HOUSE_STATUS.INACTIVE;
  const houseDisplayName = resolvedHouse
    ? houseLabel(resolvedHouse)
    : resolvedHouseId
      ? `房源 #${resolvedHouseId}`
      : '选择本次成交房源';

  useEffect(() => {
    if (!open) return;
    const initialValues = getDealSigningInitialValues({
      house,
      houseId: fixedHouseId,
      sourceViewing,
    });
    form.resetFields();
    form.setFieldsValue(initialValues);
    setLeaseTerm('12');
    setDepositMode(
      resolveDepositMode(initialValues.monthly_rent, initialValues.deposit),
    );
    setSourceViewingExpanded(false);
    setOptionalOpen(false);
    setAutoFilledFields([]);
    setDirty(false);
  }, [fixedHouseId, form, house, open, sourceViewing]);

  useEffect(() => {
    if (!open || !resolvedHouse) return;
    if (form.getFieldValue('house_id') !== resolvedHouse.id) return;
    const highlighted: DealSigningAutoFilledField[] = [];
    const monthlyRent = form.getFieldValue('monthly_rent');
    const deposit = form.getFieldValue('deposit');
    if (!monthlyRent) {
      form.setFieldValue(
        'monthly_rent',
        stringAmount(resolvedHouse.asking_rent) || '',
      );
      highlighted.push('monthly_rent');
    }
    if (deposit === undefined) {
      const nextDeposit = stringAmount(resolvedHouse.deposit_amount);
      form.setFieldValue('deposit', nextDeposit);
      setDepositMode(
        resolveDepositMode(resolvedHouse.asking_rent, nextDeposit),
      );
      highlighted.push('deposit');
    }
    if (highlighted.length) highlightAutoFilled(...highlighted);
  }, [form, highlightAutoFilled, open, resolvedHouse]);

  const closeImmediately = () => {
    setDirty(false);
    setOptionalOpen(false);
    setSourceViewingExpanded(false);
    form.resetFields();
    onClose();
  };

  const requestClose = () => {
    if (saveDealSigning.isPending) return;
    if (!dirty) {
      closeImmediately();
      return;
    }
    Modal.confirm({
      title: '放弃本次成交签约？',
      content: '已填写的租约信息不会保留。',
      okText: '放弃填写',
      cancelText: '继续填写',
      onOk: closeImmediately,
    });
  };

  const saveDealSigning = useMutation({
    mutationFn: (values: DealSigningFormValues) => {
      const {
        beneficiary_user_ids,
        house_id,
        team_id,
        tenant_mode,
        tenant_id,
        tenant_identity,
        ...leaseFields
      } = values;
      if (!house_id) throw new Error('请选择房源');
      const normalizedLeaseFields = { ...leaseFields, house_id };
      let lease: DealSigningCreateInput['lease'];
      if (tenant_mode === 'existing') {
        if (!tenant_id) throw new Error('请选择租客');
        lease = { ...normalizedLeaseFields, tenant_id };
      } else {
        const name = tenant_identity?.name?.trim() || '';
        const phone = tenant_identity?.phone?.trim() || '';
        if (!name || !phone) throw new Error('请填写租客姓名和手机号码');
        lease = {
          ...normalizedLeaseFields,
          tenant_identity: { name, phone },
        };
      }
      const payload: DealSigningCreateInput = {
        lease,
        team_id: team_id ?? null,
        beneficiary_user_ids,
      };
      return houseApi.createDealSigning(payload);
    },
    onSuccess: async (result) => {
      message.success(
        '成交签约完成，租约已生效，房态已更新为已出租；收益等待审核。',
      );
      form.resetFields();
      setDirty(false);
      onSuccess?.(result.lease);
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['house', 'houses'] }),
        queryClient.invalidateQueries({ queryKey: ['house', 'leases'] }),
        queryClient.invalidateQueries({ queryKey: ['house', 'statistics'] }),
        queryClient.invalidateQueries({ queryKey: ['allocation'] }),
      ]);
    },
  });

  const handleCapabilitiesChange = useCallback(
    (capabilities?: AllocationCapabilities) =>
      setAllocationCapabilities(capabilities),
    [],
  );

  const applyHouseAmounts = (nextHouse?: HouseOut) => {
    if (!nextHouse) return;
    const monthlyRent = stringAmount(nextHouse.asking_rent) || '';
    const deposit = stringAmount(nextHouse.deposit_amount);
    form.setFieldsValue({ monthly_rent: monthlyRent, deposit });
    setDepositMode(resolveDepositMode(monthlyRent, deposit));
    highlightAutoFilled('monthly_rent', 'deposit');
  };

  const handleHouseChange = (nextHouseId?: number) => {
    form.setFieldValue('house_id', nextHouseId);
    const nextHouse = houseSelect.items.find((item) => item.id === nextHouseId);
    applyHouseAmounts(nextHouse);
    if (
      selectedSourceViewing &&
      selectedSourceViewing.house_id !== nextHouseId
    ) {
      form.setFieldValue('source_viewing_record_id', undefined);
    }
    setDirty(true);
  };

  const handleSourceViewingChange = (nextViewingId?: number) => {
    form.setFieldValue('source_viewing_record_id', nextViewingId);
    const nextViewing = sourceViewingSelect.items.find(
      (item) => item.id === nextViewingId,
    );
    if (nextViewing) {
      form.setFieldsValue({
        house_id: nextViewing.house_id,
        tenant_id: nextViewing.contact_id || undefined,
        tenant_identity: undefined,
        tenant_mode: 'existing',
      });
      const nextHouse = houseSelect.items.find(
        (item) => item.id === nextViewing.house_id,
      );
      applyHouseAmounts(nextHouse);
    }
    setDirty(true);
  };

  const handleLeaseTermChange = (value: string | number) => {
    const nextTerm = value as DealSigningLeaseTerm;
    setLeaseTerm(nextTerm);
    if (nextTerm !== 'custom') {
      const startDate = form.getFieldValue('start_date');
      if (startDate) {
        form.setFieldValue(
          'end_date',
          calculateEndDate(startDate, Number(nextTerm)),
        );
        highlightAutoFilled('end_date');
      }
    }
    setDirty(true);
  };

  const handleDepositModeChange = (value: string | number) => {
    const nextMode = value as DealSigningDepositMode;
    setDepositMode(nextMode);
    if (nextMode === 'none') form.setFieldValue('deposit', null);
    const depositMonths = DEPOSIT_MONTHS_BY_MODE[nextMode];
    if (depositMonths) {
      form.setFieldValue(
        'deposit',
        multiplyAmount(form.getFieldValue('monthly_rent'), depositMonths),
      );
    }
    if (nextMode !== 'custom') highlightAutoFilled('deposit');
    setDirty(true);
  };

  const handleValuesChange = (
    changedValues: Partial<DealSigningFormValues>,
  ) => {
    setDirty(true);
    if (changedValues.start_date) {
      const highlighted: DealSigningAutoFilledField[] = [];
      if (leaseTerm !== 'custom') {
        form.setFieldValue(
          'end_date',
          calculateEndDate(changedValues.start_date, Number(leaseTerm)),
        );
        highlighted.push('end_date');
      }
      form.setFieldValue('payment_day', dayjs(changedValues.start_date).date());
      if (highlighted.length) highlightAutoFilled(...highlighted);
    }
    if (changedValues.end_date) setLeaseTerm('custom');
    const depositMonths = DEPOSIT_MONTHS_BY_MODE[depositMode];
    if ('monthly_rent' in changedValues && depositMonths) {
      form.setFieldValue(
        'deposit',
        multiplyAmount(changedValues.monthly_rent, depositMonths),
      );
      highlightAutoFilled('deposit');
    }
    if ('deposit' in changedValues) setDepositMode('custom');
  };

  const optionalDetails = [
    contractFiles.length ? `已上传 ${contractFiles.length} 个文件` : '',
    notes?.trim() ? '已填写备注' : '',
  ].filter(Boolean);
  const optionalSummary = optionalDetails.length
    ? optionalDetails.join(' · ')
    : '选填，可成交后补充';
  const sourceSummary = sourceViewingLocked
    ? sourceViewing
      ? `${sourceViewing.customer_name} / ${houseLabel(sourceViewing)}`
      : `成交带看 #${selectedSourceViewingId}`
    : selectedSourceViewing
      ? `${selectedSourceViewing.customer_name} / ${houseLabel(selectedSourceViewing)}`
      : '关联已成交且尚未签约的带看记录';

  const drawerFooter = (
    <Flex
      gap="small"
      justify="space-between"
      align={screens.sm ? 'center' : 'stretch'}
      vertical={!screens.sm}
    >
      <Typography.Text type="secondary" className={styles.footerNote}>
        <AppIcon
          name="house"
          state={HOUSE_STATUS.RENTED}
          width={17}
          height={17}
        />
        将创建生效租约，并把房态更新为已出租
      </Typography.Text>
      <Flex gap="small" vertical={!screens.sm}>
        <Button disabled={saveDealSigning.isPending} onClick={requestClose}>
          取消
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          form="deal-signing-form"
          loading={saveDealSigning.isPending}
          className={styles.primaryAction}
          disabled={
            !resolvedHouse ||
            inactiveHouse ||
            houseLookup.isError ||
            !allocationCapabilities?.submit
          }
        >
          确认成交并生效
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <Drawer
      title="登记签约"
      open={open}
      size={drawerWidthXl}
      destroyOnHidden
      footer={drawerFooter}
      closable={{ disabled: saveDealSigning.isPending }}
      mask={{ closable: !saveDealSigning.isPending }}
      styles={{ body: { padding: 0 } }}
      onClose={requestClose}
    >
      <main className={styles.formPanel}>
        <Form
          form={form}
          id="deal-signing-form"
          layout="vertical"
          preserve={false}
          scrollToFirstError={{ focus: true }}
          onValuesChange={handleValuesChange}
          onFinish={(values) => saveDealSigning.mutate(values)}
          onFinishFailed={({ errorFields }) => {
            if (
              errorFields.some(({ name }) =>
                ['contract_files', 'notes'].includes(String(name[0])),
              )
            ) {
              setOptionalOpen(true);
            }
          }}
        >
          {saveDealSigning.isError ? (
            <Alert
              className={styles.errorAlert}
              type="error"
              showIcon
              title={mutationErrorText(saveDealSigning.error)}
            />
          ) : null}
          {houseLookup.isError && resolvedHouseId ? (
            <Alert
              className={styles.errorAlert}
              type="error"
              showIcon
              title="房源信息加载失败"
              description="请重新选择房源，或关闭后重试。"
            />
          ) : null}
          {inactiveHouse ? (
            <Alert
              className={styles.errorAlert}
              type="error"
              showIcon
              title="已停用房源不能成交签约"
              description="请先恢复房源状态，再重新发起成交签约。"
            />
          ) : null}

          {houseLocked ? (
            <Form.Item name="house_id" hidden>
              <Input />
            </Form.Item>
          ) : null}
          <DealSigningHero
            displayName={houseDisplayName}
            house={resolvedHouse}
            houseId={resolvedHouseId}
            loading={houseLookup.isFetching}
            selector={
              houseLocked ? undefined : (
                <>
                  <Typography.Text className={styles.houseSelectorLabel}>
                    {resolvedHouse ? '更换房源' : '选择房源'}
                  </Typography.Text>
                  <Form.Item
                    name="house_id"
                    className={styles.houseSelector}
                    rules={[{ required: true, message: '请选择房源' }]}
                  >
                    <Select
                      aria-label="房源"
                      disabled={saveDealSigning.isPending}
                      placeholder="按房号、小区或楼栋搜索"
                      options={houseSelect.options}
                      loading={houseSelect.loading}
                      notFoundContent={houseSelect.notFoundContent}
                      showSearch={houseSelect.showSearch}
                      onChange={handleHouseChange}
                      onOpenChange={houseSelect.onOpenChange}
                      onPopupScroll={houseSelect.onPopupScroll}
                    />
                  </Form.Item>
                </>
              )
            }
          />

          <div className={styles.workspaceGrid}>
            <div className={styles.column}>
              <div className={`${styles.slot} ${styles.tenantSlot}`}>
                <DealSigningSection
                  step="01"
                  title="租客资料"
                  description="填写新租客，或关联已有联系人"
                  icon={<AppIcon name="contact" width={18} height={18} />}
                >
                  {sourceViewingLocked ? (
                    <Form.Item name="source_viewing_record_id" hidden>
                      <Input />
                    </Form.Item>
                  ) : null}
                  <div className={styles.sourcePanel}>
                    <div className={styles.sourceRow}>
                      <div className={styles.sourceIdentity}>
                        <span className={styles.sourceIcon} aria-hidden="true">
                          <AppIcon name="viewing" width={16} height={16} />
                        </span>
                        <div className={styles.sourceCopy}>
                          <Typography.Text className={styles.sourceTitle}>
                            成交带看（可选）
                          </Typography.Text>
                          <Typography.Text className={styles.sourceMeta}>
                            {sourceSummary}
                          </Typography.Text>
                        </div>
                      </div>
                      {!sourceViewingLocked ? (
                        <Button
                          type="link"
                          size="small"
                          disabled={saveDealSigning.isPending}
                          className={styles.sourceAction}
                          onClick={() => setSourceViewingExpanded(true)}
                        >
                          {selectedSourceViewing ? '更换记录' : '选择记录'}
                        </Button>
                      ) : null}
                    </div>
                    {!sourceViewingLocked && sourceViewingExpanded ? (
                      <Form.Item
                        name="source_viewing_record_id"
                        className={styles.sourceControl}
                      >
                        <Select
                          allowClear
                          aria-label="成交带看"
                          disabled={saveDealSigning.isPending}
                          placeholder="选择已成交且尚未签约的带看记录"
                          options={sourceViewingSelect.options}
                          loading={sourceViewingSelect.loading}
                          notFoundContent={sourceViewingSelect.notFoundContent}
                          showSearch={sourceViewingSelect.showSearch}
                          onChange={handleSourceViewingChange}
                          onOpenChange={sourceViewingSelect.onOpenChange}
                          onPopupScroll={sourceViewingSelect.onPopupScroll}
                        />
                      </Form.Item>
                    ) : null}
                  </div>

                  <DealSigningTenantFields
                    disabled={saveDealSigning.isPending}
                    enabled={enabled}
                    form={form}
                    open={open}
                    organizationSlug={workspace.selectedOrgSlug}
                    onModeChange={() => setDirty(true)}
                  />
                </DealSigningSection>
              </div>

              <div className={`${styles.slot} ${styles.earningsSlot}`}>
                <DealSigningSection
                  step="03"
                  title="收益归属"
                  description="默认归属当前操作人，可按权限调整"
                  icon={
                    <AppIcon name="allocation-request" width={18} height={18} />
                  }
                >
                  <EarningAttributionFields
                    disabled={saveDealSigning.isPending}
                    enabled={open && enabled}
                    form={form}
                    variant="compact"
                    onCapabilitiesChange={handleCapabilitiesChange}
                  />
                </DealSigningSection>
              </div>
            </div>

            <div className={styles.column}>
              <div className={`${styles.slot} ${styles.leaseSlot}`}>
                <DealSigningSection
                  step="02"
                  title="租期与金额"
                  description="确认周期、租金与押金，付款日自动按起租日"
                  icon={<AppIcon name="lease" width={18} height={18} />}
                >
                  <DealSigningLeaseFields
                    autoFilledFields={autoFilledFields}
                    depositMode={depositMode}
                    disabled={saveDealSigning.isPending}
                    leaseTerm={leaseTerm}
                    onDepositModeChange={handleDepositModeChange}
                    onLeaseTermChange={handleLeaseTermChange}
                  />
                </DealSigningSection>
              </div>

              <div className={`${styles.slot} ${styles.optionalSlot}`}>
                <Collapse
                  activeKey={optionalOpen ? ['optional'] : []}
                  className={styles.optionalCollapse}
                  expandIconPlacement="end"
                  onChange={(keys) =>
                    setOptionalOpen(
                      Array.isArray(keys)
                        ? keys.includes('optional')
                        : keys === 'optional',
                    )
                  }
                  items={[
                    {
                      key: 'optional',
                      label: (
                        <div className={styles.optionalLabel}>
                          <span
                            className={styles.optionalIcon}
                            aria-hidden="true"
                          >
                            <AppIcon name="lease" width={17} height={17} />
                          </span>
                          <div className={styles.optionalCopy}>
                            <Typography.Text strong>
                              合同与内部备注
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              className={styles.optionalMeta}
                            >
                              {optionalSummary}
                            </Typography.Text>
                          </div>
                        </div>
                      ),
                      children: (
                        <Space
                          orientation="vertical"
                          size={16}
                          className={styles.fullWidth}
                        >
                          <Form.Item
                            label="合同文件"
                            name="contract_files"
                            style={{ marginBottom: 0 }}
                          >
                            <MediaRefsUpload
                              resourceType={
                                HOUSE_MEDIA_RESOURCE_TYPE.LEASE_CONTRACT
                              }
                              mediaType={HOUSE_MEDIA_TYPE.FILE}
                              maxCount={1}
                            />
                          </Form.Item>
                          <Form.Item
                            label="内部备注"
                            name="notes"
                            style={{ marginBottom: 0 }}
                          >
                            <Input.TextArea
                              rows={3}
                              maxLength={500}
                              showCount
                              disabled={saveDealSigning.isPending}
                              placeholder="记录付款约定、交接事项等内部信息"
                            />
                          </Form.Item>
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </Form>
      </main>
    </Drawer>
  );
};

export default DealSigningWorkspaceDrawer;
