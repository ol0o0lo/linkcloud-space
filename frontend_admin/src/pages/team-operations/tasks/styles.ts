import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  pageLayout: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 14px;
  `,
  toolbar: css`
    min-height: 40px;
  `,
  metricGrid: css`
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(4, minmax(0, 1fr));

    @media (max-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 575px) {
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 359px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  metricCard: css`
    position: relative;
    display: flex;
    min-height: 106px;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
    flex-direction: column;
    padding: 11px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    background:
      radial-gradient(circle at 100% 0%, var(--metric-bg), transparent 48%),
      linear-gradient(
        150deg,
        ${token.colorBgContainer} 0%,
        ${token.colorBgContainer} 66%,
        ${token.colorFillQuaternary} 136%
      );
    color: ${token.colorText};
    cursor: pointer;
    font: inherit;
    text-align: start;
    box-shadow: ${token.boxShadowTertiary};

    &::before {
      position: absolute;
      z-index: 1;
      top: 0;
      right: 12px;
      left: 12px;
      height: 2px;
      border-radius: 0 0 5px 5px;
      background: linear-gradient(
        90deg,
        var(--metric-accent),
        var(--metric-border)
      );
      content: '';
    }

    &::after {
      position: absolute;
      top: -48px;
      right: -48px;
      width: 102px;
      height: 72px;
      border: 1px solid var(--metric-border);
      border-radius: 50%;
      box-shadow: 0 0 0 11px var(--metric-bg);
      content: '';
      opacity: 0.52;
      pointer-events: none;
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: 2px;
    }

    .ant-statistic {
      z-index: 1;
      margin-top: 0;
      padding-right: 34px;
    }

    .ant-statistic-title {
      margin-bottom: 0;
      color: ${token.colorTextSecondary};
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ant-statistic-content {
      color: ${token.colorTextHeading};
      font-size: 26px;
      font-variant-numeric: tabular-nums;
      font-weight: 750;
      letter-spacing: -0.04em;
      line-height: 1.08;
    }

    @media (max-width: 575px) {
      min-height: 102px;
      padding: 10px;
      border-radius: ${token.borderRadiusLG + 2}px;

      &::before {
        right: 10px;
        left: 10px;
      }

      &::after {
        top: -48px;
        right: -52px;
        opacity: 0.38;
      }

      .ant-statistic {
        margin-top: 0;
        padding-right: 31px;
      }

      .ant-statistic-title {
        font-size: 11px;
      }

      .ant-statistic-content {
        font-size: 24px;
      }
    }
  `,
  metricBlue: css`
    --metric-accent: ${token.colorInfo};
    --metric-bg: ${token.colorInfoBg};
    --metric-border: ${token.colorInfoBorder};
  `,
  metricGreen: css`
    --metric-accent: ${token.colorSuccess};
    --metric-bg: ${token.colorSuccessBg};
    --metric-border: ${token.colorSuccessBorder};
  `,
  metricOrange: css`
    --metric-accent: ${token.colorWarning};
    --metric-bg: ${token.colorWarningBg};
    --metric-border: ${token.colorWarningBorder};
  `,
  metricRed: css`
    --metric-accent: ${token.colorError};
    --metric-bg: ${token.colorErrorBg};
    --metric-border: ${token.colorErrorBorder};
  `,
  metricHeader: css`
    position: absolute;
    z-index: 1;
    top: 10px;
    right: 11px;
    display: flex;
    min-width: 0;
    align-items: center;

    &::after {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 7px;
      height: 7px;
      border: 1px solid var(--metric-accent);
      border-radius: 2px;
      background: ${token.colorBgContainer};
      content: '';
      opacity: 0.72;
    }

    @media (max-width: 575px) {
      top: 9px;
      right: 9px;
    }
  `,
  metricIcon: css`
    display: inline-flex;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--metric-border);
    border-radius: ${token.borderRadiusLG}px;
    background: var(--metric-bg);
    color: var(--metric-accent);
    font-size: 13px;
    box-shadow:
      0 5px 12px var(--metric-bg),
      inset 0 0 0 4px ${token.colorBgContainer};

    @media (max-width: 575px) {
      width: 24px;
      height: 24px;
      flex-basis: 24px;
      font-size: 12px;
    }
  `,
  metricUnit: css`
    color: ${token.colorTextTertiary};
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
  `,
  metricDescription: css`
    z-index: 1;
    display: block;
    max-width: calc(100% - 48px);
    min-width: 0;
    overflow: hidden;
    margin-top: 2px;
    color: ${token.colorTextTertiary};
    font-size: 10px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;

    @media (max-width: 575px) {
      max-width: calc(100% - 42px);
      font-size: 9px;
    }
  `,
  metricOrnament: css`
    position: absolute;
    z-index: 1;
    right: 12px;
    bottom: 12px;
    width: 42px;
    height: 3px;
    border-radius: 99px;
    background: linear-gradient(
      90deg,
      var(--metric-accent) 0 13px,
      transparent 13px 17px,
      var(--metric-border) 17px 29px,
      transparent 29px 33px,
      var(--metric-border) 33px 42px
    );
    opacity: 0.62;
    pointer-events: none;

    &::before,
    &::after {
      position: absolute;
      top: -7px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--metric-accent);
      content: '';
    }

    &::before {
      right: 0;
    }

    &::after {
      right: 7px;
      background: var(--metric-border);
    }

    @media (max-width: 575px) {
      right: 10px;
      bottom: 10px;
      width: 36px;
      background: linear-gradient(
        90deg,
        var(--metric-accent) 0 11px,
        transparent 11px 15px,
        var(--metric-border) 15px 25px,
        transparent 25px 29px,
        var(--metric-border) 29px 36px
      );
    }
  `,
  tableCard: css`
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    box-shadow: ${token.boxShadowTertiary};
    container-type: inline-size;

    .ant-card-body {
      padding: 20px 24px 8px;
    }

    @media (max-width: 575px) {
      .ant-card-body {
        padding: 16px 16px 4px;
      }
    }
  `,
  filters: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: nowrap;
    padding-bottom: 20px;
    border-bottom: 1px solid ${token.colorBorderSecondary};

    @container (max-width: 760px) {
      align-items: stretch;
      flex-wrap: wrap;
    }
  `,
  filterOptions: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
    flex: 0 0 auto;

    @container (max-width: 760px) {
      width: 100%;
      flex-wrap: wrap;
    }
  `,
  filterActions: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-inline-start: auto;

    > .ant-btn {
      flex: 0 0 auto;
    }

    @container (max-width: 760px) {
      width: 100%;
    }
  `,
  filterField: css`
    display: flex;
    min-width: 0;
    flex: 0 0 auto;
    align-items: center;

    @container (max-width: 760px) {
      flex: 1 1 calc(50% - 5px);

      .ant-select {
        flex: 1 1 auto;
      }
    }

    @container (max-width: 520px) {
      flex-basis: 100%;
    }
  `,
  filterSelect: css`
    width: 112px;
  `,
  keywordSearch: css`
    min-width: 220px;
    width: 260px;
    flex: 0 1 260px;

    @container (max-width: 760px) {
      width: auto;
      min-width: 0;
      flex: 1 1 auto;
    }

    @container (max-width: 520px) {
      min-width: 0;
    }
  `,
  table: css`
    margin-top: 20px;

    .ant-table {
      background: transparent;
    }

    .ant-table-container {
      overflow: hidden;
      padding: 0 8px 8px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadiusLG + 2}px;
      background: ${token.colorFillQuaternary};
    }

    .ant-table-content > table,
    .ant-table-body > table {
      border-collapse: separate;
      border-spacing: 0 10px;
    }

    .ant-table-thead > tr > th {
      padding: 14px 10px 8px;
      border-bottom: 0;
      background: transparent;
      color: ${token.colorTextHeading};
      font-weight: 600;

      &::before {
        display: none;
      }
    }

    .ant-table-tbody > tr > td {
      padding: 16px 10px;
      border-block: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorBgContainer};
      transition:
        background 160ms ease,
        border-color 160ms ease;
    }

    .ant-table-tbody > tr > td:first-child {
      border-inline-start: 1px solid ${token.colorBorderSecondary};
      border-start-start-radius: ${token.borderRadiusLG}px;
      border-end-start-radius: ${token.borderRadiusLG}px;
    }

    .ant-table-tbody > tr > td:last-child {
      border-inline-end: 1px solid ${token.colorBorderSecondary};
      border-start-end-radius: ${token.borderRadiusLG}px;
      border-end-end-radius: ${token.borderRadiusLG}px;
    }

    .ant-table-tbody > tr:hover > td {
      background: ${token.colorFillQuaternary};
      border-color: ${token.colorPrimaryBorder};
    }

    .ant-pagination {
      margin-block: 16px 8px;
    }
  `,
  listAlert: css`
    margin-top: 20px;
  `,
  emptyState: css`
    min-height: 260px;
    padding-block: 48px;
  `,
  taskTitleCell: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  `,
  taskTitleText: css`
    overflow: hidden;
    color: ${token.colorTextHeading};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  taskDescription: css`
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  assigneeCell: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 6px;

    .ant-avatar {
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
      font-weight: 600;
    }

  `,
  deadlineCell: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;

    .ant-typography:last-child:not(:first-child) {
      font-size: ${token.fontSizeSM}px;
    }

    .ant-typography:first-child {
      font-size: ${token.fontSizeSM}px;
      white-space: nowrap;
    }
  `,
  listTag: css`
    min-width: 54px;
    margin-inline-end: 0;
    padding: 3px 7px;
    border-radius: ${token.borderRadiusSM + 2}px;
    text-align: center;
    font-weight: 600;
  `,
  primaryAction: css`
    box-shadow: 0 6px 14px ${token.colorPrimaryBgHover};
  `,
  createTaskModal: css`
    .ant-modal-container {
      overflow: hidden;
      padding: 0;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadiusLG + 4}px;
      background: ${token.colorBgContainer};
      box-shadow: ${token.boxShadowSecondary};
    }

    .ant-modal-header {
      margin: 0;
      padding: 18px 24px 16px;
      border-bottom: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorBgContainer};
    }

    .ant-modal-close {
      top: 16px;
      inset-inline-end: 20px;
      width: 32px;
      height: 32px;
      border-radius: ${token.borderRadiusSM}px;
      color: ${token.colorTextSecondary};

      &:hover {
        color: ${token.colorText};
        background: ${token.colorFillTertiary};
      }
    }

    .ant-modal-body {
      max-height: calc(100vh - 156px);
      overflow-y: auto;
      padding: 20px 24px 22px;
      scrollbar-gutter: stable;
    }

    .ant-modal-footer {
      margin: 0;
      padding: 14px 24px 16px;
      border-top: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorBgContainer};
    }

    @media (max-width: 575px) {
      max-width: calc(100vw - 24px);
      margin-block: 12px;

      .ant-modal-header {
        padding: 16px 18px 14px;
      }

      .ant-modal-body {
        max-height: calc(100vh - 146px);
        padding: 16px 18px 18px;
      }

      .ant-modal-footer {
        padding: 12px 18px 14px;
      }
    }
  `,
  createTaskTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    padding-inline-end: 36px;
  `,
  createTaskTitleCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
  `,
  createTaskTitleText: css`
    font-size: 16px;
    line-height: 1.35;
  `,
  createTaskSubtitle: css`
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
  `,
  createTaskForm: css`
    .ant-form-item {
      margin-bottom: 14px;
    }

    .ant-form-item-label {
      padding-bottom: 4px;
    }

    .ant-form-item-label > label {
      height: auto;
      font-weight: 600;
    }

    .ant-form-item-extra,
    .ant-form-item-explain {
      margin-top: 3px;
      font-size: ${token.fontSizeSM}px;
      line-height: 1.45;
    }
  `,
  taskSection: css`
    min-width: 0;

    & + & {
      margin-top: 6px;
      padding-top: 20px;
      border-top: 1px solid ${token.colorBorderSecondary};
    }

    .ant-form-item:last-child {
      margin-bottom: 0;
    }
  `,
  taskFieldsGrid: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (max-width: 575px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  priorityRadio: css`
    display: flex;
    width: 100%;

    .ant-radio-button-wrapper {
      flex: 1 1 0;
      text-align: center;
    }
  `,
  organizationSwitch: css`
    margin-bottom: 18px !important;
    padding: 14px 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    .ant-form-item-control-input {
      min-height: 24px;
    }
  `,
  createTaskFooter: css`
    display: flex;
    justify-content: flex-end;
  `,
}));
