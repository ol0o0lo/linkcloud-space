import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import type { FormInstance } from 'antd';
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppStatusTag } from '@/components/AppStatus';
import { PageContainer } from '@/components/PageContainer';
import {
  adminTableScroll,
  drawerWidthLg,
  drawerWidthXl,
} from '@/pages/_shared/adminLayout';
import MediaRefsUpload from '@/pages/rental/components/MediaRefsUpload';
import type { MediaRefValue } from '@/pages/rental/constants';
import {
  createHomeBanner,
  createHomeEntry,
  type HomeBanner,
  type HomeBannerAction,
  type HomeBannerPayload,
  type HomeEntry,
  type HomeEntryHouse,
  type HomeEntryKind,
  type HomeEntryPayload,
  type HomeHouse,
  listHomeBanners,
  listHomeEntries,
  listHomeEntryHouses,
  listHomeHouseCandidates,
  saveHomeEntryHouses,
  updateHomeBanner,
  updateHomeEntry,
} from './service';

const PAGE_SIZE = 10;

const bannerToneOptions = [
  { value: 'blue', label: '蓝色' },
  { value: 'violet', label: '紫色' },
  { value: 'teal', label: '青色' },
];
const topicToneOptions = [
  { value: 'sage', label: '青绿' },
  { value: 'lavender', label: '淡紫' },
];
const guideToneOptions = [
  { value: 'slate', label: '灰蓝' },
  { value: 'clay', label: '暖棕' },
];
const actionOptions = [
  { value: 'entry', label: '专题或指南' },
  { value: 'house_list', label: '条件找房' },
  { value: 'house_map', label: '地图找房' },
];

type ScheduleFormValues = {
  long_term: boolean;
  schedule?: [Dayjs, Dayjs];
  is_enabled: boolean;
};

type EntryFormValues = ScheduleFormValues & {
  eyebrow: string;
  title: string;
  summary: string;
  cover_image: MediaRefValue[];
  body_markdown: string;
  tone: string;
  sort_order: number;
};

type BannerFormValues = ScheduleFormValues & {
  eyebrow: string;
  title: string;
  description: string;
  button_text: string;
  image: MediaRefValue[];
  tone: string;
  action_type: HomeBannerAction;
  entry_id?: number;
  sort_order: number;
};

function schedulePayload(values: ScheduleFormValues) {
  if (values.long_term) {
    return { is_enabled: values.is_enabled, starts_at: null, ends_at: null };
  }
  if (!values.schedule) throw new Error('请选择有效期');
  return {
    is_enabled: values.is_enabled,
    starts_at: values.schedule[0].toISOString(),
    ends_at: values.schedule[1].toISOString(),
  };
}

function scheduleInitial(record?: {
  starts_at: string | null;
  ends_at: string | null;
  is_enabled: boolean;
}) {
  const longTerm = !record?.starts_at && !record?.ends_at;
  return {
    long_term: longTerm,
    is_enabled: record?.is_enabled ?? false,
    schedule:
      !longTerm && record?.starts_at && record.ends_at
        ? ([dayjs(record.starts_at), dayjs(record.ends_at)] as [Dayjs, Dayjs])
        : undefined,
  };
}

function formatPeriod(record: {
  starts_at: string | null;
  ends_at: string | null;
}) {
  if (!record.starts_at && !record.ends_at) return '长期有效';
  if (!record.starts_at || !record.ends_at) return '时间配置异常';
  return `${dayjs(record.starts_at).format('YYYY-MM-DD HH:mm')} 至 ${dayjs(record.ends_at).format('YYYY-MM-DD HH:mm')}`;
}

const Cover: React.FC<{ value?: MediaRefValue[] }> = ({ value }) => {
  const image = value?.[0];
  if (!image?.url && !image?.thumbnail)
    return <Typography.Text type="secondary">未上传</Typography.Text>;
  return (
    <Image
      alt="首页内容配图"
      width={72}
      height={48}
      style={{ objectFit: 'cover', borderRadius: 6 }}
      src={image.thumbnail || image.url}
      preview={{ src: image.url }}
    />
  );
};

function ScheduleFields<T extends ScheduleFormValues>({
  form,
}: {
  form: FormInstance<T>;
}) {
  const longTerm = Form.useWatch('long_term', form);
  return (
    <>
      <Form.Item label="长期有效" name="long_term" valuePropName="checked">
        <Switch />
      </Form.Item>
      {!longTerm ? (
        <Form.Item
          label="有效期"
          name="schedule"
          rules={[{ required: true, message: '请选择有效期' }]}
        >
          <DatePicker.RangePicker showTime style={{ width: '100%' }} />
        </Form.Item>
      ) : null}
      <Form.Item
        label="启用"
        name="is_enabled"
        valuePropName="checked"
        extra="启用后仍会按照有效期自动判断是否展示。"
      >
        <Switch />
      </Form.Item>
    </>
  );
}

const EntryEditorDrawer: React.FC<{
  kind: HomeEntryKind;
  record?: HomeEntry;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ kind, record, open, onClose, onSaved }) => {
  const [form] = Form.useForm<EntryFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      eyebrow: record?.eyebrow || (kind === 'topic' ? '精选专题' : '实用指南'),
      title: record?.title || '',
      summary: record?.summary || '',
      cover_image: record?.cover_image || [],
      body_markdown: record?.body_markdown || '',
      tone: record?.tone || (kind === 'topic' ? 'sage' : 'slate'),
      sort_order: record?.sort_order ?? 100,
      ...scheduleInitial(record),
    });
  }, [form, kind, open, record]);

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload: HomeEntryPayload = {
        kind,
        eyebrow: values.eyebrow.trim(),
        title: values.title.trim(),
        summary: values.summary.trim(),
        cover_image: values.cover_image || [],
        body_markdown: values.body_markdown || '',
        tone: values.tone,
        sort_order: values.sort_order,
        ...schedulePayload(values),
      };
      if (record) await updateHomeEntry(record.id, payload);
      else await createHomeEntry(payload);
      message.success(record ? '内容已更新' : '内容已创建');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      size={drawerWidthLg}
      title={`${record ? '编辑' : '新增'}${kind === 'topic' ? '专题活动' : '指南/攻略'}`}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item label="眉标题" name="eyebrow" rules={[{ max: 40 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: '请输入标题' }, { max: 120 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="摘要"
          name="summary"
          rules={[{ required: true, message: '请输入摘要' }, { max: 240 }]}
        >
          <Input.TextArea rows={3} showCount maxLength={240} />
        </Form.Item>
        <Form.Item label="封面图片" name="cover_image">
          <MediaRefsUpload
            resourceType="miniprogram_home_image"
            scope="user"
            mediaType="image"
            maxCount={1}
            enableImageRoles={false}
          />
        </Form.Item>
        <Form.Item label="色调" name="tone" rules={[{ required: true }]}>
          <Select
            options={kind === 'topic' ? topicToneOptions : guideToneOptions}
          />
        </Form.Item>
        <Form.Item
          label="Markdown 正文（小程序展示）"
          name="body_markdown"
          extra="这里填写可直接发布的完整正文，保存并启用后会在小程序详情页展示；支持标题、段落、列表、引用、链接和代码。"
        >
          <Input.TextArea rows={16} />
        </Form.Item>
        <Form.Item label="排序" name="sort_order" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <ScheduleFields form={form} />
      </Form>
    </Drawer>
  );
};

const BannerEditorDrawer: React.FC<{
  record?: HomeBanner;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ record, open, onClose, onSaved }) => {
  const [form] = Form.useForm<BannerFormValues>();
  const actionType = Form.useWatch('action_type', form);
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listHomeEntries({ page: 1, page_size: 500 }).then((result) =>
      setEntries(result.items),
    );
    form.setFieldsValue({
      eyebrow: record?.eyebrow || '',
      title: record?.title || '',
      description: record?.description || '',
      button_text: record?.button_text || '查看详情',
      image: record?.image || [],
      tone: record?.tone || 'blue',
      action_type: record?.action_type || 'house_list',
      entry_id: record?.entry_id || undefined,
      sort_order: record?.sort_order ?? 100,
      ...scheduleInitial(record),
    });
  }, [form, open, record]);

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload: HomeBannerPayload = {
        eyebrow: values.eyebrow.trim(),
        title: values.title.trim(),
        description: values.description.trim(),
        button_text: values.button_text.trim(),
        image: values.image || [],
        tone: values.tone,
        action_type: values.action_type,
        entry_id:
          values.action_type === 'entry' ? values.entry_id || null : null,
        sort_order: values.sort_order,
        ...schedulePayload(values),
      };
      if (record) await updateHomeBanner(record.id, payload);
      else await createHomeBanner(payload);
      message.success(record ? 'Banner 已更新' : 'Banner 已创建');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      size={drawerWidthLg}
      title={`${record ? '编辑' : '新增'} Banner`}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item label="眉标题" name="eyebrow" rules={[{ max: 40 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: '请输入标题' }, { max: 120 }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          label="说明"
          name="description"
          rules={[{ required: true, message: '请输入说明' }, { max: 240 }]}
        >
          <Input.TextArea rows={3} showCount maxLength={240} />
        </Form.Item>
        <Form.Item
          label="按钮文字"
          name="button_text"
          rules={[{ required: true }, { max: 20 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="配图" name="image">
          <MediaRefsUpload
            resourceType="miniprogram_home_image"
            scope="user"
            mediaType="image"
            maxCount={1}
            enableImageRoles={false}
          />
        </Form.Item>
        <Form.Item label="色调" name="tone" rules={[{ required: true }]}>
          <Select options={bannerToneOptions} />
        </Form.Item>
        <Form.Item
          label="点击动作"
          name="action_type"
          rules={[{ required: true }]}
        >
          <Select
            options={actionOptions}
            onChange={() => form.setFieldValue('entry_id', undefined)}
          />
        </Form.Item>
        {actionType === 'entry' ? (
          <Form.Item
            label="关联专题或指南"
            name="entry_id"
            rules={[{ required: true, message: '请选择关联内容' }]}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={entries.map((entry) => ({
                value: entry.id,
                label: `${entry.kind__mapping} · ${entry.title}`,
              }))}
            />
          </Form.Item>
        ) : null}
        <Form.Item label="排序" name="sort_order" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <ScheduleFields form={form} />
      </Form>
    </Drawer>
  );
};

const HouseSelectionDrawer: React.FC<{
  entry?: HomeEntry;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}> = ({ entry, open, onClose, onSaved }) => {
  const [selected, setSelected] = useState<HomeEntryHouse[]>([]);
  const [candidates, setCandidates] = useState<HomeHouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setLoading(true);
    void Promise.all([
      listHomeEntryHouses(entry.id),
      listHomeHouseCandidates({ page: 1, page_size: 500 }),
    ])
      .then(([links, houses]) => {
        setSelected(links.items);
        setCandidates(houses.items);
      })
      .finally(() => setLoading(false));
  }, [entry, open]);

  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.house.id)),
    [selected],
  );
  const candidateOptions = candidates
    .filter((house) => !selectedIds.has(house.id))
    .map((house) => ({ value: house.id, label: house.display_name }));

  const addHouse = (houseId: number) => {
    const house = candidates.find((item) => item.id === houseId);
    if (!house) return;
    setSelected((current) => [
      ...current,
      {
        house,
        sort_order: (current.length + 1) * 10,
        recommendation_reason: '',
      },
    ]);
  };

  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= selected.length) return;
    setSelected((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await saveHomeEntryHouses(
        entry.id,
        selected.map((item) => ({
          house_id: item.house.id,
          recommendation_reason: item.recommendation_reason.trim(),
        })),
      );
      message.success('专题房源已保存');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      size={drawerWidthXl}
      title={`管理专题房源${entry ? ` · ${entry.title}` : ''}`}
      onClose={onClose}
      loading={loading}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存房源
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Select
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="搜索并加入当前公开房源"
          options={candidateOptions}
          value={undefined}
          onChange={addHouse}
          style={{ width: '100%' }}
        />
        {selected.length ? (
          selected.map((item, index) => (
            <div
              key={item.house.id}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(220px, 1fr) minmax(220px, 1.2fr) auto',
                gap: 12,
                alignItems: 'center',
                padding: 12,
                border: '1px solid var(--ant-color-border)',
                borderRadius: 8,
              }}
            >
              <Space orientation="vertical" size={2}>
                <Typography.Text strong>
                  {item.house.display_name}
                </Typography.Text>
                <Typography.Text
                  type={
                    item.house.status === 'listed' ? 'secondary' : 'warning'
                  }
                >
                  {item.house.status__mapping} · {item.house.layout} ·{' '}
                  {item.house.asking_rent
                    ? `¥${item.house.asking_rent}/月`
                    : '租金待确认'}
                </Typography.Text>
              </Space>
              <Input
                value={item.recommendation_reason}
                maxLength={120}
                placeholder="推荐理由（选填）"
                onChange={(event) =>
                  setSelected((current) =>
                    current.map((candidate) =>
                      candidate.house.id === item.house.id
                        ? {
                            ...candidate,
                            recommendation_reason: event.target.value,
                          }
                        : candidate,
                    ),
                  )
                }
              />
              <Space>
                <Button
                  aria-label="上移"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <Button
                  aria-label="下移"
                  icon={<ArrowDownOutlined />}
                  disabled={index === selected.length - 1}
                  onClick={() => move(index, 1)}
                />
                <Button
                  danger
                  aria-label="移除"
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    setSelected((current) =>
                      current.filter(
                        (candidate) => candidate.house.id !== item.house.id,
                      ),
                    )
                  }
                />
              </Space>
            </div>
          ))
        ) : (
          <Alert
            type="info"
            showIcon
            title="尚未选择房源"
            description="专题可以先发布正文，之后再加入公开招租房源。"
          />
        )}
      </Space>
    </Drawer>
  );
};

const MiniProgramHomePage: React.FC = () => {
  const bannerActionRef = useRef<ActionType>(null);
  const entryActionRef = useRef<ActionType>(null);
  const [activeTab, setActiveTab] = useState<'banner' | HomeEntryKind>(
    'banner',
  );
  const [bannerEditor, setBannerEditor] = useState<{
    open: boolean;
    record?: HomeBanner;
  }>({ open: false });
  const [entryEditor, setEntryEditor] = useState<{
    open: boolean;
    record?: HomeEntry;
  }>({ open: false });
  const [houseEditor, setHouseEditor] = useState<{
    open: boolean;
    entry?: HomeEntry;
  }>({ open: false });

  const refresh = () => {
    bannerActionRef.current?.reload();
    entryActionRef.current?.reload();
  };

  const bannerColumns: ProColumns<HomeBanner>[] = [
    {
      title: '配图',
      dataIndex: 'image',
      width: 96,
      search: false,
      render: (_value, record) => <Cover value={record.image} />,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Text type="secondary">
            {record.description}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '点击动作',
      dataIndex: 'action_type__mapping',
      width: 150,
      search: false,
      render: (_value, record) =>
        record.entry_title
          ? `${record.action_type__mapping} · ${record.entry_title}`
          : record.action_type__mapping,
    },
    {
      title: '状态',
      dataIndex: 'display_status',
      width: 120,
      search: false,
      render: (_value, record) => (
        <AppStatusTag
          name="miniprogram-home.item"
          state={record.display_status}
        >
          {record.display_status__mapping}
        </AppStatusTag>
      ),
    },
    {
      title: '有效期',
      dataIndex: 'period',
      width: 280,
      search: false,
      render: (_value, record) => formatPeriod(record),
    },
    { title: '排序', dataIndex: 'sort_order', width: 80, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => setBannerEditor({ open: true, record })}
          >
            编辑
          </Button>
          <Switch
            size="small"
            checked={record.is_enabled}
            onChange={(checked) =>
              void updateHomeBanner(record.id, { is_enabled: checked }).then(
                () => refresh(),
              )
            }
          />
        </Space>
      ),
    },
  ];

  const entryColumns: ProColumns<HomeEntry>[] = [
    {
      title: '封面',
      dataIndex: 'cover_image',
      width: 96,
      search: false,
      render: (_value, record) => <Cover value={record.cover_image} />,
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Text type="secondary">{record.summary}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'display_status',
      width: 120,
      search: false,
      render: (_value, record) => (
        <AppStatusTag
          name="miniprogram-home.item"
          state={record.display_status}
        >
          {record.display_status__mapping}
        </AppStatusTag>
      ),
    },
    {
      title: '专题房源',
      dataIndex: 'house_count',
      width: 100,
      search: false,
      render: (_value, record) =>
        record.kind === 'topic' ? `${record.house_count} 套` : '—',
    },
    {
      title: '有效期',
      dataIndex: 'period',
      width: 280,
      search: false,
      render: (_value, record) => formatPeriod(record),
    },
    { title: '排序', dataIndex: 'sort_order', width: 80, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      render: (_value, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => setEntryEditor({ open: true, record })}
          >
            编辑
          </Button>
          {record.kind === 'topic' ? (
            <Button
              type="link"
              icon={<HomeOutlined />}
              onClick={() => setHouseEditor({ open: true, entry: record })}
            >
              管理房源
            </Button>
          ) : null}
          <Switch
            size="small"
            checked={record.is_enabled}
            onChange={(checked) =>
              void updateHomeEntry(record.id, { is_enabled: checked }).then(
                () => refresh(),
              )
            }
          />
        </Space>
      ),
    },
  ];

  const table =
    activeTab === 'banner' ? (
      <ProTable<HomeBanner>
        actionRef={bannerActionRef}
        rowKey="id"
        columns={bannerColumns}
        search={false}
        pagination={{ defaultPageSize: PAGE_SIZE }}
        request={async (params) => {
          const result = await listHomeBanners({
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: result.items, total: result.total, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setBannerEditor({ open: true })}
          >
            新增 Banner
          </Button>,
        ]}
        scroll={adminTableScroll}
      />
    ) : (
      <ProTable<HomeEntry>
        key={activeTab}
        actionRef={entryActionRef}
        rowKey="id"
        columns={entryColumns}
        search={false}
        pagination={{ defaultPageSize: PAGE_SIZE }}
        request={async (params) => {
          const result = await listHomeEntries({
            kind: activeTab,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: result.items, total: result.total, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEntryEditor({ open: true })}
          >
            新增{activeTab === 'topic' ? '专题活动' : '租房指南'}
          </Button>,
        ]}
        scroll={adminTableScroll}
      />
    );

  return (
    <PageContainer>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="小程序首页设置"
          description="这里维护的是可直接发布的首页内容，不是占位信息。首页对所有身份保持一致；Banner 最多展示前 5 条，专题活动和指南/攻略各展示前 2 条，停用或超过有效期后自动撤下。"
        />
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'banner' | HomeEntryKind)}
          items={[
            { key: 'banner', label: 'Banner' },
            { key: 'topic', label: '专题活动' },
            { key: 'guide', label: '指南/攻略' },
          ]}
        />
        {table}
      </Space>
      <BannerEditorDrawer
        open={bannerEditor.open}
        record={bannerEditor.record}
        onClose={() => setBannerEditor({ open: false })}
        onSaved={refresh}
      />
      <EntryEditorDrawer
        kind={activeTab === 'guide' ? 'guide' : 'topic'}
        open={entryEditor.open}
        record={entryEditor.record}
        onClose={() => setEntryEditor({ open: false })}
        onSaved={refresh}
      />
      <HouseSelectionDrawer
        open={houseEditor.open}
        entry={houseEditor.entry}
        onClose={() => setHouseEditor({ open: false })}
        onSaved={refresh}
      />
    </PageContainer>
  );
};

export default MiniProgramHomePage;
