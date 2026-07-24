import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  createTaskModal: css`
    .ant-modal-container {
      overflow: hidden;
      padding: 0;
      border-radius: ${token.borderRadiusLG + 8}px;
      background: ${token.colorBgLayout};
      box-shadow: 0 24px 56px rgba(31, 51, 89, 0.22);
    }

    .ant-modal-header {
      margin: 0;
      padding: 16px 20px 14px;
      border: 0;
      background: linear-gradient(
        135deg,
        ${token.colorPrimaryActive},
        ${token.colorPrimary}
      );
    }

    .ant-modal-title {
      color: ${token.colorWhite};
    }

    .ant-modal-close {
      top: 14px;
      inset-inline-end: 18px;
      width: 32px;
      height: 32px;
      border-radius: ${token.borderRadiusSM}px;
      color: ${token.colorWhite};

      &:hover {
        color: ${token.colorWhite};
        background: rgba(255, 255, 255, 0.16);
      }
    }

    .ant-modal-body {
      max-height: calc(100vh - 156px);
      overflow-y: auto;
      padding: 12px 20px 14px;
      scrollbar-gutter: stable;
    }

    .ant-modal-footer {
      margin: 0;
      padding: 14px 20px 16px;
      border-top: 1px solid ${token.colorBorderSecondary};
      background: ${token.colorBgContainer};
    }

    @media (max-width: 575px) {
      max-width: calc(100vw - 24px);
      margin-block: 12px;

      .ant-modal-header {
        padding: 14px 16px 12px;
      }

      .ant-modal-body {
        max-height: calc(100vh - 146px);
        padding: 10px 12px 12px;
      }

      .ant-modal-footer {
        padding: 12px 12px 14px;
      }
    }
  `,
  createTaskTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
    padding-inline-end: 36px;
  `,
  createTaskTitleIcon: css`
    display: inline-flex;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusLG + 2}px;
    background: rgba(255, 255, 255, 0.18);
    color: ${token.colorWhite};
    font-size: 16px;
  `,
  createTaskTitleCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
  `,
  createTaskTitleText: css`
    color: ${token.colorWhite};
    font-size: 16px;
    line-height: 1.35;
  `,
  createTaskSubtitle: css`
    color: rgba(255, 255, 255, 0.82) !important;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
  `,
  createTaskForm: css`
    .ant-form-item {
      margin-bottom: 6px;
    }

    .ant-form-item-label {
      padding-bottom: 2px;
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
    padding: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    background: ${token.colorBgContainer};
    box-shadow: 0 8px 24px rgba(31, 51, 89, 0.05);

    & + & {
      margin-top: 10px;
    }

    .ant-form-item:last-child {
      margin-bottom: 0;
    }
  `,
  taskSectionTitle: css`
    margin: 0 0 8px !important;
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeSM}px !important;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.5;
  `,
  taskFieldsGrid: css`
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (max-width: 575px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  ownershipHint: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    padding: 8px 10px;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};

    .ant-typography {
      color: ${token.colorPrimary};
      font-size: ${token.fontSizeSM}px;
      line-height: 1.45;
    }
  `,
  createTaskFooter: css`
    display: flex;
    justify-content: flex-end;
  `,
  createTaskButton: css`
    box-shadow: 0 6px 14px ${token.colorPrimaryBgHover};
    transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);

    &:active {
      transform: scale(0.97);
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;

      &:active {
        transform: none;
      }
    }
  `,
}));
