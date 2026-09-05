import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  page: css`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 24px;
  `,
  commandHeader: css`
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    overflow: hidden;
    align-items: center;
    column-gap: 24px;
    row-gap: 10px;
    padding: 16px 20px 15px 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 6}px;
    background: linear-gradient(135deg, #ffffff 0%, #f8faff 68%, #f1f5ff 100%);
    color: ${token.colorText};
    box-shadow: 0 8px 24px rgb(44 72 128 / 6%);

    &::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 6px;
      background: linear-gradient(#4f7cff 0 62%, #66c8bb 62%);
      content: '';
    }

    &::after {
      position: absolute;
      top: -66px;
      right: 248px;
      width: 180px;
      height: 124px;
      border: 1px solid rgb(79 124 255 / 12%);
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      padding: 14px;
    }
  `,
  commandHeaderCopy: css`
    z-index: 1;
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
  `,
  commandEyebrow: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #5577d8;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
  `,
  commandLiveDot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #66c8bb;
    box-shadow: 0 0 0 4px rgb(102 200 187 / 12%);
  `,
  commandTitle: css`
    margin: 4px 0 0 !important;
    color: ${token.colorTextHeading} !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    letter-spacing: -0.03em;
    line-height: 1.3 !important;
  `,
  commandDescription: css`
    max-width: 680px;
    margin: 5px 0 0 !important;
    color: ${token.colorTextSecondary} !important;
    font-size: ${token.fontSizeSM}px;
  `,
  commandMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 9px;

    .ant-typography {
      color: ${token.colorTextSecondary};
      font-size: ${token.fontSizeSM}px;
    }

    .ant-typography strong,
    strong.ant-typography {
      color: ${token.colorText};
    }
  `,
  commandMetaDivider: css`
    width: 1px;
    height: 12px;
    background: ${token.colorBorder};
  `,
  commandDataStatus: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
  commandActions: css`
    z-index: 1;
    display: flex;
    grid-column: 2;
    grid-row: 1;
    flex: 0 0 auto;
    align-items: center;

    @media (max-width: 767px) {
      width: 100%;
      grid-column: 1;
      grid-row: 2;
    }
  `,
  commandActionsGroup: css`
    @media (max-width: 575px) {
      display: grid !important;
      width: 100%;
      grid-template-columns: minmax(0, 1fr) auto;
    }
  `,
  pageHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 4px 0 6px;

    @media (max-width: 767px) {
      align-items: stretch;
      flex-direction: column;
      gap: 12px;
    }
  `,
  pageTitle: css`
    margin: 0 0 8px !important;
    color: ${token.colorTextHeading};
    font-size: 24px !important;
    line-height: 1.35 !important;
  `,
  pageMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,
  metaDataStatus: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `,
  metaDivider: css`
    width: 1px;
    height: 12px;
    background: ${token.colorBorder};
  `,
  pageDescription: css`
    margin: 6px 0 0 !important;
    color: ${token.colorTextSecondary};
  `,
  pageActions: css`
    display: flex;
    min-height: 44px;
    align-items: center;
    padding-top: 4px;

    @media (max-width: 767px) {
      width: 100%;
      padding-top: 0;
    }
  `,
  workbenchSwitcher: css`
    padding: 2px;
    border: 1px solid #dbe3f2;
    border-radius: ${token.borderRadiusLG + 2}px;
    background: #eef2f8;

    .ant-segmented-group {
      gap: 4px;
    }

    .ant-segmented-item {
      min-height: 40px;
      border: 1px solid transparent;
      border-radius: ${token.borderRadiusLG}px;
      color: ${token.colorTextSecondary};
      font-weight: 600;
      transition:
        border-color ${token.motionDurationMid},
        background ${token.motionDurationMid},
        color ${token.motionDurationMid},
        box-shadow ${token.motionDurationMid};
    }

    .ant-segmented-item:not(.ant-segmented-item-selected):hover {
      color: ${token.colorPrimary};
    }

    .ant-segmented-item-selected {
      border-color: #4f7cff;
      background: #4f7cff;
      color: ${token.colorTextLightSolid};
      box-shadow: none;
    }

    .ant-segmented-item-label {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      gap: 8px;
      padding: 4px 10px 4px 6px;
      line-height: 1.4;
    }

    .ant-segmented-item-icon {
      display: inline-flex;
      width: 28px;
      height: 28px;
      flex: 0 0 28px;
      align-items: center;
      justify-content: center;
      border-radius: ${token.borderRadius}px;
      background: ${token.colorBgContainer};
      color: #6f7f96;
      box-shadow: 0 0 0 1px rgb(64 90 138 / 6%);
      transition:
        background ${token.motionDurationMid},
        color ${token.motionDurationMid};
    }

    .ant-segmented-item-icon + * {
      margin-inline-start: 0;
    }

    .ant-segmented-item-selected .ant-segmented-item-icon {
      background: rgb(255 255 255 / 16%);
      color: ${token.colorTextLightSolid};
    }

    .ant-segmented-item:not(.ant-segmented-item-selected):hover
      .ant-segmented-item-icon {
      color: ${token.colorPrimary};
    }

    .ant-segmented-thumb {
      border: 1px solid #4f7cff;
      border-radius: ${token.borderRadiusLG}px;
      background: #4f7cff;
      box-shadow: none;
    }

    @media (max-width: 575px) {
      width: 100%;

      .ant-segmented-group,
      .ant-segmented-item {
        flex: 1;
      }

      .ant-segmented-item-label {
        justify-content: center;
        padding: 6px;
      }
    }
  `,
  customizeButton: css`
    width: 40px !important;
    height: 46px !important;
    min-width: 40px;
    padding: 0 !important;
    border: 1px solid #dbe3f2 !important;
    border-radius: ${token.borderRadiusLG + 2}px !important;
    background: ${token.colorBgContainer} !important;
    color: ${token.colorTextSecondary} !important;
    font-size: 19px !important;
    box-shadow: none !important;

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder} !important;
      background: ${token.colorPrimaryBg} !important;
      color: ${token.colorPrimary} !important;
    }

    &:active {
      background: ${token.colorPrimaryBgHover} !important;
    }
  `,
  singleWorkbenchIndicator: css`
    display: inline-flex;
    min-height: 46px;
    align-items: center;
    gap: 8px;
    padding: 2px 12px 2px 2px;
    border: 1px solid #dbe3f2;
    border-radius: ${token.borderRadiusLG + 2}px;
    background: #eef2f8;
    color: ${token.colorText};
    font-weight: 600;
  `,
  singleWorkbenchIndicatorIcon: css`
    display: inline-flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusLG}px;
    background: #4f7cff;
    color: ${token.colorTextLightSolid};
    font-size: 18px;
  `,
  accessLoading: css`
    display: flex;
    min-height: 280px;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
  `,
  sectionHeading: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-top: 2px;
  `,
  sectionTitle: css`
    margin: 0 !important;
  `,
  metricLink: css`
    display: flex;
    min-height: 148px;
    overflow: hidden;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: inherit;
    flex-direction: column;
    box-shadow: 0 1px 2px rgb(15 23 42 / 2%);
    transition:
      border-color ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid};

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      color: inherit;
      box-shadow: 0 4px 12px rgb(15 23 42 / 6%);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
    }
  `,
  metricDanger: css`
    border-top: 2px solid ${token.colorError};
  `,
  metricWarning: css`
    border-top: 2px solid ${token.colorWarning};
  `,
  metricInfo: css`
    border-top: 2px solid ${token.colorInfo};
  `,
  metricNotice: css`
    border-top: 2px solid ${token.colorPrimary};
  `,
  metricHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  `,
  metricTitle: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSize}px;
    font-weight: 500;
  `,
  metricIcon: css`
    display: inline-flex;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: 15px;
  `,
  metricIconDanger: css`
    background: ${token.colorErrorBg};
    color: ${token.colorError};
  `,
  metricIconWarning: css`
    background: ${token.colorWarningBg};
    color: ${token.colorWarning};
  `,
  metricIconInfo: css`
    background: ${token.colorInfoBg};
    color: ${token.colorInfo};
  `,
  metricArrow: css`
    color: ${token.colorTextTertiary};
    font-size: 11px;
  `,
  metricStatistic: css`
    .ant-statistic-content {
      color: ${token.colorTextHeading};
      font-size: 28px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      line-height: 1.2;
    }
  `,
  metricValueDanger: css`
    .ant-statistic-content {
      color: ${token.colorError};
    }
  `,
  metricValueWarning: css`
    .ant-statistic-content {
      color: ${token.colorWarningText};
    }
  `,
  metricSuffix: css`
    margin-inline-start: 2px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 400;
  `,
  metricFooter: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid ${token.colorBorderSecondary};
  `,
  metricDescription: css`
    min-width: 0;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  contentCard: css`
    border-radius: ${token.borderRadius}px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 2%);

    .ant-card-head {
      min-height: 48px;
      padding-inline: 16px;
    }

    .ant-card-body {
      padding: 16px;
    }
  `,
  mainCard: css`
    height: 100%;

    .ant-card-body {
      padding: 0;
    }
  `,
  timelineList: css`
    padding: 10px 16px 14px;
  `,
  timelineItem: css`
    display: grid;
    grid-template-columns: 84px 20px minmax(0, 1fr);
    gap: 10px;
    padding: 4px 0 14px;

    &:last-child {
      padding-bottom: 2px;
    }

    &:last-child [data-timeline-rail]::after {
      display: none;
    }

    @media (max-width: 575px) {
      grid-template-columns: 16px minmax(0, 1fr);
      gap: 10px;
    }
  `,
  timelineDue: css`
    display: flex;
    min-width: 0;
    align-items: flex-end;
    flex-direction: column;
    gap: 5px;
    padding-top: 12px;
    text-align: right;

    @media (max-width: 575px) {
      display: none;
    }
  `,
  timelineDueMobile: css`
    display: none;

    @media (max-width: 575px) {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 9px;
    }
  `,
  timelineDueLabel: css`
    display: inline-flex;
    min-height: 22px;
    align-items: center;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
    line-height: 22px;
    white-space: nowrap;
  `,
  timelineDueDetail: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  `,
  timelineRail: css`
    position: relative;
    display: flex;
    justify-content: center;

    &::after {
      position: absolute;
      top: 28px;
      bottom: -18px;
      left: 50%;
      width: 1px;
      background: ${token.colorBorderSecondary};
      content: '';
      transform: translateX(-50%);
    }

    @media (max-width: 575px) {
      grid-column: 1;
    }
  `,
  timelineDot: css`
    z-index: 1;
    width: 10px;
    height: 10px;
    margin-top: 18px;
    border: 2px solid ${token.colorBgContainer};
    border-radius: 50%;

    @media (max-width: 575px) {
      margin-top: 20px;
    }
  `,
  timelineToneDanger: css`
    color: ${token.colorError};

    &[data-due-label] {
      background: ${token.colorErrorBg};
    }

    &[data-timeline-dot] {
      background: ${token.colorError};
      box-shadow: 0 0 0 3px ${token.colorErrorBg};
    }
  `,
  timelineToneWarning: css`
    color: ${token.colorWarningText};

    &[data-due-label] {
      background: ${token.colorWarningBg};
    }

    &[data-timeline-dot] {
      background: ${token.colorWarning};
      box-shadow: 0 0 0 3px ${token.colorWarningBg};
    }
  `,
  timelineToneDefault: css`
    color: ${token.colorPrimary};

    &[data-due-label] {
      background: ${token.colorPrimaryBg};
    }

    &[data-timeline-dot] {
      background: ${token.colorPrimary};
      box-shadow: 0 0 0 3px ${token.colorPrimaryBg};
    }
  `,
  timelineToneMuted: css`
    color: ${token.colorTextTertiary};

    &[data-due-label] {
      background: ${token.colorFillSecondary};
    }

    &[data-timeline-dot] {
      background: ${token.colorTextQuaternary};
      box-shadow: 0 0 0 3px ${token.colorFillSecondary};
    }
  `,
  timelineTask: css`
    min-width: 0;
    padding: 13px 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    transition:
      border-color ${token.motionDurationMid},
      background ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid};

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorBgContainer};
      box-shadow: 0 5px 16px rgb(15 23 42 / 5%);
    }

    @media (max-width: 575px) {
      grid-column: 2;
    }
  `,
  timelineTaskHeader: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    @media (max-width: 767px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }
  `,
  timelineTaskCopy: css`
    min-width: 0;
    flex: 1;
  `,
  timelineTaskTitle: css`
    color: ${token.colorTextHeading};
    font-size: ${token.fontSizeLG}px;
    font-weight: 600;
    line-height: 1.45;

    &:hover,
    &:focus-visible {
      color: ${token.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
      border-radius: 2px;
    }
  `,
  timelineTaskMeta: css`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 9px;

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  timelineTeamName: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  timelineActions: css`
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;

    @media (max-width: 767px) {
      width: 100%;
      justify-content: flex-end;
    }
  `,
  timelineLoading: css`
    display: flex;
    min-height: 190px;
    align-items: center;
    justify-content: center;
    gap: 10px;
  `,
  timelineUnavailable: css`
    display: flex;
    min-height: 150px;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: ${token.colorTextSecondary};
    text-align: center;
  `,
  cardTitle: css`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,
  cardTitleText: css`
    color: ${token.colorTextHeading};
    font-size: ${token.fontSize}px;
    font-weight: 600;
  `,
  cardSubtitle: css`
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 400;
  `,
  emptyState: css`
    display: flex;
    min-height: 190px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 32px 20px;
    text-align: center;
  `,
  emptyIcon: css`
    display: inline-flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border-radius: 50%;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    font-size: 22px;
  `,
  emptyTitle: css`
    margin: 0 0 4px !important;
  `,
  emptyDescription: css`
    max-width: 360px;
    margin-bottom: 18px;
    color: ${token.colorTextSecondary};
  `,
  sideStack: css`
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  progressGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  `,
  progressItem: css`
    min-width: 0;
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};

    .ant-statistic-content {
      font-size: 24px;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
  quickLinks: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  quickLink: css`
    display: flex;
    min-height: 56px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    transition:
      border-color ${token.motionDurationMid},
      background ${token.motionDurationMid};

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorFillQuaternary};
      color: ${token.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
    }
  `,
  quickLinkMain: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  `,
  quickLinkIcon: css`
    display: inline-flex;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  quickLinkCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
  `,
  quickLinkTitle: css`
    color: ${token.colorText};
    font-weight: 600;
  `,
  quickLinkDescription: css`
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  quickLinkMeta: css`
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  quickLinkCount: css`
    display: inline-flex;
    min-width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    padding-inline: 6px;
    border-radius: 11px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  `,
  widgetGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 1199px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  widgetCell: css`
    min-width: 0;
  `,
  widgetWidth1: css`
    grid-column: span 1;
  `,
  widgetWidth2: css`
    grid-column: span 2;

    @media (max-width: 767px) {
      grid-column: span 1;
    }
  `,
  widgetWidth3: css`
    grid-column: span 3;

    @media (max-width: 1199px) {
      grid-column: span 2;
    }

    @media (max-width: 767px) {
      grid-column: span 1;
    }
  `,
  mineWorkbenchTone: css`
    --workbench-widget-accent: #4f73c8;
    --workbench-widget-accent-rgb: 79 115 200;
    --workbench-widget-bg: linear-gradient(145deg, #ffffff 0%, #f5f7fb 100%);
    --workbench-widget-head-bg: rgb(239 243 249 / 88%);
    --workbench-widget-index-bg: #e7edf8;

    width: 100%;
  `,
  spaceWorkbenchTone: css`
    --workbench-widget-accent: #43838b;
    --workbench-widget-accent-rgb: 67 131 139;
    --workbench-widget-bg: linear-gradient(145deg, #ffffff 0%, #f2f7f7 100%);
    --workbench-widget-head-bg: rgb(234 243 243 / 90%);
    --workbench-widget-index-bg: #dfeeee;

    width: 100%;
  `,
  widgetFrame: css`
    position: relative;
    height: 100%;
    min-width: 0;

    &[data-variant='priority'] .ant-card,
    &[data-variant='risks'] .ant-card {
      display: flex;
      flex-direction: column;
    }

    &[data-variant='priority'] .ant-card-body,
    &[data-variant='risks'] .ant-card-body {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    &[data-variant='announcement'] .ant-card-body {
      padding: 0;
    }

    &[data-variant='announcement'] [data-role='widget-subtitle'] {
      padding: 12px 14px 0;
      margin-bottom: 11px;
    }

    &[data-variant='announcement'] .ant-card::after {
      display: none;
    }

    @media (max-width: 575px) {
      &[data-variant='publish'] .ant-card-head-wrapper,
      &[data-variant='workflow'] .ant-card-head-wrapper {
        align-items: stretch;
        flex-direction: column;
        gap: 8px;
        padding-block: 10px;
      }

      &[data-variant='publish'] .ant-card-extra,
      &[data-variant='workflow'] .ant-card-extra {
        width: 100%;
        overflow-x: auto;
        margin-inline-start: 0;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }

        .ant-segmented {
          min-width: max-content;
        }
      }
    }
  `,
  widgetCard: css`
    position: relative;
    height: 100%;
    overflow: hidden;
    border-color: ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    background:
      radial-gradient(
        circle at calc(100% - 17px) calc(100% - 15px),
        rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 10%) 0 2px,
        transparent 2.5px
      ),
      radial-gradient(
        circle at calc(100% - 28px) calc(100% - 15px),
        rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 6%) 0 2px,
        transparent 2.5px
      ),
      var(
        --workbench-widget-bg,
        linear-gradient(145deg, #ffffff 0%, #f6f8fb 100%)
      );
    box-shadow: 0 1px 3px rgb(31 51 86 / 4%);

    &::before {
      position: absolute;
      z-index: 2;
      top: -1px;
      left: -1px;
      width: 24px;
      height: 24px;
      border-top: 2px solid var(--workbench-widget-accent, #4f73c8);
      border-left: 2px solid var(--workbench-widget-accent, #4f73c8);
      border-radius: ${token.borderRadiusLG + 2}px 0 0;
      content: '';
      opacity: 0.68;
      pointer-events: none;
    }

    &::after {
      position: absolute;
      right: -31px;
      bottom: -39px;
      width: 96px;
      height: 96px;
      border: 1px solid
        rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 20%);
      border-radius: 50%;
      box-shadow:
        0 0 0 13px
        rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 4%),
        0 0 0 26px
        rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 2%);
      content: '';
      pointer-events: none;
    }

    .ant-card-head {
      position: relative;
      z-index: 1;
      min-height: 52px;
      padding-inline: 14px;
      border-bottom-color: ${token.colorBorderSecondary};
      background: var(--workbench-widget-head-bg, rgb(239 243 249 / 88%));

      &::before {
        position: absolute;
        bottom: -1px;
        left: 58px;
        width: 4px;
        height: 2px;
        border-radius: 2px;
        background: var(--workbench-widget-accent, #4f73c8);
        box-shadow:
          8px 0 0
          rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 52%),
          16px 0 0
          rgb(var(--workbench-widget-accent-rgb, 79 115 200) / 28%);
        content: '';
        pointer-events: none;
      }

      &::after {
        position: absolute;
        bottom: -1px;
        left: 14px;
        width: 38px;
        height: 2px;
        border-radius: 2px;
        background: var(--workbench-widget-accent, #4f73c8);
        content: '';
        opacity: 0.68;
      }
    }

    .ant-card-body {
      position: relative;
      z-index: 1;
      padding: 14px;
    }
  `,
  widgetCardError: css`
    border-color: ${token.colorErrorBorder};

    &::before {
      border-color: ${token.colorError};
    }
  `,
  widgetFrameHeading: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  `,
  widgetFrameIcon: css`
    display: inline-flex;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    border: 1px solid rgb(79 115 200 / 8%);
    background: var(--workbench-widget-index-bg, #e7edf8);
    color: var(--workbench-widget-accent, #4f73c8);
    font-size: 15px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  `,
  widgetFrameTitle: css`
    min-width: 0;
    overflow: hidden;
    color: ${token.colorTextHeading};
    font-weight: 650;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  widgetSubtitle: css`
    margin-bottom: 11px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.55;
  `,
  editableWidget: css`
    position: relative;
    padding-top: 44px;
    border: 1px dashed #8ea8ef;
    border-radius: ${token.borderRadiusLG + 2}px;

    &::before {
      position: absolute;
      top: -1px;
      left: -1px;
      width: 20px;
      height: 20px;
      border-top: 2px solid #4f7cff;
      border-left: 2px solid #4f7cff;
      border-radius: ${token.borderRadiusLG + 2}px 0 0;
      content: '';
    }

    &[data-dragging='true'] {
      border-style: solid;
      border-color: #4f7cff;
      box-shadow: 0 0 0 3px rgb(79 124 255 / 12%);
      opacity: 0.5;
    }
  `,
  editableWidgetLabel: css`
    position: absolute;
    top: 12px;
    left: 12px;
    color: ${token.colorTextTertiary};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
  `,
  widgetEditorControls: css`
    position: absolute;
    z-index: 2;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  widgetDragHandle: css`
    display: inline-flex;
    width: 30px;
    height: 30px;
    cursor: grab;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgContainer};
    color: ${token.colorTextSecondary};

    &:active {
      cursor: grabbing;
    }
  `,
  widgetDragOverlay: css`
    min-width: 220px;
    padding: 18px;
    border: 1px solid #4f7cff;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    box-shadow: 0 16px 36px rgb(15 23 42 / 16%);
    font-weight: 600;
  `,
  widgetSettingsList: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  widgetCustomizeDrawer: css`
    .ant-drawer-header {
      border-bottom-color: ${token.colorBorderSecondary};
    }

    .ant-drawer-body {
      background: ${token.colorFillQuaternary};
    }
  `,
  widgetSettingsCount: css`
    display: inline-flex;
    align-items: center;
    margin-bottom: 12px;
    padding: 4px 8px;
    border-radius: 999px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  `,
  widgetSettingItem: css`
    padding: 12px 13px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  widgetSettingHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `,
  widgetSettingWidth: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
  `,
  widgetSettingTitle: css`
    display: inline-flex;
    align-items: center;
    gap: 8px;
  `,
  widgetSettingIcon: css`
    display: inline-flex;
    width: 26px;
    height: 26px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    border: 1px solid rgb(79 115 200 / 8%);
    background: var(--workbench-widget-index-bg, #e7edf8);
    color: var(--workbench-widget-accent, #4f73c8);
    font-size: 14px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  `,
  editToolbar: css`
    position: relative;
    z-index: 1;
    display: flex;
    min-width: 0;
    grid-column: 1 / -1;
    grid-row: 2;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 1px;
    padding: 11px 0 1px;
    border-top: 1px solid #dbe3f2;

    &::before {
      position: absolute;
      top: -1px;
      left: 0;
      width: 44px;
      height: 2px;
      border-radius: 2px;
      background: #4f7cff;
      content: '';
    }

    .ant-typography {
      color: ${token.colorText};
    }

    @media (max-width: 767px) {
      align-items: stretch;
      flex-direction: column;
      grid-row: 3;
      gap: 10px;
      padding-top: 11px;
    }
  `,
  editToolbarEyebrow: css`
    display: block;
    margin-bottom: 3px;
    color: #5577d8;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
  `,
  editToolbarTitle: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,
  editToolbarStatus: css`
    padding: 2px 7px;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextSecondary} !important;
    font-size: ${token.fontSizeSM}px;
  `,
  editToolbarActions: css`
    justify-content: flex-end;

    @media (max-width: 575px) {
      display: grid !important;
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));

      .ant-space-item,
      button {
        width: 100%;
      }

      .ant-space-item:last-child {
        grid-column: 1 / -1;
      }
    }
  `,
  summaryMetricGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;

    @media (max-width: 767px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  summaryMetricGridCompact: css`
    grid-template-columns: repeat(2, minmax(0, 1fr));
  `,
  summaryMetric: css`
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 116px;
    align-items: stretch;
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(150deg, ${token.colorBgContainer}, rgb(247 249 252 / 82%));
    color: ${token.colorTextTertiary};
    flex-direction: column;
    text-align: left;
    box-shadow: 0 2px 8px rgb(31 51 86 / 3%);
    transition:
      border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
      background 160ms cubic-bezier(0.23, 1, 0.32, 1),
      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);

    &::before {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 3px;
      background: ${token.colorPrimary};
      content: '';
    }

    &::after {
      position: absolute;
      right: 8px;
      bottom: 8px;
      width: 14px;
      height: 14px;
      border-right: 1px solid ${token.colorBorderSecondary};
      border-bottom: 1px solid ${token.colorBorderSecondary};
      border-radius: 0 0 ${token.borderRadiusSM}px;
      content: '';
      opacity: 0.72;
      pointer-events: none;
    }

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorFillQuaternary};
    }

    &:active {
      transform: scale(0.985);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: -2px;
    }

    .ant-statistic-content {
      margin-top: 10px;
      color: ${token.colorTextHeading};
      font-size: 26px;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      line-height: 1;
    }

  `,
  summaryMetricHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  summaryMetricIcon: css`
    display: inline-flex;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  summaryMetricHint: css`
    display: block;
    margin-top: auto;
    padding-top: 8px;
    color: ${token.colorTextTertiary};
    font-size: 11px;
    line-height: 1.4;
  `,
  summaryMetricDanger: css`
    &::before {
      background: ${token.colorError};
    }

    > span:first-child > span:last-child {
      background: ${token.colorErrorBg};
      color: ${token.colorError};
    }
  `,
  summaryMetricWarning: css`
    &::before {
      background: ${token.colorWarning};
    }

    > span:first-child > span:last-child {
      background: ${token.colorWarningBg};
      color: ${token.colorWarningText};
    }
  `,
  summaryMetricInfo: css`
    &::before {
      background: ${token.colorInfo};
    }

    > span:first-child > span:last-child {
      background: ${token.colorInfoBg};
      color: ${token.colorInfo};
    }
  `,
  summaryMetricPrimary: css`
    &::before {
      background: #8c6ae8;
    }

    > span:first-child > span:last-child {
      background: #f2efff;
      color: #7556cc;
    }
  `,
  priorityTaskList: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  inspectionHouseList: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  inspectionHouseItem: css`
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 68%);
    color: ${token.colorTextTertiary};
    text-align: left;
    transition:
      border-color ${token.motionDurationFast},
      background ${token.motionDurationFast};

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorPrimaryBg};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
    }
  `,
  inspectionHouseCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;

    strong {
      overflow: hidden;
      color: ${token.colorText};
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ant-tag {
      margin-inline-end: 0;
    }
  `,
  priorityTaskContent: css`
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  `,
  priorityTaskRow: css`
    position: relative;
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 68%);
    @media (max-width: 767px) {
      grid-template-columns: 72px minmax(0, 1fr);

      > :last-child {
        grid-column: 2;
      }
    }
  `,
  priorityTaskDue: css`
    position: relative;
    display: flex;
    min-height: 42px;
    justify-content: center;
    flex-direction: column;
    padding: 8px 8px 8px 14px;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;

    &::before {
      position: absolute;
      top: 2px;
      bottom: 2px;
      left: 0;
      width: 3px;
      border-radius: 3px;
      background: ${token.colorPrimary};
      content: '';
    }

    [data-tone='danger'] & strong {
      color: ${token.colorError};
    }

    [data-tone='danger'] &::before {
      background: ${token.colorError};
    }

    [data-tone='warning'] & strong {
      color: ${token.colorWarningText};
    }

    [data-tone='warning'] &::before {
      background: ${token.colorWarning};
    }
  `,
  priorityTaskMain: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;
  `,
  priorityTaskTitle: css`
    overflow: hidden;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${token.colorText};
    font-size: ${token.fontSizeLG}px;
    font-weight: 650;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover,
    &:focus-visible {
      color: ${token.colorPrimary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
      border-radius: 2px;
    }
  `,
  priorityTaskActions: css`
    display: flex;
    justify-content: flex-end;

    @media (max-width: 767px) {
      width: 100%;
      justify-content: flex-end;
    }
  `,
  priorityTaskGuide: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    margin-top: auto;
    padding: 12px;
    padding-top: 14px;
    border-top: 1px dashed ${token.colorBorderSecondary};
    color: ${token.colorTextSecondary};

    @media (max-width: 767px) {
      grid-template-columns: auto minmax(0, 1fr);
    }
  `,
  priorityTaskGuideIcon: css`
    display: inline-flex;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid #d9e2f0;
    border-radius: ${token.borderRadius}px;
    background: #e9eef8;
    color: #4f73c8;
    font-size: 16px;
  `,
  priorityTaskGuideCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    strong {
      color: ${token.colorText};
      font-size: ${token.fontSizeSM}px;
    }

    small {
      color: ${token.colorTextTertiary};
      font-size: 11px;
    }
  `,
  priorityTaskGuideRule: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 999px;
    background: rgb(255 255 255 / 66%);
    color: ${token.colorTextSecondary};
    font-size: 11px;
    white-space: nowrap;

    > :first-child {
      color: #4f73c8;
    }

    @media (max-width: 767px) {
      grid-column: span 1;
      justify-content: center;
      white-space: normal;
    }
  `,
  widgetCompactEmpty: css`
    display: flex;
    min-height: 116px;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 14px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 54%);
  `,
  widgetCompactEmptyIcon: css`
    display: inline-flex;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: ${token.colorSuccessBg};
    color: ${token.colorSuccess};
    font-size: 19px;
    box-shadow: 0 0 0 6px rgb(82 196 26 / 6%);
  `,
  widgetCompactEmptyCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;

    strong {
      color: ${token.colorText};
    }

    small {
      color: ${token.colorTextSecondary};
      line-height: 1.5;
    }
  `,
  taskProgressBody: css`
    position: relative;
    display: flex;
    min-height: 222px;
    overflow: hidden;
    align-items: center;
    justify-content: center;
    padding: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    flex-direction: column;
    background:
      radial-gradient(circle at 50% 32%, rgb(79 115 200 / 9%), transparent 36%),
      rgb(255 255 255 / 58%);

    &::before,
    &::after {
      position: absolute;
      border: 1px solid rgb(79 115 200 / 8%);
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }

    &::before {
      top: -34px;
      left: -26px;
      width: 94px;
      height: 94px;
    }

    &::after {
      right: -20px;
      bottom: -44px;
      width: 112px;
      height: 112px;
    }

    > * {
      z-index: 1;
    }

    .ant-progress-text {
      color: ${token.colorTextHeading} !important;
      font-size: 24px !important;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
  `,
  taskProgressStats: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 12px;
    gap: 8px;
    margin-top: 14px;

    .ant-statistic {
      padding: 10px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadius}px;
      background: rgb(255 255 255 / 72%);
      text-align: center;
    }

    .ant-statistic-title {
      margin-bottom: 2px;
      font-size: 11px;
    }

    .ant-statistic-content {
      font-size: 20px;
      font-variant-numeric: tabular-nums;
      font-weight: 650;
    }
  `,
  taskProgressCaption: css`
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 7px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgb(255 255 255 / 72%);
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;

    strong {
      color: ${token.colorText};
      font-variant-numeric: tabular-nums;
    }
  `,
  announcementSummaryList: css`
    display: flex;
    flex-direction: column;
    background: linear-gradient(120deg, #fff7df, #fffdf7 72%);
  `,
  announcementSummaryEmpty: css`
    position: relative;
    display: flex;
    min-height: 176px;
    overflow: hidden;
    align-items: center;
    gap: 16px;
    margin: 0 16px 16px;
    padding: 22px;
    border: 1px dashed #cbd7e8;
    border-radius: ${token.borderRadiusLG}px;
    background:
      radial-gradient(circle at 88% 24%, rgb(79 115 200 / 8%), transparent 28%),
      linear-gradient(135deg, rgb(255 255 255 / 82%), rgb(239 243 249 / 72%));

    &::before,
    &::after {
      position: absolute;
      border: 1px solid rgb(79 115 200 / 10%);
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }

    &::before {
      top: -42px;
      right: -18px;
      width: 108px;
      height: 108px;
    }

    &::after {
      right: 40px;
      bottom: -54px;
      width: 86px;
      height: 86px;
    }

    @media (max-width: 575px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
    }
  `,
  announcementSummaryEmptyIcon: css`
    z-index: 1;
    display: inline-flex;
    width: 48px;
    height: 48px;
    flex: 0 0 48px;
    align-items: center;
    justify-content: center;
    border: 1px solid #d5dfef;
    border-radius: ${token.borderRadiusLG}px;
    background: #e9eef8;
    color: #4f73c8;
    font-size: 22px;
    box-shadow: 0 6px 16px rgb(44 72 128 / 8%);
  `,
  announcementSummaryEmptyCopy: css`
    z-index: 1;
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;

    strong {
      color: ${token.colorTextHeading};
      font-size: ${token.fontSizeLG}px;
    }

    > span {
      color: ${token.colorTextSecondary};
      font-size: ${token.fontSizeSM}px;
      line-height: 1.6;
    }
  `,
  announcementSummaryItem: css`
    position: relative;
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 18px 13px 22px;
    border: 0;
    border-top: 1px solid #f0e4c4;
    background: transparent;
    color: ${token.colorText};
    text-align: left;

    &:first-child {
      border-top: 0;
    }

    &::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 5px;
      background: ${token.colorWarning};
      content: '';
    }

    &:first-child::after {
      position: absolute;
      top: 0;
      right: 0;
      width: 18px;
      height: 18px;
      background: linear-gradient(225deg, #d8b767 50%, transparent 51%);
      content: '';
    }

    &:hover,
    &:focus-visible {
      background: rgb(255 255 255 / 45%);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorWarningBorder};
      outline-offset: -2px;
    }
  `,
  announcementSummaryCopy: css`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 4px;
  `,
  announcementSummaryLabel: css`
    color: ${token.colorWarningText};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
  `,
  widgetQuickActions: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;

    &[data-wide='true'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  widgetQuickAction: css`
    position: relative;
    display: flex;
    min-height: 78px;
    align-items: center;
    gap: 10px;
    padding: 12px 40px 12px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(145deg, rgb(255 255 255 / 88%), rgb(241 245 250 / 76%));
    color: ${token.colorText};
    text-align: left;
    transition:
      border-color ${token.motionDurationMid},
      background ${token.motionDurationMid},
      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorBgContainer};
    }

    &:active {
      transform: scale(0.985);
    }

    &:hover > :last-child {
      transform: translateX(2px);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
    }

    small {
      color: ${token.colorTextSecondary};
    }
  `,
  widgetQuickActionIcon: css`
    display: inline-flex;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    border: 1px solid #d9e2f0;
    background: #e9eef8;
    color: #4f73c8;
    font-size: 17px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  `,
  widgetQuickActionCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  `,
  widgetQuickActionArrow: css`
    position: absolute;
    right: 12px;
    display: inline-flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextTertiary};
    transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  `,
  spaceOverviewGrid: css`
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;

    @media (max-width: 767px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  spaceOverviewGridCompact: css`
    grid-template-columns: repeat(3, minmax(0, 1fr));

    > :nth-last-child(-n + 2) {
      grid-column: span 1;
    }
  `,
  spaceOverviewMetric: css`
    position: relative;
    min-width: 0;
    min-height: 120px;
    padding: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(150deg, ${token.colorBgContainer}, rgb(245 249 249 / 82%));
    box-shadow: 0 2px 8px rgb(31 51 86 / 3%);

    &::before {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 3px;
      background: ${token.colorPrimary};
      content: '';
    }

    &::after {
      position: absolute;
      right: 8px;
      bottom: 8px;
      width: 14px;
      height: 14px;
      border-right: 1px solid ${token.colorBorderSecondary};
      border-bottom: 1px solid ${token.colorBorderSecondary};
      border-radius: 0 0 ${token.borderRadiusSM}px;
      content: '';
      opacity: 0.72;
      pointer-events: none;
    }

    .ant-statistic-content {
      margin-top: 10px;
      color: ${token.colorTextHeading};
      font-size: 26px;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      line-height: 1;
    }

    > small {
      display: block;
      margin-top: 6px;
      color: ${token.colorTextTertiary};
      font-size: 11px;
      line-height: 1.45;
    }

    @media (max-width: 767px) {
      &:last-child {
        grid-column: span 2;
      }
    }
  `,
  spaceOverviewMetricHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  spaceOverviewMetricIcon: css`
    display: inline-flex;
    width: 24px;
    height: 24px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
  `,
  spaceOverviewMetricPrimary: css`
    &::before {
      background: ${token.colorPrimary};
    }
  `,
  spaceOverviewMetricDanger: css`
    &::before {
      background: ${token.colorError};
    }

    > span:first-child > span:last-child {
      background: ${token.colorErrorBg};
      color: ${token.colorError};
    }
  `,
  spaceOverviewMetricSuccess: css`
    &::before {
      background: ${token.colorSuccess};
    }

    > span:first-child > span:last-child {
      background: ${token.colorSuccessBg};
      color: ${token.colorSuccess};
    }
  `,
  spaceOverviewMetricWarning: css`
    &::before {
      background: ${token.colorWarning};
    }

    > span:first-child > span:last-child {
      background: ${token.colorWarningBg};
      color: ${token.colorWarningText};
    }
  `,
  spaceOverviewMetricPurple: css`
    &::before {
      background: #8c6ae8;
    }

    > span:first-child > span:last-child {
      background: #f2efff;
      color: #7556cc;
    }
  `,
  spacePublishQueue: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;

    &[data-wide='true'] {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      &[data-wide='true'] {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  spacePublishQueueItem: css`
    position: relative;
    display: grid;
    grid-template-columns: 5px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 68%);
    &[data-stage='blocked'] > :first-child {
      background: ${token.colorError};
    }

    &[data-stage='ready'] > :first-child {
      background: ${token.colorSuccess};
    }

    @media (max-width: 767px) {
      grid-template-columns: 5px minmax(0, 1fr);

      > :last-child {
        grid-column: 2;
      }
    }
  `,
  spacePublishStatusBar: css`
    width: 4px;
    height: 100%;
    min-height: 48px;
    border-radius: 4px;
  `,
  spacePublishQueueCopy: css`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 6px;

    > strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  spacePublishQueueActions: css`
    display: flex;
    justify-content: flex-end;
  `,
  spacePublishQueueFooter: css`
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    margin-top: 4px;
    padding: 10px 12px;
    border: 1px dashed #c9dadd;
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(135deg, rgb(255 255 255 / 70%), rgb(232 242 242 / 72%));

    [data-wide='true'] & {
      grid-column: 1 / -1;
    }

    @media (max-width: 767px) {
      grid-template-columns: auto minmax(0, 1fr);

      > :last-child {
        grid-column: 2;
        justify-self: start;
        padding-inline: 0;
      }
    }
  `,
  spacePublishQueueFooterIcon: css`
    display: inline-flex;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid #cfe0e2;
    border-radius: ${token.borderRadius}px;
    background: #e1eff0;
    color: #43838b;
    font-size: 16px;
  `,
  spacePublishQueueFooterCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;

    strong {
      color: ${token.colorText};
      font-size: ${token.fontSizeSM}px;
    }

    small {
      color: ${token.colorTextTertiary};
      font-size: 11px;
      line-height: 1.45;
    }
  `,
  spaceWorkList: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;
  `,
  spaceFilterAlert: css`
    margin-bottom: 12px;
  `,
  spaceWorkRow: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 68%);

    @media (max-width: 767px) {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }
  `,
  spaceWorkMain: css`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 6px;
  `,
  spaceRiskList: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  spaceRiskContent: css`
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 12px;

    &[data-wide='true'] {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: stretch;
    }

    @media (max-width: 767px) {
      &[data-wide='true'] {
        display: flex;
      }
    }
  `,
  spaceRiskItem: css`
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: #fff7f7;
    color: ${token.colorText};
    text-align: left;
    box-shadow: 0 2px 8px rgb(31 51 86 / 3%);
    transition:
      border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
      background 160ms cubic-bezier(0.23, 1, 0.32, 1),
      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);

    &:hover {
      border-color: ${token.colorErrorBorderHover};
    }

    &:active {
      transform: scale(0.985);
    }

    &::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 4px;
      border-radius: ${token.borderRadiusLG}px 0 0 ${token.borderRadiusLG}px;
      background: ${token.colorError};
      content: '';
    }

    &[data-level='danger'] > :first-child {
      color: ${token.colorError};
    }

    &[data-level='warning'] {
      border-color: ${token.colorWarningBorder};
      background: ${token.colorWarningBg};
    }

    &[data-level='warning']::before {
      background: ${token.colorWarning};
    }

    &[data-level='warning'] > :first-child {
      color: ${token.colorWarningText};
    }

    &[data-level='info'] {
      border-color: #ddd9ef;
      background: #faf8ff;
    }

    &[data-level='info']::before {
      background: #8c6ae8;
    }

    &[data-level='info'] > :first-child {
      color: ${token.colorInfo};
    }
  `,
  spaceRiskCount: css`
    min-width: 34px;
    padding-left: 4px;
    font-size: 24px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1;
  `,
  spaceRiskCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;

    small {
      color: ${token.colorTextTertiary};
      font-size: 11px;
      letter-spacing: 0.02em;
    }
  `,
  spaceRiskGuide: css`
    position: relative;
    display: flex;
    min-height: 190px;
    overflow: hidden;
    flex: 1;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
    border: 1px solid #cfe0e2;
    border-radius: ${token.borderRadiusLG}px;
    background:
      radial-gradient(circle at 92% 10%, rgb(67 131 139 / 9%), transparent 28%),
      linear-gradient(145deg, rgb(255 255 255 / 78%), rgb(232 242 242 / 72%));

    &::after {
      position: absolute;
      right: -34px;
      bottom: -46px;
      width: 104px;
      height: 104px;
      border: 1px solid rgb(67 131 139 / 12%);
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }
  `,
  spaceRiskGuideHeading: css`
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;

    > :first-child {
      display: inline-flex;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      align-items: center;
      justify-content: center;
      border-radius: ${token.borderRadius}px;
      background: #dfeeee;
      color: #43838b;
      font-size: 17px;
    }

    > :last-child {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 2px;
    }

    strong {
      color: ${token.colorText};
      font-size: ${token.fontSizeSM}px;
    }

    small {
      color: ${token.colorTextTertiary};
      font-size: 11px;
    }
  `,
  spaceRiskGuideSteps: css`
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    justify-content: space-around;
    flex-direction: column;
    gap: 10px;

    &::before {
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 11px;
      width: 1px;
      background: #c9dadd;
      content: '';
    }

    > span {
      z-index: 1;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      align-items: center;
      gap: 9px;
    }

    > span > :first-child {
      display: inline-flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      border: 1px solid #d5e3e5;
      border-radius: 50%;
      background: rgb(255 255 255 / 72%);
      color: #43838b;
      font-size: 11px;
    }

    > span > span {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 1px;
    }

    strong {
      color: ${token.colorText};
      font-size: 12px;
      font-weight: 600;
    }

    small {
      color: ${token.colorTextTertiary};
      font-size: 10px;
      line-height: 1.4;
    }
  `,
  spaceRiskGuideAction: css`
    z-index: 1;
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: auto;
    padding: 9px 11px;
    border: 1px solid #c9dadd;
    border-radius: ${token.borderRadius}px;
    background: rgb(255 255 255 / 70%);
    color: #356f76;
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
    text-align: left;
    transition:
      border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
      background 160ms cubic-bezier(0.23, 1, 0.32, 1),
      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);

    &:hover,
    &:focus-visible {
      border-color: #9ebfc3;
      background: rgb(255 255 255 / 92%);
    }

    &:active {
      transform: scale(0.985);
    }

    &:focus-visible {
      outline: 2px solid #9ebfc3;
      outline-offset: 2px;
    }
  `,
  spaceWorkflowRail: css`
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    padding: 12px;
    margin-bottom: 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: rgb(255 255 255 / 58%);
    list-style: none;

    &::before {
      position: absolute;
      top: 27px;
      right: 14%;
      left: 14%;
      height: 2px;
      background: ${token.colorBorderSecondary};
      content: '';
    }

    @media (max-width: 575px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      &::before {
        display: none;
      }
    }
  `,
  spaceWorkflowStage: css`
    z-index: 1;
    display: flex;
    align-items: center;
    color: ${token.colorTextSecondary};
    flex-direction: column;
    gap: 7px;
    font-size: ${token.fontSizeSM}px;
    text-align: center;

    > strong {
      font-size: 11px;
      font-weight: 600;
    }

    > span {
      display: inline-flex;
      width: 32px;
      height: 32px;
      align-items: center;
      justify-content: center;
      border: 4px solid ${token.colorBgContainer};
      border-radius: 50%;
      background: ${token.colorFillSecondary};
      color: ${token.colorTextSecondary};
      font-size: 13px;
      box-shadow: 0 0 0 1px ${token.colorBorderSecondary};
      transition:
        background 160ms cubic-bezier(0.23, 1, 0.32, 1),
        color 160ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    &[data-active='true'] > span {
      background: #4f7cff;
      color: ${token.colorTextLightSolid};
      box-shadow: 0 0 0 1px #cbd7ff;
    }
  `,
  spaceQuickActions: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;

    &[data-wide='true'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 767px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  spaceQuickAction: css`
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    min-height: 78px;
    align-items: center;
    column-gap: 12px;
    row-gap: 3px;
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: linear-gradient(145deg, rgb(255 255 255 / 88%), rgb(239 247 247 / 76%));
    color: ${token.colorText};
    text-align: left;
    transition:
      border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
      background 160ms cubic-bezier(0.23, 1, 0.32, 1),
      transform 120ms cubic-bezier(0.23, 1, 0.32, 1);

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorBgContainer};
    }

    &:active {
      transform: scale(0.985);
    }

    &:hover > :last-child {
      transform: translateX(2px);
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimaryBorderHover};
      outline-offset: 2px;
    }

    small {
      grid-column: 2;
      grid-row: 2;
      color: ${token.colorTextSecondary};
      line-height: 1.45;
    }

    > strong {
      grid-column: 2;
      grid-row: 1;
    }
  `,
  spaceQuickActionIcon: css`
    display: inline-flex;
    width: 36px;
    height: 36px;
    grid-column: 1;
    grid-row: 1 / span 2;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadius}px;
    border: 1px solid #cfe0e2;
    background: #e1eff0;
    color: #43838b;
    font-size: 17px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 72%);
  `,
  spaceQuickActionArrow: css`
    display: inline-flex;
    width: 24px;
    height: 24px;
    grid-column: 3;
    grid-row: 1 / span 2;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextTertiary};
    transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  `,
}));
