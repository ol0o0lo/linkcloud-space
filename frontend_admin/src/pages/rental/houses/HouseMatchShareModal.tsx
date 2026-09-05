import { CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import type {
  HouseMatchCriteria,
  HouseMatchMode,
  HouseMatchShareCreateInput,
  HouseMatchShareCreateResult,
  HouseMatchShareListItem,
} from '@/services/manual/house';
import { houseApi } from '@/services/manual/house';

type SelectOption = { label: React.ReactNode; value: string | number };

type HouseMatchShareFormValues = HouseMatchCriteria & {
  title: string;
  remark?: string;
  mode: HouseMatchMode;
  expiresAt?: Dayjs;
  neverExpires?: boolean;
};

type HouseMatchShareModalProps = {
  open: boolean;
  selectedHouseIds: number[];
  decorationOptions?: SelectOption[];
  onCancel: () => void;
  onCreated?: (result: HouseMatchShareCreateResult) => void;
};

const SORT_OPTIONS = [
  { label: '最近更新', value: 'latest' },
  { label: '租金从低到高', value: 'rent_asc' },
  { label: '租金从高到低', value: 'rent_desc' },
  { label: '面积从小到大', value: 'area_asc' },
  { label: '面积从大到小', value: 'area_desc' },
];

const ELEVATOR_OPTIONS = [
  { label: '有电梯可达', value: true },
  { label: '无电梯可达', value: false },
];

const SHARE_STATUS_META = {
  active: { color: 'green', label: '有效' },
  expired: { color: 'gold', label: '已过期' },
  revoked: { color: 'default', label: '已失效' },
} as const;

const CRITERIA_KEYS: (keyof HouseMatchCriteria)[] = [
  'keyword',
  'province',
  'city',
  'district',
  'min_rent',
  'max_rent',
  'min_area',
  'max_area',
  'bedrooms',
  'living_rooms',
  'decoration',
  'has_elevator_access',
  'tags',
  'sort',
];

export function buildHouseMatchSharePayload(
  values: HouseMatchShareFormValues,
  selectedHouseIds: number[],
): HouseMatchShareCreateInput {
  const payload: HouseMatchShareCreateInput = {
    title: values.title.trim(),
    remark: values.remark?.trim() || '',
    mode: values.mode,
    expires_at: values.neverExpires ? null : values.expiresAt?.toISOString(),
  };
  if (values.mode === 'manual') {
    payload.house_ids = selectedHouseIds;
    return payload;
  }

  payload.criteria = Object.fromEntries(
    CRITERIA_KEYS.map((key) => [key, values[key]]).filter(
      ([key, value]) =>
        key === 'sort' ||
        (value !== undefined &&
          value !== null &&
          value !== '' &&
          (!Array.isArray(value) || value.length > 0)),
    ),
  ) as HouseMatchCriteria;
  return payload;
}

function hasDynamicFilter(criteria: HouseMatchCriteria | undefined) {
  if (!criteria) return false;
  return Object.entries(criteria).some(
    ([key, value]) =>
      key !== 'sort' &&
      value !== undefined &&
      value !== null &&
      value !== '' &&
      (!Array.isArray(value) || value.length > 0),
  );
}

export function mergeHouseMatchSelection(
  current: number[],
  nextKeys: React.Key[],
  limit = 100,
) {
  const next = nextKeys
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);
  const retained = current.filter((id) => next.includes(id));
  const additions = next.filter((id) => !current.includes(id));
  const merged = [...retained, ...additions];
  return merged.length <= limit ? merged : current;
}

export const HouseMatchShareModal: React.FC<HouseMatchShareModalProps> = ({
  open,
  selectedHouseIds,
  decorationOptions = [],
  onCancel,
  onCreated,
}) => {
  const [form] = Form.useForm<HouseMatchShareFormValues>();
  const [result, setResult] = useState<HouseMatchShareCreateResult | null>(
    null,
  );
  const [historyPage, setHistoryPage] = useState(1);
  const mode = Form.useWatch('mode', form);
  const neverExpires = Form.useWatch('neverExpires', form);
  const historyQuery = useQuery({
    queryKey: ['house-match-shares', historyPage],
    queryFn: () =>
      houseApi.listHouseMatchShares({ page: historyPage, page_size: 5 }),
    enabled: open,
  });
  const createShare = useMutation({
    mutationFn: (payload: HouseMatchShareCreateInput) =>
      houseApi.createHouseMatchShare(payload),
    onSuccess: async (created) => {
      setResult(created);
      onCreated?.(created);
      await historyQuery.refetch();
    },
  });
  const extendShare = useMutation({
    mutationFn: ({
      shareId,
      expiresAt,
    }: {
      shareId: number;
      expiresAt: string;
    }) => houseApi.extendHouseMatchShare(shareId, { expires_at: expiresAt }),
    onSuccess: async () => {
      await historyQuery.refetch();
      message.success('配房链接已延期 30 天');
    },
  });
  const revokeShare = useMutation({
    mutationFn: (shareId: number) => houseApi.revokeHouseMatchShare(shareId),
    onSuccess: async () => {
      await historyQuery.refetch();
      message.success('配房链接已失效');
    },
  });

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setHistoryPage(1);
    form.resetFields();
    form.setFieldsValue({
      mode: selectedHouseIds.length ? 'manual' : 'dynamic',
      expiresAt: dayjs().add(30, 'day'),
      neverExpires: false,
      sort: 'latest',
    });
  }, [form, open, selectedHouseIds.length]);

  const close = () => {
    if (createShare.isPending) return;
    setResult(null);
    form.resetFields();
    onCancel();
  };

  const submit = async (values: HouseMatchShareFormValues) => {
    const payload = buildHouseMatchSharePayload(values, selectedHouseIds);
    if (payload.mode === 'manual' && !payload.house_ids?.length) {
      message.warning('请先在房源列表中选择至少一套招租房源');
      return;
    }
    if (payload.mode === 'dynamic' && !hasDynamicFilter(payload.criteria)) {
      message.warning('动态配房至少需要填写一个筛选条件');
      return;
    }
    await createShare.mutateAsync(payload);
  };

  const historyColumns: TableColumnsType<HouseMatchShareListItem> = [
    {
      title: '配房链接',
      dataIndex: 'title',
      width: 220,
      render: (_value, share) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{share.title}</Typography.Text>
          <Typography.Text type="secondary">
            {share.mode === 'manual' ? '手工配房' : '动态配房'} · 创建于{' '}
            {dayjs(share.created_at).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (_value, share) => {
        const status = SHARE_STATUS_META[share.status];
        return (
          <Space orientation="vertical" size={4}>
            <Tag color={status.color}>{status.label}</Tag>
            <Typography.Text type="secondary">
              {share.expires_at
                ? `到期 ${dayjs(share.expires_at).format('YYYY-MM-DD HH:mm')}`
                : '永不过期'}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '访问',
      dataIndex: 'view_count',
      width: 150,
      render: (_value, share) => (
        <Space orientation="vertical" size={4}>
          <Typography.Text>{`${share.view_count} 次`}</Typography.Text>
          <Typography.Text type="secondary">
            {share.last_accessed_at
              ? `最近 ${dayjs(share.last_accessed_at).format('MM-DD HH:mm')}`
              : '暂无访问'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_value, share) => (
        <Space size="small" wrap={false}>
          <Button
            type="link"
            size="small"
            onClick={async () => {
              await navigator.clipboard.writeText(share.share_url);
              message.success('配房链接已复制');
            }}
          >
            复制
          </Button>
          {share.status !== 'revoked' && share.expires_at ? (
            <Button
              type="link"
              size="small"
              loading={extendShare.isPending}
              onClick={() => {
                const currentExpiry = dayjs(share.expires_at);
                const base = currentExpiry.isAfter(dayjs())
                  ? currentExpiry
                  : dayjs();
                void extendShare.mutateAsync({
                  shareId: share.id,
                  expiresAt: base.add(30, 'day').toISOString(),
                });
              }}
            >
              延期 30 天
            </Button>
          ) : null}
          {share.status !== 'revoked' ? (
            <Popconfirm
              title="确认让这个配房链接立即失效吗？"
              okText="确定失效"
              cancelText="取消"
              onConfirm={() => revokeShare.mutateAsync(share.id)}
            >
              <Button type="link" danger size="small">
                立即失效
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const historySection = (
    <>
      <Divider titlePlacement="start">历史链接</Divider>
      {historyQuery.isError ? (
        <Alert
          showIcon
          type="error"
          title="历史链接加载失败"
          action={
            <Button size="small" onClick={() => historyQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      ) : (
        <Table<HouseMatchShareListItem>
          rowKey="id"
          size="small"
          loading={historyQuery.isLoading}
          columns={historyColumns}
          dataSource={historyQuery.data?.items || []}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: historyPage,
            pageSize: 5,
            total: historyQuery.data?.total || 0,
            showSizeChanger: false,
            onChange: setHistoryPage,
          }}
        />
      )}
    </>
  );

  if (result) {
    return (
      <Modal
        destroyOnHidden
        open={open}
        width="min(960px, calc(100vw - 24px))"
        title="配房链接已生成"
        onCancel={close}
        footer={
          <Space>
            <Button onClick={close}>关闭</Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={async () => {
                await navigator.clipboard.writeText(result.share_url);
                message.success('配房链接已复制');
              }}
            >
              复制链接
            </Button>
          </Space>
        }
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="success"
            title="链接内容不可修改，如需调整请重新生成"
          />
          <Input
            readOnly
            aria-label="配房分享链接"
            prefix={<LinkOutlined />}
            value={result.share_url}
          />
          <Typography.Text type="secondary">
            此链接已保存到历史记录，可随时复制、延期或立即失效。
          </Typography.Text>
          {historySection}
        </Space>
      </Modal>
    );
  }

  return (
    <Modal
      destroyOnHidden
      open={open}
      width="min(960px, calc(100vw - 24px))"
      title="生成配房链接"
      okText="生成链接"
      cancelText="取消"
      confirmLoading={createShare.isPending}
      onCancel={close}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={submit}
      >
        <Form.Item label="配房方式" name="mode" rules={[{ required: true }]}>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              {
                label: `手工选择（${selectedHouseIds.length} 套）`,
                value: 'manual',
              },
              { label: '动态筛选', value: 'dynamic' },
            ]}
          />
        </Form.Item>

        {mode === 'manual' ? (
          <Alert
            showIcon
            type={selectedHouseIds.length ? 'info' : 'warning'}
            title={
              selectedHouseIds.length
                ? `将按选择顺序分享 ${selectedHouseIds.length} 套房源，房源下架后会自动跳过。`
                : '请先关闭弹窗，在房源列表中勾选招租房源。'
            }
            style={{ marginBottom: 16 }}
          />
        ) : (
          <>
            <Alert
              showIcon
              type="info"
              title="访问链接时会按以下条件实时查询招租房源，至少填写一个筛选条件。"
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="关键词" name="keyword">
                  <Input placeholder="房号、小区、楼栋或公开描述" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="标签" name="tags">
                  <Select
                    mode="tags"
                    placeholder="输入标签后回车"
                    tokenSeparators={[',', '，']}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="省份" name="province">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="城市" name="city">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="区县" name="district">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="最低租金" name="min_rent">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="最高租金" name="max_rent">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="最小面积" name="min_area">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="最大面积" name="max_area">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="卧室数" name="bedrooms">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="客厅数" name="living_rooms">
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="装修" name="decoration">
                  <Select allowClear options={decorationOptions} />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="电梯" name="has_elevator_access">
                  <Select allowClear options={ELEVATOR_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="排序" name="sort">
                  <Select options={SORT_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="标题"
              name="title"
              rules={[
                { required: true, message: '请输入配房标题' },
                { max: 150, message: '标题最多 150 个字符' },
              ]}
            >
              <Input placeholder="例如：南山一房精选" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="到期时间" required={!neverExpires}>
              <Space>
                <Form.Item
                  name="expiresAt"
                  noStyle
                  rules={
                    neverExpires
                      ? []
                      : [{ required: true, message: '请选择到期时间' }]
                  }
                >
                  <DatePicker
                    showTime
                    disabled={neverExpires}
                    disabledDate={(current) =>
                      current.endOf('day').isBefore(dayjs())
                    }
                  />
                </Form.Item>
                <Form.Item name="neverExpires" valuePropName="checked" noStyle>
                  <Checkbox>永不过期</Checkbox>
                </Form.Item>
              </Space>
            </Form.Item>
          </Col>
        </Row>
        {neverExpires ? (
          <Alert
            showIcon
            type="warning"
            title="永不过期链接创建后无法撤回，可能被长期传播。"
            style={{ marginBottom: 16 }}
          />
        ) : null}
        <Form.Item label="统一备注" name="remark">
          <Input.TextArea
            rows={3}
            maxLength={5000}
            showCount
            placeholder="所有房源共用的说明，可不填"
          />
        </Form.Item>
      </Form>
      {historySection}
    </Modal>
  );
};
