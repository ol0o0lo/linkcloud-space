import { Card } from 'antd';
import type React from 'react';
import { useStyles } from '../styles';

export type OrganizationWorkspaceCardContext = {
  canManageInvites: boolean;
  title: React.ReactNode;
};

export const OrganizationWorkspaceCard: React.FC<
  React.PropsWithChildren<
    OrganizationWorkspaceCardContext & {
      actions?: React.ReactNode;
    }
  >
> = ({ actions, children, title }) => {
  const { styles } = useStyles();

  return (
    <Card
      className={styles.organizationWorkspaceCard}
      title={title}
      extra={
        actions ? (
          <div className={styles.workspaceActions}>{actions}</div>
        ) : undefined
      }
    >
      {children}
    </Card>
  );
};
