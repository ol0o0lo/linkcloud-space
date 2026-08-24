import {
  CheckCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import { Fragment, type KeyboardEvent } from 'react';
import type {
  VacancySyncBlock,
  VacancySyncLine,
  VacancySyncResult,
} from '@/services/manual/house';
import { housePrimaryLayoutText } from '../constants';

export const SAMPLE_TEXT = `下元岗东街三巷1号
102复式大单间1380
202一房1750光线好
401一房1800无遮挡
602超级大单间1700无遮挡

上元岗西街50号
103一房 1450
104 单间 1250
203 一房 1700`;

const BUILDING_MATCH_META: Record<
  VacancySyncBlock['building_match']['status'],
  { color: string; label: string }
> = {
  matched: { color: 'blue', label: '已匹配楼栋' },
  overridden: { color: 'cyan', label: '已指定楼栋' },
  ambiguous: { color: 'orange', label: '请选择楼栋' },
  new: { color: 'orange', label: '将新建楼栋' },
  created: { color: 'green', label: '已新建楼栋' },
};

const CHANGE_FIELD_LABELS: Record<string, string> = {
  floor: '楼层',
  asking_rent: '租金',
  bedrooms: '房数',
  living_rooms: '厅数',
  tags: '标签',
  status: '房态',
};

const useStyles = createStyles(({ token, css }) => ({
  root: css`
    padding-bottom: 16px;
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;

    @media (max-width: 575px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  metricCard: css`
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  metricValue: css`
    display: block;
    margin-bottom: 4px;
    color: ${token.colorText};
    font-size: 22px;
    font-weight: ${token.fontWeightStrong};
    line-height: 1.15;
  `,
  metricValueSuccess: css`
    color: ${token.colorSuccess};
  `,
  metricValueWarning: css`
    color: ${token.colorWarning};
  `,
  metricLabel: css`
    display: block;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  secondaryTags: css`
    margin-top: -4px;
    margin-bottom: 12px;
  `,
  workspace: css`
    display: grid;
    min-width: 0;
    align-items: start;
    grid-template-columns: minmax(320px, 34%) minmax(0, 1fr);
    gap: 12px;

    @media (max-width: 1100px) {
      grid-template-columns: minmax(300px, 40%) minmax(0, 1fr);
    }

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  sourceColumn: css`
    min-width: 0;

    @media (min-width: 1200px) {
      position: sticky;
      top: 16px;
    }
  `,
  sourceCard: css`
    .ant-card-head {
      min-height: 46px;
      padding-inline: 14px;
    }

    .ant-card-body {
      padding: 12px 14px 14px;
    }
  `,
  textarea: css`
    font-family: ${token.fontFamilyCode};
    line-height: 1.72;
    resize: vertical;
  `,
  sourceMeta: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  sourceHint: css`
    margin-top: 10px;
    padding: 9px 10px;
    border: 1px solid ${token.colorWarningBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorWarningBg};
    color: ${token.colorWarningText};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.55;
  `,
  issueList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  `,
  resultColumn: css`
    position: relative;
    min-width: 0;
  `,
  emptyCard: css`
    display: flex;
    min-height: 480px;
    align-items: center;
    justify-content: center;

    .ant-empty-description {
      max-width: 360px;
      margin-inline: auto;
      color: ${token.colorTextSecondary};
      line-height: 1.65;
    }
  `,
  staleContent: css`
    pointer-events: none;
    opacity: 0.48;
    filter: grayscale(0.2);
  `,
  buildingCard: css`
    margin-bottom: 10px;

    .ant-card-head {
      min-height: 48px;
      padding-inline: 14px;
    }

    .ant-card-body {
      padding: 12px 14px 14px;
    }
  `,
  buildingTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  `,
  buildingName: css`
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  changeGrid: css`
    display: grid;
    align-items: start;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 8px 10px;
    margin-bottom: 12px;

    @media (max-width: 575px) {
      grid-template-columns: 1fr;
    }
  `,
  changeLabel: css`
    padding-top: 3px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  detailHeading: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  `,
  rawCode: css`
    display: block;
    overflow: hidden;
    font-family: ${token.fontFamilyCode};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  parsedLine: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  `,
  parsedMain: css`
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  `,
  sourceActions: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  `,
  sourceCompleted: css`
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  sourceCompletedSummary: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  `,
  sourceCompletedActions: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  `,
}));

type SourcePanelProps = {
  rawText: string;
  preview: VacancySyncResult | null;
  previewStale: boolean;
  onChange: (value: string) => void;
  onPreview: () => void;
  onClear: () => void;
  canConfirm: boolean;
  previewing: boolean;
  applying: boolean;
  onConfirm: () => void;
  onReset: () => void;
  onViewHouses: () => void;
};

export function VacancySyncSourcePanel({
  rawText,
  preview,
  previewStale,
  onChange,
  onPreview,
  onClear,
  canConfirm,
  previewing,
  applying,
  onConfirm,
  onReset,
  onViewHouses,
}: SourcePanelProps) {
  const { styles } = useStyles();
  const issueLines = preview?.errors
    .map((error) => error.line_number)
    .filter((line): line is number => typeof line === 'number');
  const sourceStatus = previewStale
    ? { color: 'warning', text: '预览失效' }
    : preview && !preview.applied && !preview.can_apply
      ? { color: 'error', text: '存在问题' }
      : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onPreview();
    }
  };

  return (
    <div
      className={styles.sourceColumn}
      data-testid="vacancy-sync-source-panel"
    >
      <Card
        className={styles.sourceCard}
        size="small"
        title={
          <Space size={8}>
            <FileTextOutlined />
            <Typography.Text strong>原始房表</Typography.Text>
          </Space>
        }
        extra={
          <Space size={4}>
            {sourceStatus ? (
              <Tag color={sourceStatus.color}>{sourceStatus.text}</Tag>
            ) : null}
            <Popover
              trigger="click"
              color="#1f1f1f"
              title={
                <Typography.Text strong style={{ color: '#fff' }}>
                  房表粘贴格式
                </Typography.Text>
              }
              content={
                <Space
                  orientation="vertical"
                  size={4}
                  style={{ maxWidth: 360 }}
                >
                  <Typography.Text style={{ color: '#fff' }}>
                    每段第一行填写楼栋地址，后续每行填写房号、房型和租金。
                  </Typography.Text>
                  <Typography.Text
                    style={{ color: 'rgba(255, 255, 255, 0.72)' }}
                  >
                    不同楼栋之间空一行；预览只计算差异，不会立即修改房态。
                  </Typography.Text>
                  <Typography.Text
                    style={{ color: 'rgba(255, 255, 255, 0.72)' }}
                  >
                    房表作为楼栋当前空置清单，未列出的房源会按空间配置更新房态。
                  </Typography.Text>
                </Space>
              }
            >
              <Button type="link" size="small" icon={<InfoCircleOutlined />}>
                格式说明
              </Button>
            </Popover>
          </Space>
        }
      >
        <Input.TextArea
          aria-label="房表内容"
          className={styles.textarea}
          value={rawText}
          readOnly={Boolean(preview?.applied)}
          allowClear={
            preview?.applied ? false : { disabled: previewing || applying }
          }
          placeholder={'例如：\n下元岗东街三巷1号\n102 单间 1380'}
          autoSize={{ minRows: 18, maxRows: 26 }}
          onChange={(event) => onChange(event.target.value)}
          onClear={onClear}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.sourceMeta}>
          <span>
            {preview
              ? `${preview.summary.valid_lines} / 1000 条有效房源`
              : '最多 1000 条有效房源'}
          </span>
          <span>{(new Blob([rawText]).size / 1024).toFixed(2)} KB / 50 KB</span>
        </div>

        {previewStale ? (
          <div className={styles.sourceHint}>
            <Typography.Text strong>编辑规则：</Typography.Text>
            当前结果基于修改前的房表，仅供参考；重新预览前不能执行同步。
          </div>
        ) : null}

        {issueLines?.length ? (
          <div className={styles.issueList}>
            {Array.from(new Set(issueLines)).map((line) => (
              <Tag key={line} color="error">
                第 {line} 行有问题
              </Tag>
            ))}
          </div>
        ) : null}

        {!preview?.applied ? (
          <div className={styles.sourceActions}>
            <Button
              block
              icon={<EyeOutlined />}
              loading={previewing}
              disabled={applying}
              onClick={onPreview}
            >
              预览同步计划
            </Button>
            <Button
              block
              type="primary"
              icon={<SyncOutlined />}
              disabled={!canConfirm}
              loading={applying}
              onClick={onConfirm}
            >
              执行同步
            </Button>
          </div>
        ) : (
          <div className={styles.sourceCompleted}>
            <div className={styles.sourceCompletedSummary}>
              <Typography.Text strong>同步已完成</Typography.Text>
              <Typography.Text type="secondary">
                {preview.summary.buildings} 栋楼 · {preview.summary.valid_lines}{' '}
                套房源
              </Typography.Text>
            </div>
            <div className={styles.sourceCompletedActions}>
              <Button onClick={onViewHouses}>查看房源</Button>
              <Button type="primary" onClick={onReset}>
                同步下一份
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function VacancySyncSummary({
  preview,
}: {
  preview: VacancySyncResult;
}) {
  const { styles, cx } = useStyles();
  const metrics = [
    { key: 'buildings', label: '涉及楼栋', value: preview.summary.buildings },
    { key: 'lines', label: '有效房源', value: preview.summary.valid_lines },
    {
      key: 'create',
      label: '新建房源',
      value: preview.summary.create_houses,
      tone: 'warning',
    },
    { key: 'update', label: '更新资料', value: preview.summary.update_houses },
    {
      key: 'vacant',
      label: '改为空置',
      value: preview.summary.mark_vacant,
      tone: 'success',
    },
    { key: 'rented', label: '改为已租', value: preview.summary.mark_rented },
  ];
  const hasSecondarySummary = Boolean(
    preview.summary.ignored_lines ||
      preview.summary.preserve_special_status ||
      preview.force_rented,
  );

  return (
    <>
      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <div className={styles.metricCard} key={metric.key}>
            <span
              className={cx(
                styles.metricValue,
                metric.tone === 'success' && styles.metricValueSuccess,
                metric.tone === 'warning' && styles.metricValueWarning,
              )}
            >
              {metric.value}
            </span>
            <span className={styles.metricLabel}>{metric.label}</span>
          </div>
        ))}
      </div>
      {hasSecondarySummary ? (
        <Space className={styles.secondaryTags} size={[4, 4]} wrap>
          {preview.summary.ignored_lines ? (
            <Tag>已忽略 {preview.summary.ignored_lines} 行</Tag>
          ) : null}
          {preview.summary.preserve_special_status ? (
            <Tag color="orange">
              保留特殊房态 {preview.summary.preserve_special_status}
            </Tag>
          ) : null}
          {preview.force_rented ? (
            <Tag color="orange" icon={<WarningOutlined />}>
              特殊房态按空间设置覆盖
            </Tag>
          ) : null}
        </Space>
      ) : null}
    </>
  );
}

function changeRoomTags(
  items: API.VacancySyncHouseChangeOut[],
  color?: string,
) {
  return (
    <Space size={[4, 4]} wrap>
      {items.map((item) => (
        <Tag
          key={`${item.house_id || 'new'}-${item.room_number}`}
          color={color}
        >
          {item.room_number}
          {item.changed_fields.length
            ? ` · ${item.changed_fields.map((field) => CHANGE_FIELD_LABELS[field] || field).join('、')}`
            : ''}
        </Tag>
      ))}
    </Space>
  );
}

type BuildingCardProps = {
  block: VacancySyncBlock;
  buildingOverride?: number;
  disabled: boolean;
  pending: boolean;
  onBuildingOverride: (blockIndex: number, buildingId?: number) => void;
  onIgnoredLineChange: (lineNumber: number, ignored: boolean) => void;
};

export function VacancySyncBuildingCard({
  block,
  buildingOverride,
  disabled,
  pending,
  onBuildingOverride,
  onIgnoredLineChange,
}: BuildingCardProps) {
  const { styles } = useStyles();
  const meta = BUILDING_MATCH_META[block.building_match.status];
  const validLineCount = block.lines.filter(
    (line) => line.status === 'valid',
  ).length;
  const changeCount =
    block.changes.create_houses.length +
    block.changes.update_houses.length +
    block.changes.mark_vacant.length +
    block.changes.mark_rented.length;
  const changeItems = [
    {
      key: 'create',
      label: '新建房源',
      items: block.changes.create_houses,
      color: 'orange',
    },
    {
      key: 'update',
      label: '更新资料',
      items: block.changes.update_houses,
      color: 'blue',
    },
    {
      key: 'vacant',
      label: '改为空置',
      items: block.changes.mark_vacant,
      color: 'green',
    },
    {
      key: 'rented',
      label: '改为已租',
      items: block.changes.mark_rented,
      color: 'blue',
    },
    {
      key: 'special',
      label: '保留特殊房态',
      items: block.changes.preserve_special_status,
      color: 'orange',
    },
    {
      key: 'inactive',
      label: '停用房源冲突',
      items: block.changes.inactive_conflicts,
      color: 'red',
    },
  ].filter((item) => item.items.length);
  const buildingName = block.building_match.name || block.address;
  const buildingAddress = block.building_match.address;

  const columns: TableColumnsType<VacancySyncLine> = [
    { title: '行', dataIndex: 'line_number', width: 42, align: 'right' },
    {
      title: '原始内容',
      dataIndex: 'raw',
      width: 132,
      render: (value: string) => (
        <span className={styles.rawCode} title={value}>
          {value}
        </span>
      ),
    },
    {
      title: '房号',
      dataIndex: 'room_number',
      width: 58,
      render: (value) => value || '—',
    },
    {
      title: '识别结果',
      key: 'parsed',
      width: 150,
      render: (_value, record) => {
        if (
          record.status !== 'valid' ||
          record.bedrooms === null ||
          record.living_rooms === null
        )
          return '—';

        const layout = housePrimaryLayoutText(record, {
          bedroomLabel: '房',
          livingRoomLabel: '厅',
          separator: '',
        });
        return (
          <div className={styles.parsedLine}>
            <div className={styles.parsedMain}>
              <Typography.Text>{layout}</Typography.Text>
              <Typography.Text type="secondary">
                {record.asking_rent ? `¥${record.asking_rent}` : '未填租金'}
              </Typography.Text>
            </div>
            {record.tags.length ? (
              <Space size={[2, 2]} wrap>
                {record.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '识别状态',
      dataIndex: 'status',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_value, record) => {
        if (record.status === 'valid') {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              正确
            </Tag>
          );
        }
        if (record.status === 'ignored') {
          return (
            <Space size={4} wrap>
              <Tag>已忽略</Tag>
              <Button
                type="link"
                size="small"
                disabled={disabled || pending}
                onClick={() => onIgnoredLineChange(record.line_number, false)}
              >
                恢复处理
              </Button>
            </Space>
          );
        }
        return (
          <Space size={4} wrap>
            <Tag color="error" icon={<WarningOutlined />}>
              {record.message || '识别错误'}
            </Tag>
            <Button
              type="link"
              size="small"
              disabled={disabled || pending}
              onClick={() => onIgnoredLineChange(record.line_number, true)}
            >
              忽略此行
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      className={styles.buildingCard}
      size="small"
      title={
        <div className={styles.buildingTitle}>
          <Typography.Text className={styles.buildingName} strong>
            {buildingName}
          </Typography.Text>
          {buildingAddress && buildingAddress !== buildingName ? (
            <Typography.Text type="secondary">
              {buildingAddress}
            </Typography.Text>
          ) : null}
          <Tag color={meta.color}>{meta.label}</Tag>
          {block.errors.length ? (
            <Tag color="error">{block.errors.length} 个问题</Tag>
          ) : null}
        </div>
      }
      extra={
        <Typography.Text type="secondary">
          {validLineCount} 套 ·{' '}
          {changeCount ? `${changeCount} 项变更` : '无需变更'}
        </Typography.Text>
      }
    >
      {block.building_match.status === 'ambiguous' ? (
        <Alert
          type="warning"
          showIcon
          title="找到多个可能的楼栋，请选择本段数据对应的楼栋"
          description={
            <Select
              aria-label={`${block.address} 对应楼栋`}
              allowClear
              disabled={disabled || pending}
              placeholder="选择后自动重新预览"
              value={buildingOverride}
              options={block.building_match.candidates.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.name} · ${candidate.address}`,
              }))}
              onChange={(value) => onBuildingOverride(block.block_index, value)}
              style={{ width: '100%', marginTop: 8 }}
            />
          }
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {changeItems.length ? (
        <div className={styles.changeGrid}>
          {changeItems.map((item) => (
            <Fragment key={item.key}>
              <span className={styles.changeLabel}>{item.label}</span>
              <span>{changeRoomTags(item.items, item.color)}</span>
            </Fragment>
          ))}
        </div>
      ) : null}

      <div className={styles.detailHeading}>
        <Space size={6}>
          <Typography.Text strong>识别明细</Typography.Text>
          <Typography.Text type="secondary">
            共 {block.lines.length} 行
          </Typography.Text>
        </Space>
      </div>
      <Table<VacancySyncLine>
        rowKey="line_number"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={block.lines}
        scroll={{ x: 502 }}
      />
    </Card>
  );
}

export function VacancySyncEmptyState({
  onLoadSample,
  hasContent,
}: {
  onLoadSample: () => void;
  hasContent: boolean;
}) {
  const { styles } = useStyles();
  return (
    <Card className={styles.emptyCard}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span>
            在左侧粘贴房表并生成预览后，这里会按楼栋展示资料更新、房态变化和逐行识别结果。
          </span>
        }
      >
        {!hasContent ? (
          <Button icon={<FileTextOutlined />} onClick={onLoadSample}>
            载入示例开始体验
          </Button>
        ) : null}
      </Empty>
    </Card>
  );
}

export { useStyles as useVacancySyncStyles };
