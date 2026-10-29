import { UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  Upload,
} from 'antd';
import React, { useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import {
  AdminToolbar,
  adminTableScroll,
  fixedPagePagination,
} from '@/pages/_shared/adminLayout';
import {
  dataMigrationApi,
  type MigrationAsset,
} from '@/services/manual/dataMigration';
import { appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';
import { errorMessage, statusLabels } from './presentation';

export default function AssetsPanel({
  slug,
  batchId,
  signal,
  refreshKey,
}: {
  slug: string;
  batchId: string;
  signal: AbortSignal;
  refreshKey: string;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [editing, setEditing] = useState<MigrationAsset>();
  const [file, setFile] = useState<File>();
  const [form] = Form.useForm<{ source_url?: string }>();
  const query = useQuery({
    queryKey: [
      'data-migration',
      slug,
      'assets',
      batchId,
      page,
      status,
      refreshKey,
    ],
    queryFn: ({ signal: querySignal }) =>
      dataMigrationApi.assets(
        slug,
        batchId,
        { page, page_size: 20, status },
        querySignal,
      ),
  });
  const mutation = useMutation({
    mutationFn: async ({
      asset,
      sourceUrl,
      replacement,
    }: {
      asset: MigrationAsset;
      sourceUrl?: string;
      replacement?: File;
    }) => {
      let mediaId: number | undefined;
      if (replacement) {
        const uploaded = await appsMediaApiUploadFiles(
          { resource_type: asset.resource_type, scope: 'org' },
          [replacement],
          { headers: { 'X-Org-Slug': slug }, signal },
        );
        mediaId = uploaded[0]?.id;
        if (!mediaId) throw new Error('补传未返回有效媒体，请重试');
      }
      return dataMigrationApi.retryAsset(
        slug,
        asset.id,
        mediaId
          ? { media_id: mediaId }
          : sourceUrl
            ? { source_url: sourceUrl }
            : {},
        signal,
      );
    },
    onSuccess: async () => {
      setEditing(undefined);
      setFile(undefined);
      await queryClient.invalidateQueries({
        queryKey: ['data-migration', slug],
      });
    },
  });
  const openEdit = (asset: MigrationAsset) => {
    mutation.reset();
    setFile(undefined);
    form.setFieldsValue({ source_url: asset.source_url });
    setEditing(asset);
  };
  return (
    <>
      <Space orientation="vertical" className="w-full" size="middle">
        <AdminToolbar>
          <Select
            aria-label="资源迁移状态"
            placeholder="全部资源状态"
            allowClear
            value={status}
            options={[
              'pending',
              'processing',
              'succeeded',
              'failed',
              'missing',
            ].map((value) => ({ value, label: statusLabels[value] }))}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            className="w-full md:w-48"
          />
          <Button onClick={() => void query.refetch()}>刷新资源</Button>
        </AdminToolbar>
        {query.isError && (
          <Alert
            type="error"
            showIcon
            title={errorMessage(query.error)}
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
          />
        )}
        {mutation.isError && !editing && (
          <Alert type="error" showIcon title={errorMessage(mutation.error)} />
        )}
        <Table<MigrationAsset>
          rowKey="id"
          dataSource={query.data?.items || []}
          loading={query.isLoading}
          scroll={adminTableScroll}
          pagination={fixedPagePagination(
            page,
            20,
            query.data?.total || 0,
            setPage,
          )}
          locale={{ emptyText: '暂无资源，预检和导入后会建立媒体迁移任务。' }}
          columns={[
            {
              title: '资源编号',
              dataIndex: 'id',
              width: 230,
              render: (value) => (
                <Typography.Text copyable className="break-all">
                  {value}
                </Typography.Text>
              ),
            },
            {
              title: '旧资源地址',
              dataIndex: 'source_url',
              width: 260,
              render: (value) => (
                <Typography.Paragraph
                  ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                  className="mb-0 break-all"
                >
                  {value || '未提供可访问地址'}
                </Typography.Paragraph>
              ),
            },
            {
              title: '用途',
              dataIndex: 'resource_type',
              align: 'center',
              render: (value) =>
                (
                  ({
                    house_image: '房源图片',
                    house_video: '房源视频',
                    org_logo: '组织标志',
                    legacy_archive_asset: '历史附件',
                  }) as Record<string, string>
                )[value] || value,
            },
            {
              title: '迁移状态',
              dataIndex: 'status',
              align: 'center',
              render: (value, asset) => (
                <AppStatusTag
                  name="data-migration.task"
                  state={
                    asset.binding_state === 'detached' ? 'detached' : value
                  }
                >
                  {asset.binding_state === 'detached'
                    ? '待确认关联'
                    : statusLabels[value] || value}
                </AppStatusTag>
              ),
            },
            { title: '尝试次数', dataIndex: 'attempts', align: 'right' },
            {
              title: '可用资源',
              key: 'url',
              align: 'center',
              render: (_, asset) =>
                asset.url ? (
                  <Button
                    type="link"
                    size="small"
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {asset.status === 'succeeded'
                      ? '查看新版资源'
                      : '查看旧资源'}
                  </Button>
                ) : (
                  '暂无可用地址'
                ),
            },
            {
              title: '新媒体编号',
              dataIndex: 'media_file_id',
              align: 'right',
              render: (value) => value ?? '—',
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
              render: (_, asset) =>
                ['failed', 'missing'].includes(asset.status) ||
                asset.binding_state === 'detached' ? (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      loading={
                        mutation.isPending &&
                        mutation.variables?.asset.id === asset.id
                      }
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ asset })}
                    >
                      {asset.binding_state === 'detached'
                        ? '确认附加当前目标'
                        : '单独重试'}
                    </Button>
                    {asset.binding_state !== 'detached' && (
                      <Button
                        type="link"
                        size="small"
                        disabled={mutation.isPending}
                        onClick={() => openEdit(asset)}
                      >
                        修正或补传
                      </Button>
                    )}
                  </Space>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Space>
      <Modal
        title="修正资源或补传文件"
        open={Boolean(editing)}
        onCancel={() => {
          if (!mutation.isPending) setEditing(undefined);
        }}
        confirmLoading={mutation.isPending}
        okText="保存并重试资源"
        cancelText="取消"
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editing)
              mutation.mutate({
                asset: editing,
                sourceUrl: values.source_url?.trim(),
                replacement: file,
              });
          }}
        >
          <Typography.Paragraph>
            修正后的地址仍须属于受支持的旧资源来源。补传文件将保存到当前组织，并使用该资源原有用途校验。
          </Typography.Paragraph>
          {mutation.isError && (
            <Alert
              className="mb-4"
              type="error"
              showIcon
              title={errorMessage(mutation.error)}
            />
          )}
          <Form.Item
            label="旧资源地址"
            name="source_url"
            rules={
              file
                ? []
                : [{ type: 'url', message: '请填写完整的 HTTP 或 HTTPS 地址' }]
            }
          >
            <Input disabled={Boolean(file) || mutation.isPending} />
          </Form.Item>
          <Form.Item label="或补传本地文件">
            <Upload
              beforeUpload={(selected) => {
                setFile(selected);
                return false;
              }}
              maxCount={1}
              fileList={
                file
                  ? [{ uid: 'replacement', name: file.name, status: 'done' }]
                  : []
              }
              onRemove={() => {
                setFile(undefined);
              }}
              disabled={mutation.isPending}
            >
              <Button icon={<UploadOutlined />} disabled={mutation.isPending}>
                选择替代文件
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
