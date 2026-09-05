import { createStyles } from 'antd-style';

export const useRoleManagementStyles = createStyles(({ css, token }) => ({
  pageDescription: css`
    margin-bottom: ${token.margin}px !important;
  `,
  workbenchCard: css`
    overflow: hidden;

    .ant-card-body {
      padding: 0;
    }
  `,
  toolbarSelect: css`
    width: 150px;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 100%;
    }
  `,
  workspace: css`
    display: flex;
    min-width: 0;
    min-height: 560px;

    @media (max-width: ${token.screenMD - 1}px) {
      display: block;
      min-height: 0;
    }
  `,
  scopeNavigator: css`
    display: flex;
    width: 260px;
    flex: 0 0 260px;
    flex-direction: column;
    padding: ${token.padding}px;
    border-right: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};

    @media (max-width: ${token.screenMD - 1}px) {
      display: none;
    }
  `,
  scopeNavigationBody: css`
    min-height: 0;
    margin-top: ${token.marginSM}px;
    overflow: auto;
    padding-inline: 1px;
  `,
  scopePrimaryLinks: css`
    display: grid;
    gap: 4px;
    padding-block: 4px;
  `,
  scopeTeamList: css`
    display: grid;
    gap: 4px;
  `,
  scopeRow: css`
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    padding-inline: ${token.paddingSM}px;
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
      border-color: ${token.colorPrimaryBorderHover};
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
      font-weight: 500;
    }

    &[data-active='true'] .role-scope-count {
      padding: 2px 7px;
      border-radius: ${token.borderRadiusLG}px;
      background: ${token.colorBgContainer};
      color: ${token.colorPrimary};
    }

    > .ant-btn:hover,
    > .ant-btn:active,
    > .ant-btn:focus {
      background: transparent !important;
      color: inherit !important;
    }
  `,
  scopeRowButton: css`
    display: flex;
    height: auto;
    min-height: 34px;
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
  `,
  scopeCount: css`
    flex: 0 0 auto;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    white-space: nowrap;
    transition:
      background-color ${token.motionDurationFast},
      color ${token.motionDurationFast};
  `,
  content: css`
    min-width: 0;
    flex: 1;
    padding: ${token.paddingLG}px;

    @media (max-width: ${token.screenMD - 1}px) {
      padding: ${token.padding}px;
    }
  `,
  embeddedContent: css`
    min-width: 0;
    flex: 1;
  `,
  mobileScopeBar: css`
    display: none;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginSM}px;
    margin-bottom: ${token.margin}px;

    @media (max-width: ${token.screenMD - 1}px) {
      display: flex;
    }
  `,
  scopeContext: css`
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    min-width: 0;
    align-items: flex-start;
    gap: ${token.marginSM}px;
    margin-bottom: ${token.margin}px;

    @media (max-width: ${token.screenSM - 1}px) {
      grid-template-columns: 36px minmax(0, 1fr);
    }
  `,
  scopeContextIcon: css`
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
  scopeContextCopy: css`
    min-width: 0;
    flex: 1;
  `,
  scopeContextTitleRow: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    gap: ${token.marginSM}px;
  `,
  scopeContextTitle: css`
    min-width: 0;
    margin: 0 !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  scopeContextDescription: css`
    display: block;
    margin-top: 2px;
  `,
  scopeContextAction: css`
    margin-left: auto;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 100%;
      grid-column: 1 / -1;
      margin-left: 0;
    }
  `,
  summaryStrip: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: ${token.margin}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    @media (max-width: ${token.screenSM - 1}px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  summaryItem: css`
    min-width: 0;
    padding: ${token.paddingXS}px ${token.padding}px;
    border-right: 1px solid ${token.colorBorderSecondary};

    &:last-child {
      border-right: 0;
    }

    @media (max-width: ${token.screenSM - 1}px) {
      &:nth-child(2) {
        border-right: 0;
      }

      &:nth-child(-n + 2) {
        border-bottom: 1px solid ${token.colorBorderSecondary};
      }
    }
  `,
  roleListToolbar: css`
    margin-bottom: ${token.marginSM}px;
  `,
  roleNameButton: css`
    height: auto;
    max-width: 100%;
    padding: 0;
    text-align: left;
    white-space: normal;
  `,
  roleIdentity: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  `,
  roleDescription: css`
    display: block;
    width: 100%;
    max-width: 360px;
  `,
  permissionGroups: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${token.marginSM}px;

    @media (max-width: ${token.screenSM - 1}px) {
      grid-template-columns: 1fr;
    }
  `,
  permissionGroup: css`
    padding: ${token.paddingSM}px ${token.padding}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
  `,
  permissionGroupHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginSM}px;
  `,
  memberIdentity: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: ${token.marginSM}px;
  `,
  memberText: css`
    min-width: 0;
  `,
  memberSecondary: css`
    display: block;
    overflow: hidden;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  drawerSection: css`
    margin-top: ${token.marginLG}px;
  `,
  drawerSectionHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginSM}px;
    margin-bottom: ${token.marginSM}px;
  `,
  teamWorkspace: css`
    display: flex;
    min-width: 0;
    min-height: 400px;
    margin-top: ${token.margin}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    overflow: hidden;

    @media (max-width: ${token.screenMD - 1}px) {
      display: block;
      min-height: 0;
      border: 0;
      border-radius: 0;
      overflow: visible;
    }
  `,
  teamNavigator: css`
    display: flex;
    width: 240px;
    flex: 0 0 240px;
    flex-direction: column;
    padding: ${token.paddingSM}px;
    border-right: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};

    @media (max-width: ${token.screenMD - 1}px) {
      display: none;
    }
  `,
  teamSearch: css`
    margin-bottom: ${token.marginSM}px;
  `,
  teamList: css`
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    overflow: auto;
  `,
  teamButton: css`
    display: flex;
    width: 100%;
    min-height: 38px;
    align-items: center;
    justify-content: space-between;
    padding-inline: ${token.paddingSM}px;
    border: 1px solid transparent;
    border-radius: ${token.borderRadius}px;
    background: transparent;
    color: ${token.colorText};
    cursor: pointer;
    text-align: left;
    transition:
      color ${token.motionDurationFast},
      background-color ${token.motionDurationFast},
      border-color ${token.motionDurationFast};

    &:hover {
      background: ${token.colorBgContainer};
    }

    &[data-active='true'] {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorPrimaryBg};
      color: ${token.colorPrimary};
      font-weight: 500;
    }
  `,
  teamName: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  teamMeta: css`
    flex: 0 0 auto;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  mobileTeamSelect: css`
    display: none;
    width: 100%;
    margin-top: ${token.margin}px;

    @media (max-width: ${token.screenMD - 1}px) {
      display: block;
    }
  `,
  roleContent: css`
    min-width: 0;
    flex: 1;
    padding: ${token.paddingLG}px;

    @media (max-width: ${token.screenMD - 1}px) {
      padding: ${token.padding}px 0 0;
    }
  `,
  panelHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${token.margin}px;
    margin-bottom: ${token.margin}px;

    @media (max-width: ${token.screenSM - 1}px) {
      align-items: stretch;
      flex-direction: column;
    }
  `,
  panelTitle: css`
    margin: 0 !important;
  `,
}));
