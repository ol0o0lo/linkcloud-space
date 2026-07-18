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
    form.setFieldsValue({
      landlord_ids: editing.landlords.map((item) => item.id),
      building_ids: editing.buildings.map((item) => item.id),
      estate_ids: editing.estates.map((item) => item.id),
    });
  }, [editing, form]);

  const saveResponsibilities = useMutation({
    mutationFn: (payload: PropertyResponsibilityUpdateIn) => {
      if (!editing) throw new Error('请选择员工');
      return houseApi.replaceStaffResponsibilities(editing.member_id, payload);
    },
    onSuccess: async () => {
      message.success('员工负责范围已更新');
      setEditing(null);
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
      title: '负责房东',
      dataIndex: 'landlords',
      width: 280,
      render: (_value, record) =>
        record.landlords.length ? (
          <Space size={[4, 4]} wrap>
            {record.landlords.map((item) => (
              <Tag key={item.id} color="blue">
                {item.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未分配</Typography.Text>
        ),
    },
    {
      title: '负责楼栋',
      dataIndex: 'buildings',
      width: 300,
      render: (_value, record) =>
        record.buildings.length ? (
          <Space size={[4, 4]} wrap>
            {record.buildings.map((item) => (
              <Tag key={item.id} color="cyan">
                {buildingLabel(item)}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未分配</Typography.Text>
        ),
    },
    {
      title: '负责小区',
      dataIndex: 'estates',
      width: 280,
      render: (_value, record) =>
        record.estates.length ? (
          <Space size={[4, 4]} wrap>
            {record.estates.map((item) => (
              <Tag key={item.id} color="green">
                {item.display_name || item.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未分配</Typography.Text>
        ),
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
            分配范围
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
      <Alert
        type="info"
        showIcon
        title="按房东、楼栋或小区分配日常维护范围"
        description="职责按房东 > 楼栋 > 小区解析。房源命中房东绑定后不再采用楼栋和小区绑定；没有房东绑定时才依次回落到楼栋、小区。"
        style={{ marginBottom: 16 }}
      />
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
            ? `分配负责范围 · ${formatPersonLabel(editing.user)}`
            : '分配负责范围'
        }
        open={Boolean(editing)}
        size={drawerWidthLg}
        destroyOnHidden
        onClose={() => {
          setEditing(null);
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
        <Alert
          type="warning"
          showIcon
          title="保存会整体替换该员工当前的房东、楼栋和小区职责"
          style={{ marginBottom: 16 }}
        />
        <Form<PropertyResponsibilityUpdateIn>
          id="property-responsibility-form"
          form={form}
          layout="vertical"
          initialValues={{ landlord_ids: [], building_ids: [], estate_ids: [] }}
          onFinish={(values) =>
            saveResponsibilities.mutateAsync({
              landlord_ids: values.landlord_ids || [],
              building_ids: values.building_ids || [],
              estate_ids: values.estate_ids || [],
            })
          }
        >
          <Form.Item
            name="landlord_ids"
            label="负责房东"
            extra="覆盖这些房东名下、已登记房东关系的全部房源。"
          >
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
          <Form.Item
            name="building_ids"
            label="负责楼栋"
            extra="仅在房源没有房东级职责时生效，优先于小区级职责。"
          >
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
          <Form.Item
            name="estate_ids"
            label="负责小区"
            extra="仅在房源没有房东级和楼栋级职责时生效。"
          >
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
        </Form>
      </Drawer>

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
