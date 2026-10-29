import { useQuery } from '@tanstack/react-query';
import { Link } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { AdvancedFilterToolbar } from '@/components/AdvancedFilterToolbar';
import { AppStatusTag } from '@/components/AppStatus';
import {
  AdminToolbar,
  adminTableScroll,
  codeWrapStyle,
  drawerWidthLg,
  fixedPagePagination,
} from '@/pages/_shared/adminLayout';
import {
  dataMigrationApi,
  type MigrationFilters,
  type MigrationRecord,
} from '@/services/manual/dataMigration';
import {
  entityLabels,
  errorMessage,
  fieldLabels,
  statusLabels,
  targetPath,
} from './presentation';

type ArchiveFilters = Pick<
  MigrationFilters,
  | 'created_from'
  | 'created_to'
  | 'staff_id'
  | 'checked'
  | 'approved'
  | 'source_deleted'
  | 'bill_number'
>;
type ArchiveForm = {
  created_from?: dayjs.Dayjs;
  created_to?: dayjs.Dayjs;
  staff_id?: string;
  bill_number?: string;
  checked?: string;
  approved?: string;
  source_deleted?: string;
};

export default function RecordsPanel({
  slug,
  batchId,
  archives = false,
  refreshKey,
}: {
  slug: string;
  batchId?: string;
  archives?: boolean;
  refreshKey?: string;
}) {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>();
  const [state, setState] = useState<string>();
  const [search, setSearch] = useState('');
  const [record, setRecord] = useState<MigrationRecord>();
  const [archiveBatch, setArchiveBatch] = useState('');
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>({});
  const [filterForm] = Form.useForm<ArchiveForm>();
  const query = useQuery({
    queryKey: [
      'data-migration',
      slug,
      archives ? 'archives' : 'records',
      batchId,
      page,
      entityType,
      state,
      search,
      archiveBatch,
      archiveFilters,
      refreshKey,
    ],
    queryFn: ({ signal }) => {
      const params = {
        page,
        page_size: 20,
        entity_type: entityType,
        state: archives ? undefined : state,
        search: search || undefined,
        batch_id: archives ? archiveBatch || undefined : undefined,
        ...(archives ? archiveFilters : {}),
      };
      return archives
        ? dataMigrationApi.archives(slug, params, signal)
        : dataMigrationApi.records(slug, batchId || '', params, signal);
    },
  });
  const archiveQuery = useQuery({
    queryKey: ['data-migration', slug, 'archive', record?.id],
    queryFn: ({ signal }) =>
      dataMigrationApi.archive(slug, record?.id || 0, signal),
    enabled: archives && Boolean(record),
  });
  const detail = archives ? archiveQuery.data : record;
  return (
    <>
      <Space orientation="vertical" className="w-full" size="middle">
        <AdminToolbar>
          <Select
            aria-label="档案数据类型"
            placeholder="全部数据类型"
            allowClear
            value={entityType}
            options={Object.entries(entityLabels)
              .filter(([value]) => value !== 'package')
              .map(([value, label]) => ({
                value,
                label,
              }))}
            onChange={(value) => {
              setEntityType(value);
              setPage(1);
            }}
            className="w-full md:w-44"
          />
          {!archives && (
            <Select
              aria-label="记录处理结果"
              placeholder="全部处理结果"
              allowClear
              value={state}
              options={[
                'pending',
                'processing',
                'created',
                'updated',
                'reused',
                'skipped',
                'archived',
                'failed',
              ].map((value) => ({ value, label: statusLabels[value] }))}
              onChange={(value) => {
                setState(value);
                setPage(1);
              }}
              className="w-full md:w-44"
            />
          )}
          {archives && (
            <Input.Search
              aria-label="按迁移批次筛选档案"
              placeholder="迁移批次编号"
              allowClear
              onSearch={(value) => {
                setArchiveBatch(value.trim());
                setPage(1);
              }}
              className="w-full md:max-w-64"
            />
          )}
          {archives && (
            <AdvancedFilterToolbar
              title="历史档案筛选"
              triggerText="更多筛选"
              advancedActive={Object.values(archiveFilters).some(
                (value) => value !== undefined && value !== '',
              )}
              onConfirm={async () => {
                const values = await filterForm.validateFields();
                setArchiveFilters({
                  created_from: values.created_from?.format('YYYY-MM-DD'),
                  created_to: values.created_to?.format('YYYY-MM-DD'),
                  staff_id: values.staff_id?.trim() || undefined,
                  bill_number: values.bill_number?.trim() || undefined,
                  checked:
                    values.checked === undefined
                      ? undefined
                      : values.checked === 'yes',
                  approved:
                    values.approved === undefined
                      ? undefined
                      : values.approved === 'yes',
                  source_deleted:
                    values.source_deleted === undefined
                      ? undefined
                      : values.source_deleted === 'yes',
                });
                setPage(1);
              }}
              onReset={() => {
                filterForm.resetFields();
                setArchiveFilters({});
                setPage(1);
              }}
              advancedContent={
                <Form form={filterForm} layout="vertical">
                  <Form.Item name="created_from" label="来源创建日期（开始）">
                    <DatePicker className="w-full" />
                  </Form.Item>
                  <Form.Item
                    name="created_to"
                    label="来源创建日期（结束）"
                    dependencies={['created_from']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: (_, value) =>
                          !value ||
                          !getFieldValue('created_from') ||
                          !value.isBefore(getFieldValue('created_from'), 'day')
                            ? Promise.resolve()
                            : Promise.reject(
                                new Error('结束日期不能早于开始日期'),
                              ),
                      }),
                    ]}
                  >
                    <DatePicker className="w-full" />
                  </Form.Item>
                  <Form.Item name="staff_id" label="旧经办员工编号">
                    <Input />
                  </Form.Item>
                  <Form.Item name="bill_number" label="旧账单号">
                    <Input />
                  </Form.Item>
                  <Form.Item name="checked" label="旧版核对状态">
                    <Select
                      allowClear
                      options={[
                        { value: 'yes', label: '已核对' },
                        { value: 'no', label: '未核对' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="approved" label="旧版审核状态">
                    <Select
                      allowClear
                      options={[
                        { value: 'yes', label: '已审核' },
                        { value: 'no', label: '未审核' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="source_deleted" label="旧版删除状态">
                    <Select
                      allowClear
                      options={[
                        { value: 'yes', label: '旧版已删除' },
                        { value: 'no', label: '旧版未删除' },
                      ]}
                    />
                  </Form.Item>
                </Form>
              }
            />
          )}
          <Input.Search
            aria-label="搜索旧记录"
            placeholder="旧编号、姓名或原始资料"
            allowClear
            onSearch={(value) => {
              setSearch(value.trim());
              setPage(1);
            }}
            className="w-full md:max-w-64"
          />
          <Button onClick={() => void query.refetch()}>刷新记录</Button>
        </AdminToolbar>
        {query.isError && (
          <Alert
            type="error"
            showIcon
            title={errorMessage(query.error, '记录查询失败')}
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
          />
        )}
        <Table<MigrationRecord>
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data?.items || []}
          scroll={adminTableScroll}
          pagination={fixedPagePagination(
            page,
            20,
            query.data?.total || 0,
            setPage,
          )}
          locale={{ emptyText: '暂无匹配记录，可调整筛选条件。' }}
          columns={[
            {
              title: '旧记录编号',
              dataIndex: 'source_id',
              render: (value, item) => (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setRecord(item)}
                >
                  {value}
                </Button>
              ),
            },
            {
              title: '数据类型',
              dataIndex: 'entity_type',
              align: 'center',
              render: (value) => entityLabels[value] || value,
            },
            {
              title: '处理结果',
              dataIndex: 'state',
              align: 'center',
              render: (value) => (
                <AppStatusTag name="data-migration.task" state={value}>
                  {statusLabels[value] || value}
                </AppStatusTag>
              ),
            },
            {
              title: '来源删除状态',
              dataIndex: 'source_deleted',
              align: 'center',
              render: (value) => (value ? '旧版已删除' : '旧版未删除'),
            },
            {
              title: '新版对象',
              key: 'target',
              render: (_, item) => {
                const path = targetPath(item.target_type, item.target_id);
                return path ? (
                  <Link to={path}>查看新版记录 {item.target_id}</Link>
                ) : item.target_id != null ? (
                  `${entityLabels[item.target_type] || item.target_type} ${item.target_id}`
                ) : (
                  '—'
                );
              },
            },
            {
              title: '异常原因',
              dataIndex: 'error_message',
              width: 280,
              render: (value) => (
                <div className="whitespace-normal break-words">
                  {value || '—'}
                </div>
              ),
            },
            {
              title: '操作',
              key: 'action',
              align: 'center',
              render: (_, item) => (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setRecord(item)}
                >
                  查看原始档案
                </Button>
              ),
            },
          ]}
        />
      </Space>
      <Drawer
        title={`旧记录档案 ${record?.source_id || ''}`}
        open={Boolean(record)}
        onClose={() => setRecord(undefined)}
        size={drawerWidthLg}
        loading={archives && archiveQuery.isLoading}
      >
        {archiveQuery.isError && (
          <Alert
            type="error"
            showIcon
            title={errorMessage(archiveQuery.error)}
            action={
              <Button onClick={() => void archiveQuery.refetch()}>重试</Button>
            }
          />
        )}
        {detail && (
          <>
            <Descriptions
              column={1}
              items={[
                {
                  key: 'entity',
                  label: '数据类型',
                  children:
                    entityLabels[detail.entity_type] || detail.entity_type,
                },
                {
                  key: 'source',
                  label: '旧记录编号',
                  children: detail.source_id,
                },
                {
                  key: 'batch',
                  label: '迁移批次',
                  children: (
                    <span style={codeWrapStyle}>{detail.batch_id}</span>
                  ),
                },
                {
                  key: 'state',
                  label: '处理结果',
                  children: statusLabels[detail.state] || detail.state,
                },
                {
                  key: 'deleted',
                  label: '旧版已删除',
                  children: detail.source_deleted ? '是' : '否',
                },
                {
                  key: 'target',
                  label: '新版记录',
                  children: detail.target_id ?? '仅历史档案',
                },
                {
                  key: 'error',
                  label: '异常原因',
                  children: detail.error_message || '—',
                },
              ]}
            />
            <Typography.Title level={5}>原始业务资料</Typography.Title>
            <Descriptions
              bordered
              column={1}
              items={Object.entries(detail.data).map(([key, value]) => ({
                key,
                label:
                  fieldLabels[key] ||
                  (
                    {
                      created_at: '创建时间',
                      updated_at: '更新时间',
                      id: '旧编号',
                      amount: '原金额',
                      comment: '备注',
                      title: '标题',
                      username: '姓名',
                    } as Record<string, string>
                  )[key] ||
                  key,
                children: (
                  <span style={codeWrapStyle}>
                    {value == null || value === ''
                      ? '—'
                      : typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : key.endsWith('_at') && dayjs(String(value)).isValid()
                          ? dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')
                          : String(value)}
                  </span>
                ),
              }))}
            />
            {Boolean(detail.media?.length) && (
              <>
                <Typography.Title level={5}>历史附件</Typography.Title>
                <Image.PreviewGroup>
                  <Space wrap align="start">
                    {detail.media?.map((item) => (
                      <div
                        key={`${item.id}:${item.field}:${item.position}`}
                        className="max-w-64"
                      >
                        {item.url ? (
                          item.media_type === 'image' ? (
                            <Image
                              width={180}
                              src={item.url}
                              alt={`历史附件 ${item.position + 1}`}
                            />
                          ) : item.media_type === 'video' ? (
                            <video
                              controls
                              preload="metadata"
                              src={item.url}
                              className="max-w-full"
                              aria-label={`历史视频 ${item.position + 1}`}
                            >
                              <track kind="captions" />
                            </video>
                          ) : (
                            <Button
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              查看历史附件 {item.position + 1}
                            </Button>
                          )
                        ) : (
                          <Typography.Text type="secondary">
                            {item.status === 'missing' ||
                            item.status === 'failed'
                              ? '历史附件缺失，请处理迁移异常'
                              : '历史附件迁移中'}
                          </Typography.Text>
                        )}
                        <div>
                          {item.source_meta?.field_path && (
                            <Typography.Paragraph
                              type="secondary"
                              className="mb-0 break-all"
                            >
                              原始位置：{item.source_meta.field_path}
                            </Typography.Paragraph>
                          )}
                          {item.source_meta?.related_field && (
                            <Typography.Paragraph
                              type="secondary"
                              className="mb-0 break-all"
                            >
                              关联位置：{item.source_meta.related_field}
                            </Typography.Paragraph>
                          )}
                          <Typography.Text type="secondary">
                            {item.binding_state === 'detached'
                              ? '已保存到新存储，待确认关联'
                              : statusLabels[item.status] || item.status}
                          </Typography.Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
