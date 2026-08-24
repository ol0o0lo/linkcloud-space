import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  content: css`
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 16px;
  `,
  overviewCard: css`
    border-radius: ${token.borderRadius}px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 2%);

    .ant-card-body {
      padding: 16px;
    }
  `,
  sectionHeading: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;

    @media (max-width: 767px) {
      flex-direction: column;
      gap: 4px;
    }
  `,
  sectionTitle: css`
    margin: 0 0 2px !important;
  `,
  overviewGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  `,
  overviewTile: css`
    min-width: 0;
    min-height: 108px;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-top-width: 2px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};

    .ant-statistic-content {
      color: ${token.colorTextHeading};
      font-size: 26px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
  overviewTilePrimary: css`
    border-top-color: ${token.colorPrimary};
  `,
  overviewTileDanger: css`
    border-top-color: ${token.colorError};

    .ant-statistic-content {
      color: ${token.colorError};
    }
  `,
  overviewTileSuccess: css`
    border-top-color: ${token.colorSuccess};
  `,
  overviewTileWarning: css`
    border-top-color: ${token.colorWarning};
  `,
  overviewTileInfo: css`
    border-top-color: ${token.colorInfo};
  `,
  filterAlert: css`
    border-radius: ${token.borderRadius}px;
  `,
  contentCard: css`
    border-radius: ${token.borderRadius}px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 2%);

    .ant-card-head {
      min-height: 50px;
      padding-inline: 16px;
    }

    .ant-card-body {
      padding: 0 16px 16px;
    }

    .ant-table-thead > tr > th {
      color: ${token.colorTextSecondary};
      font-weight: 500;
    }
  `,
}));
