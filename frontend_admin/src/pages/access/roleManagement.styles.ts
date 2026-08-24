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
  toolbar: css`
    display: flex;
    align-items: center;
    gap: ${token.marginSM}px;
    padding: ${token.padding}px ${token.paddingLG}px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    flex-wrap: wrap;

    @media (max-width: ${token.screenSM - 1}px) {
      align-items: stretch;
      flex-direction: column;
      padding: ${token.padding}px;
    }
  `,
  toolbarSearch: css`
    width: min(260px, 100%);
  `,
  toolbarSelect: css`
    width: 150px;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 100%;
    }
  `,
  toolbarSpacer: css`
    min-width: 0;
    flex: 1;
  `,
  toolbarPrimary: css`
    margin-left: auto;

    @media (max-width: ${token.screenSM - 1}px) {
      width: 100%;
      margin-left: 0;
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
    background: ${token.colorFillQuaternary};

    @media (max-width: ${token.screenMD - 1}px) {
      display: none;
    }
  `,
  scopeTree: css`
    min-height: 0;
    margin-top: ${token.marginSM}px;
    overflow: auto;
    background: transparent;

    .ant-tree-node-content-wrapper {
      min-width: 0;
      flex: 1;
    }
  `,
  scopeTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: ${token.marginSM}px;
  `,
  scopeName: css`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  scopeCount: css`
    flex: 0 0 auto;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  content: css`
    min-width: 0;
    flex: 1;
    padding: ${token.paddingLG}px;

    @media (max-width: ${token.screenMD - 1}px) {
      padding: ${token.padding}px;
    }
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
  summaryStrip: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: ${token.marginLG}px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};

    @media (max-width: ${token.screenSM - 1}px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  summaryItem: css`
    min-width: 0;
    padding: ${token.paddingSM}px ${token.padding}px;
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
  roleNameButton: css`
    height: auto;
    max-width: 100%;
    padding: 0;
    text-align: left;
    white-space: normal;
  `,
  roleDescription: css`
    display: block;
    max-width: 360px;
    margin-top: 2px;
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
