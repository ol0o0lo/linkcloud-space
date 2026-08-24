import { EyeOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Modal,
  message,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminTableScroll, drawerWidthXl } from '@/pages/_shared/adminLayout';
import { buildingLabel, houseLabel } from '@/pages/rental/constants';
import {
  type HouseOut,
  houseApi,
  type PropertyResponsibilityUpdateIn,
} from '@/services/manual/house';
import { useTenantWorkspace } from '../../shared';
import type { UnsavedWorkspaceRegistration } from '../hooks/useUnsavedWorkspaceGuard';
import { organizationQueryKeys } from '../queryKeys';

export type UnsavedResponsibilityState = UnsavedWorkspaceRegistration;

const EMPTY_RESPONSIBILITIES: Required<PropertyResponsibilityUpdateIn> = {
  landlord_ids: [],
  building_ids: [],
  estate_ids: [],
};

function normalizeResponsibilities(
  values: PropertyResponsibilityUpdateIn,
): Required<PropertyResponsibilityUpdateIn> {
  return {
    landlord_ids: values.landlord_ids || [],
    building_ids: values.building_ids || [],
    estate_ids: values.estate_ids || [],
  };
}

function ScopeSection({
  children,
  description,
  priority,
  selectedCount,
  title,
}: {
  children: React.ReactNode;
  description: string;
  priority: number;
  selectedCount: number;
  title: string;
}) {
  return (
    <Card size="small">
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Tag color="processing">{priority}</Tag>
          <Typography.Text strong>{title}</Typography.Text>
          <Tag>{selectedCount} 项</Tag>
        </Space>
        <Typography.Text type="secondary">{description}</Typography.Text>
        {children}
        <Typography.Text type="secondary">
          留空表示不在该层分配。
        </Typography.Text>
      </Space>
    </Card>
  );
}

export const ResponsibilityEditor: React.FC<{
  editable?: boolean;
  memberId: number;
  memberName: string;
  onDirtyStateChange?: (state: UnsavedResponsibilityState) => void;
}> = ({ editable = true, memberId, memberName, onDirtyStateChange }) => {
  const workspace = useTenantWorkspace();
  const [form] = Form.useForm<PropertyResponsibilityUpdateIn>();
  const [draft, setDraft] = useState(EMPTY_RESPONSIBILITIES);
  const [pending, setPending] =
    useState<Required<PropertyResponsibilityUpdateIn> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const responsibilityQuery = useQuery({
    queryKey: organizationQueryKeys.responsibilities(
      workspace.selectedOrgSlug,
      memberId,
    ),
    queryFn: () => houseApi.getStaffResponsibility(memberId),
    enabled: Boolean(workspace.selectedOrgSlug && memberId),
  });
  const landlordOptionsQuery = useQuery({
    queryKey: ['house', 'responsibility-landlords', workspace.selectedOrgSlug],
    queryFn: () =>
      houseApi.listContacts({
        page: 1,
        page_size: 500,
        role: 'landlord',
        task: 'active',
      }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const estateOptionsQuery = useQuery({
    queryKey: ['house', 'responsibility-estates', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 500 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const buildingOptionsQuery = useQuery({
    queryKey: ['house', 'responsibility-buildings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 500 }),
    enabled: Boolean(workspace.selectedOrgSlug),
  });
  const housesQuery = useQuery({
    queryKey: [
      'house',
      'responsible-houses',
      workspace.selectedOrgSlug,
      memberId,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page: 1,
        page_size: 500,
        responsible_member_id: memberId,
      }),
    enabled: previewOpen,
  });

  const initialValues = useMemo(
    () =>
      normalizeResponsibilities({
        landlord_ids: responsibilityQuery.data?.landlords.map(
          (item) => item.id,
        ),
        building_ids: responsibilityQuery.data?.buildings.map(
          (item) => item.id,
        ),
        estate_ids: responsibilityQuery.data?.estates.map((item) => item.id),
      }),
    [responsibilityQuery.data],
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
    setDraft(initialValues);
  }, [form, initialValues]);

  const saveMutation = useMutation({
    mutationFn: (payload: PropertyResponsibilityUpdateIn) =>
      houseApi.replaceStaffResponsibilities(memberId, payload),
    onSuccess: async () => {
      message.success('员工房源分工已更新');
      setPending(null);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.responsibilities(
          workspace.selectedOrgSlug,
          memberId,
        ),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.member(
          workspace.selectedOrgSlug,
          memberId,
        ),
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['house', 'staff-responsibilities'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['house', 'responsible-houses'],
      });
    },
  });

  const reset = useCallback(() => {
    form.resetFields();
    form.setFieldsValue(initialValues);
    setDraft(initialValues);
  }, [form, initialValues]);
  const save = useCallback(async () => {
    if (!editable) return;
    await saveMutation.mutateAsync(
      normalizeResponsibilities(await form.validateFields()),
    );
  }, [editable, form, saveMutation.mutateAsync]);
  const dirty =
    editable && JSON.stringify(draft) !== JSON.stringify(initialValues);

  useEffect(() => {
    onDirtyStateChange?.({
      dirty,
      save,
      reset,
    });
  }, [dirty, onDirtyStateChange, reset, save]);

  useEffect(
    () => () => onDirtyStateChange?.({ dirty: false, reset: () => undefined }),
    [onDirtyStateChange],
  );

  const landlordOptions = (landlordOptionsQuery.data?.items || []).map(
    (item) => ({ value: item.id, label: `${item.name} · ${item.phone}` }),
  );
  const estateOptions = (estateOptionsQuery.data?.items || []).map((item) => ({
    value: item.id,
    label: item.display_name || item.name,
  }));
  const buildingOptions = (buildingOptionsQuery.data?.items || []).map(
    (item) => ({ value: item.id, label: buildingLabel(item) }),
  );

  const houseColumns: ProColumns<HouseOut>[] = [
    {
      title: '房源',
      dataIndex: 'room_number',
      render: (_value, record) => houseLabel(record),
    },
    {
      title: '房东',
      dataIndex: 'landlord',
      render: (_value, record) => record.landlord?.name || '-',
    },
    {
      title: '房态',
      dataIndex: 'status__mapping',
      align: 'center',
      width: 120,
      render: (_value, record) => record.status__mapping || record.status,
    },
  ];

  if (responsibilityQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="房源分工加载失败"
        description={(responsibilityQuery.error as Error).message}
        action={
          <Button onClick={() => responsibilityQuery.refetch()}>重试</Button>
        }
      />
    );
  }

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="分工按房东 → 楼栋 → 小区依次生效"
        description="保存会整体替换该成员现有的三层分工；查看当前负责房源只展示已保存结果。"
      />
      {!editable ? (
        <Alert
          type="info"
          showIcon
          title="房源分工为只读"
          description="当前角色没有成员分工管理权限，可以查看已保存范围和当前负责房源。"
        />
      ) : null}
      <Form<PropertyResponsibilityUpdateIn>
        form={form}
        layout="vertical"
        disabled={responsibilityQuery.isLoading || !editable}
        onValuesChange={(_changed, values) =>
          setDraft(normalizeResponsibilities(values))
        }
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <ScopeSection
            priority={1}
            title="房东范围"
            selectedCount={draft.landlord_ids.length}
            description="直接负责所选房东关联的房源，优先级最高。"
          >
            <Form.Item name="landlord_ids" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择房东"
                loading={landlordOptionsQuery.isLoading}
                options={landlordOptions}
              />
            </Form.Item>
          </ScopeSection>
          <ScopeSection
            priority={2}
            title="楼栋范围"
            selectedCount={draft.building_ids.length}
            description="仅对未命中房东范围的房源生效。"
          >
            <Form.Item name="building_ids" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择楼栋"
                loading={buildingOptionsQuery.isLoading}
                options={buildingOptions}
              />
            </Form.Item>
          </ScopeSection>
          <ScopeSection
            priority={3}
            title="小区范围"
            selectedCount={draft.estate_ids.length}
            description="仅对未命中前两层范围的房源生效。"
          >
            <Form.Item name="estate_ids" style={{ marginBottom: 0 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择小区"
                loading={estateOptionsQuery.isLoading}
                options={estateOptions}
              />
            </Form.Item>
          </ScopeSection>
        </Space>
      </Form>
      <Space wrap>
        {editable ? (
          <>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={async () =>
                setPending(
                  normalizeResponsibilities(await form.validateFields()),
                )
              }
            >
              保存分工
            </Button>
            <Button icon={<UndoOutlined />} onClick={reset}>
              恢复已保存内容
            </Button>
          </>
        ) : null}
        <Button
          icon={<EyeOutlined />}
          disabled={!responsibilityQuery.data?.responsible_house_count}
          onClick={() => setPreviewOpen(true)}
        >
          查看当前负责房源（
          {responsibilityQuery.data?.responsible_house_count || 0} 套）
        </Button>
      </Space>

      <Modal
        title="确认替换分工"
        open={editable && Boolean(pending)}
        okText={
          pending &&
          !pending.landlord_ids.length &&
          !pending.building_ids.length &&
          !pending.estate_ids.length
            ? '确认取消全部分工'
            : '确认替换分工'
        }
        okButtonProps={{
          danger: Boolean(
            pending &&
              !pending.landlord_ids.length &&
              !pending.building_ids.length &&
              !pending.estate_ids.length,
          ),
        }}
        confirmLoading={saveMutation.isPending}
        onCancel={() => setPending(null)}
        onOk={async () => pending && saveMutation.mutateAsync(pending)}
      >
        {pending &&
        !pending.landlord_ids.length &&
        !pending.building_ids.length &&
        !pending.estate_ids.length ? (
          <Alert
            type="error"
            showIcon
            title={`将取消 ${memberName} 的全部负责范围`}
            description="三层范围均为空，保存后该成员将不再负责任何房源。"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            title={`将整体替换 ${memberName} 的现有分工`}
            description={`房东 ${pending?.landlord_ids.length || 0} 项、楼栋 ${pending?.building_ids.length || 0} 项、小区 ${pending?.estate_ids.length || 0} 项。`}
          />
        )}
      </Modal>

      <Drawer
        title={`当前负责房源 · ${memberName}`}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        size={drawerWidthXl}
      >
        <ProTable<HouseOut>
          rowKey="id"
          columns={houseColumns}
          dataSource={housesQuery.data?.items || []}
          loading={housesQuery.isLoading}
          search={false}
          options={false}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Drawer>
    </Space>
  );
};
