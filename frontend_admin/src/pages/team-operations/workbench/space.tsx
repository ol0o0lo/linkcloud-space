import { Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { RentalOperationsWorkbenchContent } from '@/pages/rental/workbench';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { useStyles } from './styles';

const SpaceWorkbenchPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const organizationName =
    workspace.selectedOrganization?.name || workspace.selectedOrgSlug;

  return (
    <TenantSelectionGuard title="空间工作台">
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <Typography.Title level={3} className={styles.pageTitle}>
              空间工作台
            </Typography.Title>
            <div className={styles.pageMeta}>
              <Typography.Text strong>{organizationName}</Typography.Text>
              <span className={styles.metaDivider} aria-hidden="true" />
              <Typography.Text type="secondary">
                {dayjs().format('YYYY年M月D日')}
              </Typography.Text>
              <span className={styles.metaDivider} aria-hidden="true" />
              <Typography.Text type="secondary">空间运营视角</Typography.Text>
            </div>
            <Typography.Paragraph className={styles.pageDescription}>
              聚合房源发布与成交转签进度，快速识别影响空间经营的待处理事项。
            </Typography.Paragraph>
          </div>
        </div>

        <RentalOperationsWorkbenchContent />
      </div>
    </TenantSelectionGuard>
  );
};

export default SpaceWorkbenchPage;
