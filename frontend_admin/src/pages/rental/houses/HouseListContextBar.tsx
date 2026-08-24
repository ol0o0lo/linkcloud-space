import { EditOutlined } from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import type React from 'react';
import { AppIcon } from '@/components/AppIcon';

type HouseListContextBarProps = {
  editingCount: number;
  keyword?: string;
  scopeLabel: string;
  statusLabel?: React.ReactNode;
  total?: number;
  onClearFilters: () => void;
};

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.margin}px;
    min-height: 64px;
    padding: ${token.paddingSM}px ${token.padding}px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};

    @media (max-width: ${token.screenLG}px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  scopeSummary: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;
    min-width: 0;
  `,
  scopeIcon: css`
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeLG}px;
  `,
  eyebrow: css`
    display: block;
    margin-bottom: 2px;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.2;
  `,
  scopeLine: css`
    display: flex;
    align-items: baseline;
    gap: ${token.marginSM}px;
    min-width: 0;

    > span:first-child {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  feedback: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${token.marginXXS}px;
    min-width: 0;
    flex-wrap: wrap;

    .ant-tag {
      margin-inline-end: 0;
    }

    @media (max-width: ${token.screenLG}px) {
      justify-content: flex-start;
      width: 100%;
    }
  `,
  editTag: css`
    max-width: 100%;
    white-space: normal;
  `,
}));

export function HouseListContextBar({
  editingCount,
  keyword,
  scopeLabel,
  statusLabel,
  total,
  onClearFilters,
}: HouseListContextBarProps) {
  const { styles } = useStyles();
  const hasFilters = Boolean(keyword || statusLabel);

  return (
    <section className={styles.root} aria-label="房源列表上下文">
      <div className={styles.scopeSummary}>
        <span className={styles.scopeIcon} aria-hidden="true">
          <AppIcon name="house" />
        </span>
        <div>
          <Typography.Text type="secondary" className={styles.eyebrow}>
            当前范围
          </Typography.Text>
          <div className={styles.scopeLine}>
            <Typography.Text strong title={scopeLabel}>
              {scopeLabel}
            </Typography.Text>
            <Typography.Text type="secondary">
              {total === undefined ? '统计中…' : `共 ${total} 套`}
            </Typography.Text>
          </div>
        </div>
      </div>
      <div className={styles.feedback}>
        {keyword ? <Tag>关键词：{keyword}</Tag> : null}
        {statusLabel ? <Tag>房态：{statusLabel}</Tag> : null}
        {hasFilters ? (
          <Button type="link" size="small" onClick={onClearFilters}>
            清除筛选
          </Button>
        ) : null}
        {editingCount ? (
          <Tag
            className={styles.editTag}
            color="processing"
            icon={<EditOutlined />}
          >
            正在编辑 {editingCount} 套房源，保存或取消后可切换范围与筛选
          </Tag>
        ) : null}
      </div>
    </section>
  );
}
