import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { PageContainer } from '@/components/PageContainer';
import {
  AdminToolbar,
  adminTableScroll,
  fullWidthStyle,
  ResponsiveActions,
  toolbarControlStyle,
  toolbarShortSelectStyle,
} from '@/pages/_shared/adminLayout';
import { enumMapping } from '@/services/manual/enums';
import {
  appsReferralsApiAdminReferralRecords,
  appsReferralsApiGetReferralConfig,
  appsReferralsApiPatchReferralConfig,
  appsReferralsApiReviewReferralRecord,
} from '@/services/openapi/adminReferrals';
import { platformQueryKeys } from '../shared';

type ReferralRecordWithMapping = API.ReferralRecordOut & {
  status__mapping?: string;
};

type ReferralInsight = ReferralRecordWithMapping & {
  stage_label: string;
};
type TablePageParams = {
  createdFrom?: string;
  createdTo?: string;
  current?: number;
  keyword?: string;
  pageSize?: number;
  status?: string;
};

type ReferralSearchState = {
  createdFrom: string;
  createdTo: string;
  keyword: string;
  page: number;
  status?: string;
};

const PAGE_SIZE = 10;

const referralStatusOptions = [
  { value: 'registered', label: '已注册' },
  { value: 'pending_review', label: '待审核' },
  { value: 'review_rejected', label: '审核驳回' },
  { value: 'reward_issued', label: '已发奖' },
];

const trimParam = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function readSearchState(): ReferralSearchState {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get('page'));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    keyword: trimParam(params.get('keyword')) || '',
    status: trimParam(params.get('status')),
    createdFrom: trimParam(params.get('created_from')) || '',
    createdTo: trimParam(params.get('created_to')) || '',
  };
}

function syncSearchState(state: ReferralSearchState) {
  const params = new URLSearchParams(window.location.search);
  ['page', 'keyword', 'status', 'created_from', 'created_to'].forEach(
    (name) => {
      params.delete(name);
    },
  );
  if (state.page > 1) params.set('page', String(state.page));
  if (state.keyword) params.set('keyword', state.keyword);
  if (state.status) params.set('status', state.status);
  if (state.createdFrom) params.set('created_from', state.createdFrom);
  if (state.createdTo) params.set('created_to', state.createdTo);
  const search = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`,
  );
}

function apiDateRange(createdFrom?: string, createdTo?: string) {
  return {
    created_from: createdFrom
      ? dayjs(createdFrom).startOf('day').format()
      : undefined,
    created_to: createdTo
      ? dayjs(createdTo).add(1, 'day').startOf('day').format()
      : undefined,
  };
}

const compactSwitchStyle: React.CSSProperties = {
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
};

function buildReferralInsight(
  record: ReferralRecordWithMapping,
): ReferralInsight {
  const stageLabel = enumMapping(record.status, record.status__mapping);

  if (record.status === 'reward_issued') {
    return {
      ...record,
      stage_label: stageLabel,
    };
  }

  if (record.status === 'review_rejected') {
    return {
      ...record,
      stage_label: stageLabel,
    };
  }

  if (record.status === 'pending_review' || record.status === 'pending') {
    return {
      ...record,
      stage_label: stageLabel,
    };
  }

  return {
    ...record,
    stage_label: stageLabel,
  };
}

const ReferralsAdminPage: React.FC = () => {
  const initialSearchState = React.useMemo(readSearchState, []);
  const [form] = Form.useForm<API.ReferralRuleConfigPatchIn>();
  const tableActionRef = useRef<ActionType>(null);
  const [searchState, setSearchState] = useState(initialSearchState);
  const [keywordDraft, setKeywordDraft] = useState(initialSearchState.keyword);
  const [listError, setListError] = useState<unknown>();
  const [reviewState, setReviewState] = useState<{
    approved: boolean;
    record: API.ReferralRecordOut;
  }>();

  const configQuery = useQuery({
    queryKey: platformQueryKeys.referralConfig,
    queryFn: () => appsReferralsApiGetReferralConfig(),
  });

  React.useEffect(() => {
    if (configQuery.data) {
      form.setFieldsValue(configQuery.data);
    }
  }, [configQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: API.ReferralRuleConfigPatchIn) =>
      appsReferralsApiPatchReferralConfig(payload),
    onSuccess: () => {
      message.success('邀请奖励规则已保存');
      void configQuery.refetch();
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      record,
      approved,
    }: {
      record: API.ReferralRecordOut;
      approved: boolean;
    }) =>
      appsReferralsApiReviewReferralRecord(
        { record_id: record.id },
        { approved, remark: '' },
      ),
    onSuccess: (_data, variables) => {
      message.success(variables.approved ? '奖励审核已通过' : '奖励审核已驳回');
      setReviewState(undefined);
      tableActionRef.current?.reload();
    },
  });

  const updateSearchState = (next: Partial<ReferralSearchState>) => {
    setSearchState((current) => {
      const value = { ...current, ...next };
      syncSearchState(value);
      return value;
    });
  };

  const columns: ProColumns<ReferralInsight>[] = [
    {
      title: '邀请关系',
      dataIndex: 'invitee_display',
      width: 240,
      render: (_value, record) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{record.invitee_display}</Typography.Text>
          <Typography.Text type="secondary">{`邀请人 #${record.inviter_id} -> 被邀请人 #${record.invitee_id}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '当前阶段',
      dataIndex: 'status',
      width: 140,
      align: 'center',
      render: (_value, record) => (
        <AppStatusTag name="referral.record" state={record.status}>
          {record.stage_label}
        </AppStatusTag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 200,
      align: 'center',
      render: (_value, record) => (
        <Space orientation="vertical" size={6}>
          <Typography.Text>
            {dayjs(record.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
          <Typography.Text type="secondary">{`更新于 ${dayjs(record.updated_at).format('YYYY-MM-DD HH:mm')}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      align: 'center',
      render: (_value, record) => (
        <ResponsiveActions>
          {record.status === 'pending_review' || record.status === 'pending' ? (
            <>
              <Button
                type="link"
                size="small"
                loading={
                  reviewMutation.isPending &&
                  reviewMutation.variables?.record.id === record.id &&
                  reviewMutation.variables.approved
                }
                disabled={reviewMutation.isPending}
                onClick={() => setReviewState({ record, approved: true })}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                loading={
                  reviewMutation.isPending &&
                  reviewMutation.variables?.record.id === record.id &&
                  !reviewMutation.variables.approved
                }
                disabled={reviewMutation.isPending}
                onClick={() => setReviewState({ record, approved: false })}
              >
                驳回
              </Button>
            </>
          ) : (
            <Typography.Text type="secondary">已完成</Typography.Text>
          )}
        </ResponsiveActions>
      ),
    },
  ];

  return (
    <PageContainer title="邀请奖励">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card title="邀请奖励规则">
          {configQuery.isError ? (
            <Alert
              type="error"
              showIcon
              title="邀请奖励规则加载失败"
              action={
                <Button size="small" onClick={() => void configQuery.refetch()}>
                  重新加载规则
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {saveMutation.isError ? (
            <Alert
              type="error"
              showIcon
              title="邀请奖励规则保存失败，请稍后重试"
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => saveMutation.mutate(values)}
          >
            <Row gutter={[16, 12]} align="bottom">
              <Col xs={24} md={8} xl={6}>
                <Form.Item
                  label="邀请人奖励（分）"
                  name="inviter_reward_amount"
                >
                  <InputNumber min={0} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8} xl={6}>
                <Form.Item
                  label="被邀请人奖励（分）"
                  name="invitee_reward_amount"
                >
                  <InputNumber min={0} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="人工审核"
                  name="requires_manual_review"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="链接邀请"
                  name="allow_link"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={12} sm={8} md={4} xl={3}>
                <Form.Item
                  label="邀请码"
                  name="allow_code"
                  valuePropName="checked"
                >
                  <div style={compactSwitchStyle}>
                    <Switch />
                  </div>
                </Form.Item>
              </Col>
              <Col xs={24} md={8} xl={3}>
                <Form.Item label=" ">
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saveMutation.isPending}
                    style={fullWidthStyle}
                  >
                    保存规则
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {listError ? (
          <Alert
            type="error"
            showIcon
            title="邀请记录加载失败"
            description="暂时无法取得邀请记录，请检查网络后重试。"
            action={
              <Button
                size="small"
                onClick={() => tableActionRef.current?.reload()}
              >
                重新加载记录
              </Button>
            }
          />
        ) : null}
        <ProTable<ReferralInsight>
          actionRef={tableActionRef}
          rowKey="id"
          headerTitle="邀请记录"
          columns={columns}
          request={async (params: TablePageParams) => {
            try {
              const result = await appsReferralsApiAdminReferralRecords({
                page: params.current || 1,
                page_size: params.pageSize || PAGE_SIZE,
                keyword: trimParam(params.keyword),
                status: params.status,
                ...apiDateRange(params.createdFrom, params.createdTo),
              });
              setListError(undefined);
              return {
                data: ((result.items || []) as ReferralRecordWithMapping[]).map(
                  (item) => buildReferralInsight(item),
                ),
                total: result.total || 0,
                success: true,
              };
            } catch (error) {
              setListError(error);
              return { data: [], total: 0, success: true };
            }
          }}
          params={{
            keyword: searchState.keyword,
            status: searchState.status,
            createdFrom: searchState.createdFrom,
            createdTo: searchState.createdTo,
          }}
          search={false}
          options={{ density: true, reload: false, setting: true }}
          toolBarRender={() => [
            <AdminToolbar key="filters">
              <Input.Search
                aria-label="邀请记录关键词"
                allowClear
                placeholder="邀请人或被邀请人"
                style={toolbarControlStyle}
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                onSearch={(value) =>
                  updateSearchState({
                    page: 1,
                    keyword: trimParam(value) || '',
                  })
                }
              />
              <Select
                aria-label="邀请记录状态"
                allowClear
                placeholder="当前阶段"
                style={toolbarShortSelectStyle}
                value={searchState.status}
                options={referralStatusOptions}
                onChange={(status) => updateSearchState({ page: 1, status })}
              />
              <DatePicker.RangePicker
                aria-label="邀请记录创建时间"
                value={
                  searchState.createdFrom && searchState.createdTo
                    ? [
                        dayjs(searchState.createdFrom),
                        dayjs(searchState.createdTo),
                      ]
                    : null
                }
                onChange={(dates) =>
                  updateSearchState({
                    page: 1,
                    createdFrom: dates?.[0]?.format('YYYY-MM-DD') || '',
                    createdTo: dates?.[1]?.format('YYYY-MM-DD') || '',
                  })
                }
              />
              <Button
                onClick={() => {
                  setKeywordDraft('');
                  const reset: ReferralSearchState = {
                    page: 1,
                    keyword: '',
                    status: undefined,
                    createdFrom: '',
                    createdTo: '',
                  };
                  setSearchState(reset);
                  syncSearchState(reset);
                }}
              >
                重置
              </Button>
            </AdminToolbar>,
          ]}
          scroll={adminTableScroll}
          pagination={{
            current: searchState.page,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            onChange: (page) => updateSearchState({ page }),
          }}
          locale={listError ? { emptyText: '邀请记录加载失败' } : undefined}
        />
      </Space>

      <Modal
        title={
          reviewState?.approved ? '确认通过奖励审核？' : '确认驳回奖励审核？'
        }
        open={Boolean(reviewState)}
        okText="确定"
        cancelText="取消"
        confirmLoading={reviewMutation.isPending}
        mask={{ closable: !reviewMutation.isPending }}
        keyboard={!reviewMutation.isPending}
        closable={!reviewMutation.isPending}
        onCancel={() => setReviewState(undefined)}
        onOk={async () => {
          if (reviewState) {
            await reviewMutation.mutateAsync(reviewState);
          }
        }}
      >
        <Typography.Text>
          {reviewState?.approved
            ? '通过后奖励会发放至用户钱包。'
            : '驳回后该条邀请记录不会发放奖励。'}
        </Typography.Text>
      </Modal>
    </PageContainer>
  );
};

export default ReferralsAdminPage;
