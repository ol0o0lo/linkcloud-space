import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  announcementsCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      padding: 20px 24px 8px;
    }

    @media (max-width: 575px) {
      .ant-card-body {
        padding: 16px 16px 4px;
      }
    }
  `,
  toolbar: css`
    min-height: 40px;
    padding-bottom: 16px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  toolbarActions: css`
    min-width: 0;

    .ant-input-search {
      width: 260px;
    }

    @media (max-width: 575px) {
      width: 100%;

      .ant-input-search {
        width: auto;
        min-width: 0;
        flex: 1 1 auto;
      }
    }
  `,
  table: css`
    .ant-table {
      background: transparent;
    }

    .ant-table-thead > tr > th {
      background: ${token.colorFillAlter};
      color: ${token.colorTextHeading};
      font-weight: 600;
    }

    .ant-table-tbody > tr > td {
      padding-block: 14px;
    }

    .ant-table-tbody > tr:hover > td {
      background: ${token.colorFillQuaternary};
    }
  `,
  emptyState: css`
    min-height: 280px;
    padding-block: 56px;
  `,
  primaryAction: css`
    box-shadow: 0 6px 14px ${token.colorPrimaryBgHover};
  `,
}));
