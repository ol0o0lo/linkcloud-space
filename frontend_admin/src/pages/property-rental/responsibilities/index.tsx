import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  message,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthLg,
  drawerWidthXl,
  ResponsiveActions,
} from '@/pages/_shared/adminLayout';
import {
  formatPersonLabel,
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/tenant/shared';
import {
  type HouseOut,
  houseApi,
  type PropertyResponsibilityOut,
  type PropertyResponsibilityUpdateIn,
} from '@/services/manual/house';
import { buildingLabel, houseLabel } from '../constants';
import { getLoadingAwareEmptyState, isInitialQueryPending } from '../loading';

const PAGE_SIZE = 20;

const EMPTY_RESPONSIBILITIES: Required<PropertyResponsibilityUpdateIn> = {
  building_ids: [],
  estate_ids: [],
  landlord_ids: [],
};

function normalizeResponsibilities(
  values: PropertyResponsibilityUpdateIn,
): Required<PropertyResponsibilityUpdateIn> {
  return {
    building_ids: values.building_ids || [],
    estate_ids: values.estate_ids || [],
    landlord_ids: values.landlord_ids || [],
  };
}

function ResponsibilityScopeSummaryItem({
  color,
  items,
  title,
}: {
  color: string;
  items: { id: number; label: string }[];
  title: string;
}) {
  return (
    <Space size={[4, 4]} wrap>
      <Typography.Text type="secondary">{title}</Typography.Text>
      {items.length ? (
        <>
          <Tag color={color}>{items.length} 项</Tag>
          {items.slice(0, 2).map((item) => (
            <Tag key={item.id}>{item.label}</Tag>
          ))}
          {items.length > 2 ? <Typography.Text type="secondary">+{items.length - 2}</Typography.Text> : null}
        </>
      ) : (
        <Typography.Text type="secondary">未分配</Typography.Text>
      )}
    </Space>
  );
}

function ResponsibilityScopeSummary({
  record,
}: {
  record: PropertyResponsibilityOut;
}) {
  return (
    <Space orientation="vertical" size={4}>
      <ResponsibilityScopeSummaryItem
        title="房东"
        color="blue"
        items={record.landlords.map((item) => ({ id: item.id, label: item.name }))}
      />
      <ResponsibilityScopeSummaryItem
        title="楼栋"
        color="cyan"
        items={record.buildings.map((item) => ({ id: item.id, label: buildingLabel(item) }))}
      />
      <ResponsibilityScopeSummaryItem
        title="小区"
        color="green"
        items={record.estates.map((item) => ({ id: item.id, label: item.display_name || item.name }))}
      />
    </Space>
  );
}

function ResponsibilityScopeSection({
  children,
  color,
  description,
  priority,
  selectedCount,
  title,
}: {
  children: React.ReactNode;
  color: string;
  description: string;
  priority: number;
  selectedCount: number;
  title: string;
}) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Tag color={color}>{priority}</Tag>
          <Typography.Text strong>{title}</Typography.Text>
          <Tag>{selectedCount} 项</Tag>
        </Space>
        <Typography.Text type="secondary">{description}</Typography.Text>
        {children}
        <Typography.Text type="secondary">留空表示不在该层分配。</Typography.Text>
      </Space>
    </Card>
  );
}

function selectedOptionLabels(
  ids: number[],
  options: { label: string; value: number }[],
) {
  const labels = new Map(options.map((option) => [option.value, option.label]));
  return ids.map((id) => labels.get(id) || `#${id}`);
}

const StaffResponsibilitiesPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState<string>();
  const [searchDraft, setSearchDraft] = useState('');
  const [editing, setEditing] = useState<PropertyResponsibilityOut | null>(
    null,
  );
  const [previewing, setPreviewing] =
    useState<PropertyResponsibilityOut | null>(null);
  const [form] = Form.useForm<PropertyResponsibilityUpdateIn>();
  const [draftResponsibilities, setDraftResponsibilities] = useState(
    EMPTY_RESPONSIBILITIES,
  );
  const [pendingResponsibilities, setPendingResponsibilities] = useState<Required<PropertyResponsibilityUpdateIn> | null>(null);
  const enabled = Boolean(workspace.selectedOrgSlug);

  const responsibilities = useQuery({
    queryKey: [
      'house',
      'staff-responsibilities',
      workspace.selectedOrgSlug,
      page,
      keyword,
    ],
    queryFn: () =>
      houseApi.listStaffResponsibilities({
        page,
        page_size: PAGE_SIZE,
        keyword,
      }),
    enabled,
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
    enabled: enabled && Boolean(editing),
  });

  const estateOptionsQuery = useQuery({
    queryKey: ['house', 'responsibility-estates', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listEstates({ page: 1, page_size: 500 }),
    enabled: enabled && Boolean(editing),
  });

  const buildingOptionsQuery = useQuery({
    queryKey: ['house', 'responsibility-buildings', workspace.selectedOrgSlug],
    queryFn: () => houseApi.listBuildings({ page: 1, page_size: 500 }),
    enabled: enabled && Boolean(editing),
  });

  const responsibleHouses = useQuery({
    queryKey: [
      'house',
      'responsible-houses',
      workspace.selectedOrgSlug,
      previewing?.member_id,
    ],
    queryFn: () =>
      houseApi.listHouses({
        page: 1,
        page_size: 500,
        responsible_member_id: previewing?.member_id,
      }),
    enabled: enabled && Boolean(previewing),
  });

  useEffect(() => {
    if (!editing) return;
    const values = normalizeResponsibilities({
      landlord_ids: editing.landlords.map((item) => item.id),
      building_ids: editing.buildings.map((item) => item.id),
      estate_ids: editing.estates.map((item) => item.id),
    });
    form.setFieldsValue(values);
    setDraftResponsibilities(values);
  }, [editing, form]);

  const saveResponsibilities = useMutation({
    mutationFn: (payload: PropertyResponsibilityUpdateIn) => {
      if (!editing) throw new Error('请选择员工');
      return houseApi.replaceStaffResponsibilities(editing.member_id, payload);
    },
    onSuccess: async () => {
      message.success('员工负责范围已更新');
      setEditing(null);
      setPendingResponsibilities(null);
      setDraftResponsibilities(EMPTY_RESPONSIBILITIES);
      form.resetFields();
      await workspace.queryClient.invalidateQueries({
        queryKey: ['house', 'staff-responsibilities'],
      });
      await workspace.queryClient.invalidateQueries({
        queryKey: ['house', 'responsible-houses'],
      });
    },
  });

  const landlordOptions = useMemo(
    () =>
      (landlordOptionsQuery.data?.items || []).map((item) => ({
        value: item.id,
        label: `${item.name} · ${item.phone}`,
      })),
    [landlordOptionsQuery.data?.items],
  );
  const estateOptions = useMemo(
    () =>
      (estateOptionsQuery.data?.items || []).map((item) => ({
        value: item.id,
        label: item.display_name || item.name,
      })),
    [estateOptionsQuery.data?.items],
  );
  const buildingOptions = useMemo(
    () =>
      (buildingOptionsQuery.data?.items || []).map((item) => ({
        value: item.id,
        label: buildingLabel(item),
      })),
    [buildingOptionsQuery.data?.items],
  );

  const columns: ProColumns<PropertyResponsibilityOut>[] = [
    {
      title: '员工',
      dataIndex: 'user',
      width: 220,
      render: (_value, record) => (
        <Space>
          <Avatar src={record.user.avatar_url}>
            {formatPersonLabel(record.user).slice(0, 1)}
          </Avatar>
          <div>
            <Typography.Text strong>
              {formatPersonLabel(record.user)}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary">
              {record.user.email || record.user.username}
            </Typography.Text>
          </div>
          {record.is_owner ? <Tag color="gold">所有者</Tag> : null}
        </Space>
      ),
    },
    {
      title: '负责范围',
      dataIndex: 'responsibility_scope',
      width: 360,
      render: (_value, record) => <ResponsibilityScopeSummary record={record} />,
    },
    {
      title: '负责房源',
      dataIndex: 'responsible_house_count',
      width: 100,
      align: 'right',
      render: (_value, record) => `${record.responsible_house_count} 套`,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 180,
      render: (_value, record) => (
        <ResponsiveActions>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
          onClick={() => setEditing(record)}
          >
            配置分工
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            disabled={record.responsible_house_count === 0}
            onClick={() => setPreviewing(record)}
          >
            查看房源
          </Button>
        </ResponsiveActions>
      ),
    },
  ];

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
      width: 100,
      render: (_value, record) => record.status__mapping || record.status,
    },
  ];

  const listLoading = isInitialQueryPending(responsibilities);
  const emptyState = (
    <Typography.Text type="secondary">
      当前空间还没有可分配的员工，请先在空间成员中添加员工。
    </Typography.Text>
  );

  return (
    <TenantSelectionGuard title="员工分工">
      <Card>
        <ProTable<PropertyResponsibilityOut>
          rowKey="member_id"
          loading={listLoading}
          columns={columns}
          dataSource={responsibilities.data?.items || []}
          search={false}
          options={false}
          toolBarRender={() => [
            <Input.Search
              key="keyword"
              allowClear
              placeholder="搜索员工姓名 / 账号 / 邮箱"
              value={searchDraft}
              onChange={(event) => {
                const value = event.target.value;
                setSearchDraft(value);
                if (!value && keyword) {
                  setPage(1);
                  setKeyword(undefined);
                }
              }}
              onSearch={(value) => {
                setPage(1);
                setKeyword(value.trim() || undefined);
              }}
              style={{ width: 300 }}
            />,
          ]}
          locale={{
            emptyText: getLoadingAwareEmptyState({
              loading: listLoading,
              loadingTitle: '员工分工加载中',
              loadingDescription: '正在汇总员工、房东、小区和负责房源。',
              emptyState,
            }),
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: responsibilities.data?.total || 0,
            onChange: setPage,
          }}
          scroll={adminTableScroll}
        />
      </Card>

      <Drawer
        title={
          editing
            ? `配置分工 · ${formatPersonLabel(editing.user)}`
            : '配置分工'
        }
        open={Boolean(editing)}
        size={drawerWidthLg}
        destroyOnHidden
        onClose={() => {
          setEditing(null);
          setPendingResponsibilities(null);
          setDraftResponsibilities(EMPTY_RESPONSIBILITIES);
          form.resetFields();
        }}
        extra={
          <Button
            type="primary"
            htmlType="submit"
            form="property-responsibility-form"
            loading={saveResponsibilities.isPending}
          >
            保存分工
          </Button>
        }
      >
        <div style={{ margin: '0 4px 16px' }}>
          <Space size={6} wrap>
            <Typography.Text type="secondary">分配顺序</Typography.Text>
            <Tag color="blue" bordered={false}>房东</Tag>
            <Typography.Text type="secondary" aria-hidden>
              →
            </Typography.Text>
            <Tag color="cyan" bordered={false}>楼栋</Tag>
            <Typography.Text type="secondary" aria-hidden>
              →
            </Typography.Text>
            <Tag color="green" bordered={false}>小区</Tag>
          </Space>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            同一房源会归属至最先命中的范围；保存前还可再次确认。
          </Typography.Text>
        </div>
        <Form<PropertyResponsibilityUpdateIn>
          id="property-responsibility-form"
          form={form}
          layout="vertical"
          initialValues={{ landlord_ids: [], building_ids: [], estate_ids: [] }}
          onValuesChange={(_changedValues, values) => setDraftResponsibilities(normalizeResponsibilities(values))}
          onFinish={(values) => setPendingResponsibilities(normalizeResponsibilities(values))}
        >
          <ResponsibilityScopeSection
            priority={1}
            title="房东范围"
            color="blue"
            selectedCount={draftResponsibilities.landlord_ids.length}
            description="直接负责所选房东的关联房源，优先级最高。"
          >
            <Form.Item name="landlord_ids" style={{ marginBottom: 0 }}>
              <Select
                aria-label="房东范围"
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择房东"
                loading={landlordOptionsQuery.isLoading}
                options={landlordOptions}
              />
            </Form.Item>
          </ResponsibilityScopeSection>
          <ResponsibilityScopeSection
            priority={2}
            title="楼栋范围"
            color="cyan"
            selectedCount={draftResponsibilities.building_ids.length}
            description="补充分配，仅对未命中房东范围的房源生效。"
          >
            <Form.Item name="building_ids" style={{ marginBottom: 0 }}>
              <Select
                aria-label="楼栋范围"
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择楼栋"
                loading={buildingOptionsQuery.isLoading}
                options={buildingOptions}
              />
            </Form.Item>
          </ResponsibilityScopeSection>
          <ResponsibilityScopeSection
            priority={3}
            title="小区范围"
            color="green"
            selectedCount={draftResponsibilities.estate_ids.length}
            description="兜底分配，仅对未命中前两层范围的房源生效。"
          >
            <Form.Item name="estate_ids" style={{ marginBottom: 0 }}>
              <Select
                aria-label="小区范围"
                mode="multiple"
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                maxTagCount="responsive"
                placeholder="选择小区"
                loading={estateOptionsQuery.isLoading}
                options={estateOptions}
              />
            </Form.Item>
          </ResponsibilityScopeSection>
        </Form>
      </Drawer>

      <Modal
        title="确认替换分工"
        open={Boolean(pendingResponsibilities)}
        okText="确认替换分工"
        cancelText="返回修改"
        confirmLoading={saveResponsibilities.isPending}
        onCancel={() => setPendingResponsibilities(null)}
        onOk={async () => {
          if (!pendingResponsibilities) return;
          await saveResponsibilities.mutateAsync(pendingResponsibilities);
        }}
      >
        {pendingResponsibilities ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {pendingResponsibilities.landlord_ids.length || pendingResponsibilities.building_ids.length || pendingResponsibilities.estate_ids.length ? (
              <Alert
                type="warning"
                showIcon
                title="本次保存会完全替换该员工现有分工"
                description="请核对以下三个层级的选择后再确认。"
              />
            ) : (
              <Alert
                type="error"
                showIcon
                title="取消全部负责范围"
                description="确认后，该员工将不再负责任何房东、楼栋或小区范围。"
              />
            )}
            {[
              {
                title: '房东范围',
                labels: selectedOptionLabels(pendingResponsibilities.landlord_ids, landlordOptions),
              },
              {
                title: '楼栋范围',
                labels: selectedOptionLabels(pendingResponsibilities.building_ids, buildingOptions),
              },
              {
                title: '小区范围',
                labels: selectedOptionLabels(pendingResponsibilities.estate_ids, estateOptions),
              },
            ].map((scope) => (
              <div key={scope.title}>
                <Typography.Text strong>{scope.title}</Typography.Text>
                <Typography.Text type="secondary"> · {scope.labels.length} 项</Typography.Text>
                <div>
                  {scope.labels.length ? scope.labels.join('、') : <Typography.Text type="secondary">未分配</Typography.Text>}
                </div>
              </div>
            ))}
          </Space>
        ) : null}
      </Modal>

      <Drawer
        title={
          previewing
            ? `${formatPersonLabel(previewing.user)}负责的房源`
            : '负责房源'
        }
        open={Boolean(previewing)}
        size={drawerWidthXl}
        destroyOnHidden
        onClose={() => setPreviewing(null)}
      >
        <ProTable<HouseOut>
          rowKey="id"
          loading={isInitialQueryPending(responsibleHouses)}
          columns={houseColumns}
          dataSource={responsibleHouses.data?.items || []}
          search={false}
          options={false}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default StaffResponsibilitiesPage;
