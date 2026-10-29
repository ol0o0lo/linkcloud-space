import {
  DownloadOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Modal,
  Progress,
  Space,
  Table,
  Tabs,
  Typography,
  Upload,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import {
  adminTableScroll,
  codeWrapStyle,
  drawerWidthXl,
  fixedPagePagination,
  twoColumnDescription,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  dataMigrationApi,
  type MigrationBatch,
  type MigrationDecisions,
  type MigrationOptions,
} from '@/services/manual/dataMigration';
import AssetsPanel from './AssetsPanel';
import PrecheckEditor from './PrecheckEditor';
import {
  batchResult,
  businessProgress,
  emptyDecisions,
  errorMessage,
  statusLabels,
  summaryLabels,
} from './presentation';
import RecordsPanel from './RecordsPanel';

const isRunning = (batch: MigrationBatch) =>
  ['uploaded', 'validating', 'importing'].includes(batch.status) ||
  (batch.status === 'completed' &&
    ['pending', 'processing'].includes(batch.media_status));

function Summary({ summary }: { summary: Record<string, number> }) {
  return (
    <Descriptions
      column={{ xs: 1, sm: 2, lg: 4 }}
      items={Object.entries(summary).map(([key, value]) => ({
        key,
        label: summaryLabels[key] || key,
        children: `${value} 条`,
      }))}
    />
  );
}

function BatchProgress({ batch }: { batch: MigrationBatch }) {
  const business = businessProgress(batch);
  const media = batch.media_summary;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <Typography.Text strong>
          业务数据：{statusLabels[batch.status] || batch.status}
        </Typography.Text>
        {business.percent == null ? (
          <Typography.Paragraph type="secondary">
            {batch.summary.total === 0 &&
            !['uploaded', 'validating'].includes(batch.status)
              ? '本批次没有业务记录'
              : '等待预检确定记录总数'}
          </Typography.Paragraph>
        ) : (
          <>
            <Progress
              percent={business.percent}
              status={
                ['failed', 'partial_failed'].includes(batch.status)
                  ? 'exception'
                  : batch.status === 'completed'
                    ? 'success'
                    : 'active'
              }
            />
            <Typography.Text type="secondary">
              已处理成功 {business.finished} / {business.total} 条；失败{' '}
              {batch.summary.failed || 0} 条；未完成{' '}
              {batch.summary.pending || 0} 条
            </Typography.Text>
          </>
        )}
      </div>
      <div>
        <Typography.Text strong>
          媒体资源：{statusLabels[batch.media_status] || batch.media_status}
        </Typography.Text>
        {media.total > 0 ? (
          <>
            <Progress
              percent={Math.min(
                100,
                Math.round((media.succeeded / media.total) * 100),
              )}
              status={
                media.failed || media.missing
                  ? 'exception'
                  : batch.media_status === 'completed'
                    ? 'success'
                    : 'active'
              }
            />
            <Typography.Text type="secondary">
              成功 {media.succeeded} / {media.total} 个；等待 {media.pending}
              ，处理中 {media.processing}，失败 {media.failed}，缺失{' '}
              {media.missing}，待确认关联 {media.detached || 0}
            </Typography.Text>
          </>
        ) : (
          <Typography.Paragraph type="secondary">
            {batch.media_status === 'completed'
              ? '本批次无需迁移媒体资源'
              : '尚未建立资源清单，暂无媒体进度'}
          </Typography.Paragraph>
        )}
      </div>
    </div>
  );
}

function ReportPanel({ slug, batchId }: { slug: string; batchId: string }) {
  const report = useQuery({
    queryKey: ['data-migration', slug, 'report', batchId],
    queryFn: ({ signal }) => dataMigrationApi.report(slug, batchId, signal),
  });
  const download = () => {
    if (!report.data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report.data, null, 2)], {
        type: 'application/json;charset=utf-8',
      }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `uhome-migration-report-${batchId}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Space orientation="vertical" className="w-full" size="middle">
      {report.isError && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(report.error, '报告读取失败')}
          action={<Button onClick={() => void report.refetch()}>重试</Button>}
        />
      )}
      <Space wrap>
        <Button
          icon={<DownloadOutlined />}
          disabled={!report.data}
          onClick={download}
        >
          下载迁移报告
        </Button>
        <Button
          loading={report.isFetching}
          onClick={() => void report.refetch()}
        >
          刷新报告
        </Button>
      </Space>
      <Card loading={report.isLoading}>
        <pre className="m-0 max-h-96 overflow-auto whitespace-pre-wrap break-all">
          {report.data ? JSON.stringify(report.data, null, 2) : '暂无报告'}
        </pre>
      </Card>
    </Space>
  );
}

function BatchDetail({
  slug,
  id,
  members,
  signal,
  onClose,
}: {
  slug: string;
  id: string;
  members: MigrationOptions['members'];
  signal: AbortSignal;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [modal, modalContext] = Modal.useModal();
  const [dirty, setDirty] = useState(false);
  const [adjustMembers, setAdjustMembers] = useState(false);
  const [tab, setTab] = useState('preview');
  const queryKey = ['data-migration', slug, 'batch', id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal: querySignal }) =>
      dataMigrationApi.batch(slug, id, querySignal),
    refetchInterval: (current) =>
      current.state.data && isRunning(current.state.data) ? 3000 : false,
  });
  const batch = query.data;
  const mutation = useMutation({
    mutationFn: (
      action:
        | { type: 'preview'; decisions: MigrationDecisions }
        | { type: 'confirm'; version: string }
        | { type: 'retry' },
    ) => {
      if (action.type === 'preview')
        return dataMigrationApi.preview(slug, id, action.decisions, signal);
      if (action.type === 'confirm')
        return dataMigrationApi.confirm(slug, id, action.version, signal);
      return dataMigrationApi.retry(slug, id, signal);
    },
    onSuccess: async (result, action) => {
      setDirty(false);
      if (action.type === 'confirm') setAdjustMembers(false);
      queryClient.setQueryData(queryKey, result);
      await queryClient.invalidateQueries({
        queryKey: ['data-migration', slug],
      });
    },
    onError: () => {
      void query.refetch();
    },
  });
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const close = () => {
    if (mutation.isPending) return;
    if (dirty)
      modal.confirm({
        title: '放弃尚未保存的预检补全？',
        content: '已填写的补全和员工映射尚未提交，关闭后需要重新填写。',
        okText: '放弃并关闭',
        cancelText: '继续填写',
        onOk: onClose,
      });
    else onClose();
  };
  const editable =
    batch &&
    (['uploaded', 'blocked', 'awaiting_confirmation'].includes(batch.status) ||
      (batch.status === 'completed' && adjustMembers));
  return (
    <Drawer
      title={`迁移任务 · ${batch?.source_team_name || id}`}
      open
      onClose={close}
      size={drawerWidthXl}
      loading={query.isLoading}
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          刷新任务
        </Button>
      }
    >
      {modalContext}
      <Space orientation="vertical" className="w-full" size="large">
        {query.isError && (
          <Alert
            type="error"
            showIcon
            title={errorMessage(query.error, '任务读取失败')}
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
          />
        )}
        {mutation.isError && (
          <Alert
            type="error"
            showIcon
            title={errorMessage(mutation.error, '操作失败，填写内容已保留')}
          />
        )}
        {batch && (
          <>
            <Alert
              type={
                batch.status === 'failed' ||
                batch.status === 'partial_failed' ||
                batch.media_summary.failed ||
                batch.media_summary.missing
                  ? 'warning'
                  : 'info'
              }
              showIcon
              title={batchResult(batch)}
              description={batch.error_message || undefined}
            />
            <Descriptions
              column={twoColumnDescription}
              items={[
                {
                  key: 'target',
                  label: '目标组织',
                  children: <OrganizationName slug={slug} />,
                },
                {
                  key: 'source',
                  label: '来源团队',
                  children: `${batch.source_team_name || '未提供'}（${batch.source_team_id || '—'}）`,
                },
                {
                  key: 'id',
                  label: '任务编号',
                  children: (
                    <Typography.Text copyable style={codeWrapStyle}>
                      {id}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'updated',
                  label: '更新时间',
                  children: dayjs(batch.updated_at).format(
                    'YYYY-MM-DD HH:mm:ss',
                  ),
                },
              ]}
            />
            <BatchProgress batch={batch} />
            <Summary summary={batch.summary} />
            {batch.status === 'completed' && !adjustMembers && (
              <Button
                onClick={() => {
                  setAdjustMembers(true);
                  setTab('preview');
                }}
              >
                调整员工绑定
              </Button>
            )}
            {['failed', 'partial_failed'].includes(batch.status) && (
              <Button
                loading={mutation.isPending}
                onClick={() => mutation.mutate({ type: 'retry' })}
              >
                重试未完成业务记录
              </Button>
            )}
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'preview',
                  label: '预检与补全',
                  children: (
                    <Space
                      orientation="vertical"
                      size="middle"
                      className="w-full"
                    >
                      {batch.preview && (
                        <Summary summary={batch.preview.summary} />
                      )}
                      {editable ? (
                        <PrecheckEditor
                          slug={slug}
                          teamSourceId={batch.source_team_id}
                          batchId={batch.id}
                          membersOnly={adjustMembers}
                          key={`${batch.id}:${batch.preview?.version || ''}`}
                          issues={batch.preview?.issues || []}
                          initialDecisions={
                            batch.preview?.decisions || emptyDecisions()
                          }
                          members={members}
                          saving={mutation.isPending}
                          onDirty={setDirty}
                          onSave={(decisions) =>
                            mutation.mutate({ type: 'preview', decisions })
                          }
                        />
                      ) : (
                        <Typography.Text type="secondary">
                          {batch.status === 'validating'
                            ? '后台正在预检，页面会自动更新。'
                            : '当前阶段可在记录、资源和报告中核对结果。'}
                        </Typography.Text>
                      )}
                      {batch.status === 'awaiting_confirmation' &&
                        batch.preview?.version && (
                          <>
                            <Alert
                              showIcon
                              type="warning"
                              title={
                                adjustMembers
                                  ? '确认后应用员工绑定与可恢复的分配关系'
                                  : '确认后将写入当前目标组织'
                              }
                              description={
                                adjustMembers
                                  ? '请核对历史员工和组织成员。其他已成功导入的业务记录保持现状，历史身份不会继承旧版权限。'
                                  : '请核对来源团队、业务数量和复用目标。业务数据与媒体分别处理，历史账单和薪资只归档，不触发新收支。'
                              }
                            />
                            <Button
                              disabled={
                                dirty || Boolean(batch.preview.issues.length)
                              }
                              loading={mutation.isPending}
                              onClick={() =>
                                modal.confirm({
                                  title: adjustMembers
                                    ? '确认调整员工绑定'
                                    : '确认导入旧版团队数据',
                                  content: (
                                    <Space orientation="vertical">
                                      <Typography.Text>
                                        来源团队：{batch.source_team_name}
                                      </Typography.Text>
                                      <Typography.Text>
                                        目标组织：
                                        <OrganizationName slug={slug} />
                                      </Typography.Text>
                                      <Typography.Text>
                                        {adjustMembers
                                          ? '将按本次预检应用员工绑定并恢复可绑定的有效分配关系。'
                                          : '将按已确认预检写入业务数据并启动后台媒体迁移。'}
                                      </Typography.Text>
                                    </Space>
                                  ),
                                  okText: adjustMembers
                                    ? '确认应用员工绑定'
                                    : '确认导入到此组织',
                                  cancelText: '返回核对',
                                  onOk: () =>
                                    mutation.mutateAsync({
                                      type: 'confirm',
                                      version: batch.preview?.version || '',
                                    }),
                                })
                              }
                            >
                              {adjustMembers
                                ? '核对完成，确认员工绑定'
                                : '核对完成，确认导入'}
                            </Button>
                            {dirty && (
                              <Typography.Text type="warning">
                                请先保存补全并重新预检。
                              </Typography.Text>
                            )}
                          </>
                        )}
                    </Space>
                  ),
                },
                {
                  key: 'records',
                  label: '业务记录',
                  children: (
                    <RecordsPanel
                      slug={slug}
                      batchId={id}
                      refreshKey={batch.updated_at}
                    />
                  ),
                },
                {
                  key: 'assets',
                  label: '媒体资源',
                  children: (
                    <AssetsPanel
                      slug={slug}
                      batchId={id}
                      signal={signal}
                      refreshKey={batch.updated_at}
                    />
                  ),
                },
                {
                  key: 'report',
                  label: '核对报告',
                  children:
                    tab === 'report' ? (
                      <ReportPanel slug={slug} batchId={id} />
                    ) : null,
                },
              ]}
            />
          </>
        )}
      </Space>
    </Drawer>
  );
}

function OrganizationName({ slug }: { slug: string }) {
  const client = useQueryClient();
  return (
    <>
      {client.getQueryData<MigrationOptions>([
        'data-migration',
        slug,
        'options',
      ])?.organization.name || slug}
    </>
  );
}

function MigrationWorkspace({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [controller, setController] = useState(() => new AbortController());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const [file, setFile] = useState<File>();
  const [selectionError, setSelectionError] = useState('');
  const [tab, setTab] = useState('batches');
  useEffect(() => {
    if (controller.signal.aborted) setController(new AbortController());
    return () => controller.abort();
  }, [controller]);
  const optionsQuery = useQuery({
    queryKey: ['data-migration', slug, 'options'],
    queryFn: ({ signal }) => dataMigrationApi.options(slug, signal),
    retry: false,
  });
  const canManage = optionsQuery.data?.can_manage === true;
  const batchesQuery = useQuery({
    queryKey: ['data-migration', slug, 'batches', page],
    queryFn: ({ signal }) =>
      dataMigrationApi.batches(slug, { page, page_size: 20 }, signal),
    enabled: canManage,
    refetchInterval: (current) =>
      current.state.data?.items.some(isRunning) ? 5000 : false,
  });
  const upload = useMutation({
    mutationFn: (selectedFile: File) =>
      dataMigrationApi.upload(slug, selectedFile, controller.signal),
    onSuccess: async (batch) => {
      setFile(undefined);
      setSelected(batch.id);
      await queryClient.invalidateQueries({
        queryKey: ['data-migration', slug],
      });
    },
  });
  if (optionsQuery.isLoading) return <Card loading />;
  const permissionError = optionsQuery.error as {
    info?: { code?: number };
    response?: { status?: number };
  } | null;
  if (
    permissionError?.info?.code === 403 ||
    permissionError?.response?.status === 403
  )
    return (
      <Alert
        type="warning"
        showIcon
        title="仅组织所有者可以迁移数据"
        description="请联系当前组织所有者完成上传、核对与导入。"
      />
    );
  if (optionsQuery.isError)
    return (
      <Alert
        type="error"
        showIcon
        title="无法读取迁移权限"
        description={errorMessage(
          optionsQuery.error,
          '仅目标组织所有者可以操作数据迁移。',
        )}
        action={
          <Button onClick={() => void optionsQuery.refetch()}>重新检查</Button>
        }
      />
    );
  if (!canManage)
    return (
      <Alert
        type="warning"
        showIcon
        title="仅组织所有者可以迁移数据"
        description="请联系当前组织所有者完成上传、核对与导入。"
      />
    );
  return (
    <Space orientation="vertical" className="w-full" size="large">
      <Alert
        showIcon
        type="info"
        title={`目标组织：${optionsQuery.data?.organization.name || slug}`}
        description="从旧版 Uhome 导入本团队 ZIP 迁移包。推荐先在空组织试迁移；已有组织需在预检中核对复用关系。导入不会创建账号或继承旧版权限。"
      />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={[
          {
            key: 'batches',
            label: '从旧版 Uhome 导入',
            children: (
              <Space orientation="vertical" className="w-full" size="large">
                <Card title="上传团队迁移包">
                  <Space
                    orientation="vertical"
                    className="w-full"
                    size="middle"
                  >
                    <Typography.Text>
                      上传旧版管理员生成的 ZIP
                      文件。包内包含业务数据和旧媒体地址，媒体由服务器后台迁移。上传完成后可以离开页面，任务会继续执行。
                    </Typography.Text>
                    {upload.isError && (
                      <Alert
                        showIcon
                        type="error"
                        title={errorMessage(
                          upload.error,
                          '上传失败，请保留文件后重试',
                        )}
                      />
                    )}
                    {selectionError && (
                      <Alert type="error" showIcon title={selectionError} />
                    )}
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <Upload
                        accept=".zip,application/zip"
                        beforeUpload={(nextFile) => {
                          if (!nextFile.name.toLowerCase().endsWith('.zip')) {
                            setSelectionError('请选择旧版生成的 ZIP 迁移包');
                            return Upload.LIST_IGNORE;
                          }
                          setSelectionError('');
                          setFile(nextFile);
                          upload.reset();
                          return false;
                        }}
                        maxCount={1}
                        fileList={
                          file
                            ? [
                                {
                                  uid: 'migration',
                                  name: file.name,
                                  status: 'done',
                                },
                              ]
                            : []
                        }
                        onRemove={() => {
                          setFile(undefined);
                        }}
                        disabled={upload.isPending}
                      >
                        <Button
                          icon={<UploadOutlined />}
                          disabled={upload.isPending}
                        >
                          选择 ZIP 迁移包
                        </Button>
                      </Upload>
                      <Button
                        type="primary"
                        disabled={!file}
                        loading={upload.isPending}
                        onClick={() => {
                          if (file) upload.mutate(file);
                        }}
                      >
                        上传并开始预检
                      </Button>
                    </div>
                  </Space>
                </Card>
                <Card
                  title="迁移任务"
                  extra={
                    <Button
                      icon={<ReloadOutlined />}
                      loading={batchesQuery.isFetching}
                      onClick={() => void batchesQuery.refetch()}
                    >
                      刷新列表
                    </Button>
                  }
                >
                  {batchesQuery.isError && (
                    <Alert
                      className="mb-4"
                      type="error"
                      showIcon
                      title={errorMessage(
                        batchesQuery.error,
                        '任务列表读取失败',
                      )}
                      action={
                        <Button onClick={() => void batchesQuery.refetch()}>
                          重试
                        </Button>
                      }
                    />
                  )}
                  <Table<MigrationBatch>
                    rowKey="id"
                    loading={batchesQuery.isLoading}
                    dataSource={batchesQuery.data?.items || []}
                    scroll={adminTableScroll}
                    pagination={fixedPagePagination(
                      page,
                      20,
                      batchesQuery.data?.total || 0,
                      setPage,
                    )}
                    locale={{
                      emptyText: '尚无迁移任务，请先上传旧版团队迁移包。',
                    }}
                    columns={[
                      {
                        title: '来源团队',
                        dataIndex: 'source_team_name',
                        render: (value, batch) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => setSelected(batch.id)}
                          >
                            {value || '待解析迁移包'}
                          </Button>
                        ),
                      },
                      {
                        title: '业务状态',
                        dataIndex: 'status',
                        align: 'center',
                        render: (value) => (
                          <AppStatusTag
                            name="data-migration.task"
                            state={value}
                          >
                            {statusLabels[value] || value}
                          </AppStatusTag>
                        ),
                      },
                      {
                        title: '媒体状态',
                        dataIndex: 'media_status',
                        align: 'center',
                        render: (value) => (
                          <AppStatusTag
                            name="data-migration.task"
                            state={value}
                          >
                            {statusLabels[value] || value}
                          </AppStatusTag>
                        ),
                      },
                      {
                        title: '总体结果',
                        key: 'result',
                        render: (_, batch) => batchResult(batch),
                      },
                      {
                        title: '上传时间',
                        dataIndex: 'created_at',
                        align: 'center',
                        render: (value) =>
                          dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
                      },
                      {
                        title: '操作',
                        key: 'action',
                        align: 'center',
                        render: (_, batch) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => setSelected(batch.id)}
                          >
                            查看与处理
                          </Button>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'archives',
            label: '历史档案',
            children:
              tab === 'archives' ? (
                <Card>
                  <Typography.Paragraph type="secondary">
                    历史档案保留原始数据、审核和删除状态。账单、薪资等历史资料的读取范围由服务端按组织权限核验。
                  </Typography.Paragraph>
                  <RecordsPanel slug={slug} archives />
                </Card>
              ) : null,
          },
        ]}
      />
      {selected && (
        <BatchDetail
          key={selected}
          slug={slug}
          id={selected}
          members={optionsQuery.data?.members || []}
          signal={controller.signal}
          onClose={() => setSelected(undefined)}
        />
      )}
    </Space>
  );
}

export default function DataMigrationPage() {
  const workspace = useTenantWorkspace();
  return (
    <TenantSelectionGuard title="数据迁移">
      {workspace.selectedOrgSlug && (
        <MigrationWorkspace
          key={workspace.selectedOrgSlug}
          slug={workspace.selectedOrgSlug}
        />
      )}
    </TenantSelectionGuard>
  );
}
