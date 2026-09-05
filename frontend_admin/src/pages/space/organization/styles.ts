import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  page: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginLG}px;
  `,
  workspace: css`
    display: flex;
    align-items: stretch;
    gap: ${token.margin}px;
    height: calc(100dvh - 120px);
    min-width: 0;
    min-height: 520px;

    @media (max-width: ${token.screenMD - 1}px) {
      display: block;
      height: auto;
      min-height: 0;
    }
  `,
  treePanel: css`
    display: flex;
    flex: 0 0 280px;
    flex-direction: column;
    width: 280px;
    min-width: 0;
    min-height: 0;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    overflow: hidden;
  `,
  treeHeader: css`
    padding: 12px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
  `,
  treeHeading: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,
  treeHeadingLabel: css`
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  `,
  treeHeadingIcon: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeLG}px;
  `,
  treeHeadingAction: css`
    &[data-active='true'] {
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
    }
  `,
  treeSearch: css`
    width: 100%;
    margin-top: 12px;

    .ant-input-affix-wrapper,
    .ant-input-search-button {
      background: ${token.colorFillQuaternary};
      border-color: transparent;
      box-shadow: none;
    }

    .ant-input-search-button {
      color: ${token.colorTextSecondary};
    }

    &:focus-within {
      .ant-input-affix-wrapper,
      .ant-input-search-button {
        border-color: ${token.colorPrimary};
      }
    }
  `,
  treeBody: css`
    flex: 1;
    min-height: 0;
    padding: 8px;
    overflow: auto;
  `,
  treePrimaryLinks: css`
    display: grid;
    gap: 4px;
    padding-block: 4px;
  `,
  treeSectionLabel: css`
    display: block;
    padding: 12px 8px 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  treeRow: css`
    display: flex;
    min-height: 36px;
    align-items: center;
    gap: 4px;
    padding-inline: 8px;
    border: 1px solid transparent;
    border-radius: ${token.borderRadius}px;
    color: ${token.colorText};
    transition:
      background-color ${token.motionDurationFast},
      border-color ${token.motionDurationFast},
      color ${token.motionDurationFast};

    &:hover {
      background: ${token.colorFillQuaternary};
    }

    &[data-active='true'] {
      background: ${token.colorPrimaryBg};
      border-color: ${token.colorPrimaryBorderHover};
      color: ${token.colorPrimary};
      font-weight: 500;
    }

    &[data-active='true'] .organization-row-count {
      padding: 2px 7px;
      border-radius: ${token.borderRadiusLG}px;
      background: ${token.colorBgContainer};
      color: ${token.colorPrimary};
    }

    > .ant-btn:hover,
    > .ant-btn:active,
    > .ant-btn:focus {
      background: transparent !important;
    }

    &[data-active='true'] > .ant-btn,
    &[data-active='true'] > .ant-btn:hover,
    &[data-active='true'] > .ant-btn:active,
    &[data-active='true'] > .ant-btn:focus {
      color: ${token.colorPrimary} !important;
    }
  `,
  treeExpandButton: css`
    flex: 0 0 auto;
  `,
  treeLabelButton: css`
    display: flex;
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    padding-inline: 4px;
    color: inherit;
    text-align: start;

    > span:last-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:focus,
    &:focus-visible {
      outline: none !important;
    }
  `,
  treeCount: css`
    flex: 0 0 auto;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    white-space: nowrap;
    transition:
      background-color ${token.motionDurationFast},
      color ${token.motionDurationFast};
  `,
  treeChildMotion: css`
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition:
      grid-template-rows ${token.motionDurationMid} ${token.motionEaseInOut},
      opacity ${token.motionDurationFast} ${token.motionEaseInOut},
      transform ${token.motionDurationMid} ${token.motionEaseInOut};

    &[data-expanded='true'] {
      grid-template-rows: 1fr;
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  treeChildMotionInner: css`
    min-height: 0;
    overflow: hidden;
  `,
  treeLoadingSkeleton: css`
    padding-block: ${token.paddingXS}px;
  `,
  treeLoadError: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginXS}px;
    padding: ${token.paddingXS}px;
  `,
  treeChildList: css`
    position: relative;
    padding-inline-start: 28px;

    &[data-show-line='true']::before {
      position: absolute;
      inset-inline-start: 15px;
      top: 0;
      bottom: 18px;
      width: 1px;
      background: ${token.colorBorder};
      content: '';
    }
  `,
  treeChildRow: css`
    position: relative;

    &::before {
      position: absolute;
      inset-inline-start: -13px;
      top: 18px;
      width: 13px;
      border-top: 1px solid ${token.colorBorder};
      content: '';
    }
  `,
  treeDivider: css`
    margin: 10px 8px 0;
    border-top: 1px dashed ${token.colorBorderSecondary};
  `,
  treeEmptyRow: css`
    display: flex;
    min-height: 40px;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    padding: 6px 8px 6px 10px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  treeFooter: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 4px;
    padding: 8px;
    border-top: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
  `,
  treeFooterButton: css`
    height: auto;
    min-width: 0;
    padding: 6px 2px;
    color: ${token.colorTextSecondary};
    white-space: normal;

    > span:last-child {
      font-size: ${token.fontSizeSM}px;
      line-height: 1.25;
    }

    &[data-active='true'] {
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
      font-weight: 500;
    }
  `,
  contentPanel: css`
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;

    > .ant-card {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      border-color: ${token.colorBorderSecondary};

      > .ant-card-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
    }
  `,
  organizationWorkspaceCard: css`
    > .ant-card-head .ant-card-head-wrapper {
      gap: ${token.marginMD}px;
    }

    > .ant-card-head .ant-card-extra {
      max-width: calc(100% - 160px);
    }

    @media (max-width: ${token.screenSM - 1}px) {
      > .ant-card-head .ant-card-head-wrapper {
        align-items: stretch;
        flex-direction: column;
        padding-block: ${token.paddingSM}px;
      }

      > .ant-card-head .ant-card-title,
      > .ant-card-head .ant-card-extra {
        width: 100%;
        max-width: 100%;
        padding-block: 0;
      }
    }
  `,
  workspaceActions: css`
    display: flex;
    justify-content: flex-end;
    max-width: 100%;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 100%;
      align-items: stretch;
      flex-direction: column;

      > .ant-btn {
        width: 100%;
      }
    }
  `,
  memberTeamsCard: css`
    > .ant-card-body {
      min-height: 240px;
    }

    @media (max-width: ${token.screenSM - 1}px) {
      > .ant-card-head .ant-card-head-wrapper {
        align-items: stretch;
        flex-direction: column;
        gap: ${token.marginSM}px;
        padding-block: ${token.paddingSM}px;
      }

      > .ant-card-head .ant-card-title,
      > .ant-card-head .ant-card-extra {
        width: 100%;
        padding-block: 0;
      }
    }
  `,
  memberTeamsHint: css`
    font-size: ${token.fontSizeSM}px;
    font-weight: 400;
  `,
  memberTeamsHeaderActions: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;

    > .ant-select {
      width: 260px;
    }

    @media (max-width: ${token.screenSM - 1}px) {
      align-items: stretch;
      flex-direction: column;

      > .ant-select,
      > .ant-btn {
        width: 100%;
      }
    }
  `,
  memberTeamRow: css`
    min-height: 56px;
    padding-block: ${token.paddingXS}px;
  `,
  memberTeamDivider: css`
    margin-block: 0 !important;
  `,
  entityHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${token.marginLG}px;
    flex-wrap: wrap;
    margin-bottom: ${token.marginLG}px;
  `,
  dangerCollapse: css`
    margin-top: ${token.marginLG}px;
    border-top: 1px solid ${token.colorBorderSecondary};

    > .ant-collapse-item {
      border-bottom: 0;
    }

    > .ant-collapse-item > .ant-collapse-header {
      width: fit-content;
      padding: 12px 0 0;
      color: ${token.colorTextSecondary};
      font-size: ${token.fontSizeSM}px;
      transition: color ${token.motionDurationFast};

      &:hover {
        color: ${token.colorText};
      }
    }

    > .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box {
      padding: 12px 0 0;
    }
  `,
  dangerActionPanel: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginLG}px;
    padding: ${token.paddingSM}px ${token.paddingMD}px;
    border: 1px solid ${token.colorErrorBorder};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorErrorBg};

    @media (max-width: ${token.screenSM - 1}px) {
      align-items: stretch;
      flex-direction: column;
    }
  `,
  dangerActionCopy: css`
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  `,
  entityIdentity: css`
    display: flex;
    align-items: center;
    gap: ${token.marginMD}px;
    min-width: 0;
  `,
  summaryGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: ${token.marginMD}px;

    @media (max-width: ${token.screenLG - 1}px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: ${token.screenSM - 1}px) {
      grid-template-columns: 1fr;
    }
  `,
  summaryButton: css`
    width: 100%;
    height: 100%;
    padding: ${token.paddingLG}px;
    text-align: left;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    cursor: pointer;
    transition: border-color ${token.motionDurationMid};

    &:hover,
    &:focus-visible {
      border-color: ${token.colorPrimaryBorder};
      outline: none;
    }
  `,
}));
