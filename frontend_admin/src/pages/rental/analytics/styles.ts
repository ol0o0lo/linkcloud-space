import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  page: css`
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 16px;

    .ant-btn {
      transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .ant-btn:active {
      transform: scale(0.97);
    }

    @media (prefers-reduced-motion: reduce) {
      .ant-btn {
        transition: none;
      }
    }
  `,
  filterCard: css`
    position: relative;
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    background: linear-gradient(
      135deg,
      ${token.colorPrimaryBg} 0%,
      ${token.colorBgContainer} 46%,
      ${token.colorFillQuaternary} 100%
    );
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-body {
      position: relative;
      padding: 16px 18px;
    }

    &::before,
    &::after {
      position: absolute;
      content: '';
      border-radius: 50%;
      pointer-events: none;
    }

    &::before {
      top: -48px;
      right: 76px;
      width: 112px;
      height: 112px;
      border: 1px solid ${token.colorPrimaryBorder};
      opacity: 0.42;
    }

    &::after {
      right: -28px;
      bottom: -58px;
      width: 148px;
      height: 148px;
      background: ${token.colorPrimaryBg};
      opacity: 0.72;
    }
  `,
  filterDecoration: css`
    position: absolute;
    z-index: 0;
    top: 50%;
    right: 30px;
    transform: translateY(-50%);
    color: ${token.colorPrimary};
    font-size: 70px;
    opacity: 0.075;
    pointer-events: none;
  `,
  filterContent: css`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;

    @media (max-width: 991px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }
  `,
  filterIdentity: css`
    display: flex;
    min-width: 180px;
    align-items: center;
    gap: 12px;
  `,
  filterIcon: css`
    display: flex;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadiusLG}px;
    color: ${token.colorPrimary};
    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
    font-size: 18px;
  `,
  filterTitle: css`
    display: block;
    color: ${token.colorTextHeading};
    font-weight: ${token.fontWeightStrong};
  `,
  filterHint: css`
    display: block;
    margin-top: 2px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  filterControls: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;

    @media (max-width: 991px) {
      width: 100%;
      justify-content: flex-end;
    }

    @media (max-width: 575px) {
      .ant-picker {
        width: 100%;
      }
    }
  `,
  filterActions: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px 16px;

    @media (max-width: 991px) {
      width: 100%;
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  sourceSelect: css`
    width: 160px;

    @media (max-width: 575px) {
      width: 100%;
    }
  `,
  sourceError: css`
    font-size: ${token.fontSizeSM}px;
  `,
  refreshControls: css`
    display: flex;
    align-items: center;
    gap: 8px;

    @media (max-width: 575px) {
      width: 100%;
      justify-content: space-between;
    }
  `,
  updatedAt: css`
    white-space: nowrap;
    font-size: ${token.fontSizeSM}px;
  `,
  historicalHint: css`
    padding: 3px 9px;
    border-radius: ${token.borderRadiusSM}px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  metricCard: css`
    position: relative;
    height: 100%;
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    &::before {
      position: absolute;
      z-index: 2;
      top: 0;
      right: 0;
      left: 0;
      height: 2px;
      content: '';
      background: linear-gradient(
        90deg,
        ${token.colorPrimary},
        ${token.colorPrimaryBorder},
        transparent
      );
      opacity: 0.72;
    }

    &::after {
      position: absolute;
      top: -30px;
      right: -28px;
      width: 92px;
      height: 92px;
      content: '';
      border-radius: 50%;
      background: ${token.colorPrimaryBg};
      opacity: 0.68;
      pointer-events: none;
    }

    .ant-card-body {
      position: relative;
      z-index: 1;
      display: flex;
      min-height: 136px;
      flex-direction: column;
      padding: 18px 20px;
    }

    .ant-statistic-title {
      margin-bottom: 10px;
    }

    .ant-statistic-content {
      color: ${token.colorTextHeading};
      font-size: 26px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
  metricTitle: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  metricIcon: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: 15px;
  `,
  metricMeta: css`
    display: flex;
    min-height: 30px;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 8px;
  `,
  metricHint: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  metricSparkline: css`
    width: 92px;
    height: 30px;
    flex: 0 0 92px;
    color: ${token.colorPrimary};
    overflow: visible;
  `,
  visitorSuffix: css`
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSize}px;
    font-weight: 400;
  `,
  summaryError: css`
    display: flex;
    min-height: 112px;
    align-items: center;

    .ant-alert {
      width: 100%;
    }
  `,
  sectionCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-head {
      min-height: 56px;
      padding-inline: 20px;
      border-bottom-color: ${token.colorBorderSecondary};
    }

    .ant-card-body {
      padding: 20px;
    }
  `,
  sectionTitle: css`
    display: flex;
    align-items: center;
    gap: 9px;
  `,
  sectionTitleIcon: css`
    display: inline-flex;
    width: 30px;
    height: 30px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    font-size: 16px;
  `,
  sectionExtra: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  chartStage: css`
    position: relative;
    display: flex;
    overflow: hidden;
    flex-direction: column;
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(
      180deg,
      ${token.colorFillQuaternary} 0%,
      ${token.colorBgContainer} 48%,
      ${token.colorBgContainer} 100%
    );

    &::after {
      position: absolute;
      top: -72px;
      right: -54px;
      width: 180px;
      height: 180px;
      content: '';
      border: 1px solid ${token.colorPrimaryBorder};
      border-radius: 50%;
      opacity: 0.18;
      pointer-events: none;
    }
  `,
  chartToolbar: css`
    position: relative;
    z-index: 1;
    display: flex;
    min-height: 50px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px 4px;

    @media (max-width: 575px) {
      align-items: flex-start;
      flex-direction: column-reverse;
      padding-bottom: 8px;
    }
  `,
  trendSegmented: css`
    max-width: 100%;
    padding: 2px;
    background: ${token.colorFillSecondary};

    .ant-segmented-item-selected {
      color: ${token.colorPrimary};
      box-shadow: ${token.boxShadowTertiary};
    }

    @media (max-width: 575px) {
      width: 100%;

      .ant-segmented-group {
        overflow-x: auto;
      }
    }
  `,
  chartSummary: css`
    display: flex;
    flex: 0 0 auto;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  `,
  chartCanvas: css`
    position: relative;
    z-index: 1;
    min-height: 0;
    flex: 1;
  `,
  emptyStage: css`
    position: relative;
    z-index: 1;
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(
      145deg,
      ${token.colorBgContainer},
      ${token.colorPrimaryBg}
    );
  `,
  emptyCopy: css`
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: ${token.fontSize}px;

    .ant-typography {
      font-size: ${token.fontSizeSM}px;
    }
  `,
  funnelStage: css`
    display: flex;
    align-items: center;
  `,
  moduleError: css`
    position: relative;
    z-index: 1;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    padding: 16px;

    .ant-alert {
      width: 100%;
    }
  `,
  funnelList: css`
    display: flex;
    width: 100%;
    flex-direction: column;
  `,
  funnelStep: css`
    position: relative;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    min-height: 70px;
    align-items: start;
    gap: 10px;

    &:not(:last-child)::before {
      position: absolute;
      top: 31px;
      bottom: -1px;
      left: 14px;
      width: 1px;
      content: '';
      background: linear-gradient(
        180deg,
        ${token.colorPrimaryBorder},
        ${token.colorBorderSecondary}
      );
    }
  `,
  funnelIndex: css`
    position: relative;
    z-index: 1;
    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: 50%;
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
    box-shadow: 0 0 0 4px ${token.colorBgContainer};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    font-weight: ${token.fontWeightStrong};
  `,
  funnelContent: css`
    width: 100%;
    padding: 9px 12px 8px;
    border: 1px solid transparent;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    .ant-progress-bg {
      transition: width 220ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    @media (prefers-reduced-motion: reduce) {
      .ant-progress-bg {
        transition: none;
      }
    }
  `,
  funnelHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 5px;
  `,
  funnelRatio: css`
    margin-inline-end: 0;
    border-color: transparent;
    border-radius: ${token.borderRadiusSM}px;
    font-variant-numeric: tabular-nums;
  `,
  rankingCard: css`
    border-color: ${token.colorBorderSecondary};
    box-shadow: ${token.boxShadowTertiary};

    .ant-card-head {
      min-height: 56px;
      padding-inline: 20px;
    }

    .ant-card-body {
      padding: 0 20px 20px;
    }

    .ant-table-thead > tr > th {
      color: ${token.colorTextSecondary};
      background: ${token.colorFillQuaternary};
      font-weight: ${token.fontWeightStrong};
    }

    .ant-table-tbody > tr > td {
      transition: background-color 140ms ease;
    }

    @media (max-width: 575px) {
      .ant-card-head {
        align-items: flex-start;
      }

      .ant-card-head-wrapper {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
        padding-block: 12px;
      }

      .ant-table-pagination {
        width: 100%;
        justify-content: center;
      }
    }
  `,
  rankingError: css`
    display: flex;
    min-height: 220px;
    align-items: center;

    .ant-alert {
      width: 100%;
    }
  `,
  totalMetric: css`
    display: inline-flex;
    width: 112px;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  `,
  totalBarTrack: css`
    display: block;
    width: 64px;
    height: 5px;
    overflow: hidden;
    border-radius: ${token.borderRadiusXS}px;
    background: ${token.colorFillSecondary};
  `,
  totalBarValue: css`
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      ${token.colorPrimaryBorder},
      ${token.colorPrimary}
    );
  `,
  rankBadge: css`
    display: inline-flex;
    width: 26px;
    height: 26px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorTextSecondary};
    background: ${token.colorFillSecondary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    font-weight: ${token.fontWeightStrong};
  `,
  rankBadgeTop: css`
    color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};
  `,
  rankBadgeFirst: css`
    color: ${token.colorWarningText};
    background: ${token.colorWarningBg};
  `,
}));
