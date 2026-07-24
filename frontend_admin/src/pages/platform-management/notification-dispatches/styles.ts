import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css, token }) => ({
  titlePreview: css`
    display: block;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  contentPreview: css`
    display: -webkit-box;
    max-width: 280px;
    overflow: hidden;
    word-break: break-word;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  `,
  deliveryCell: css`
    width: 112px;
  `,
  createModal: css`
    .ant-modal-container {
      overflow: hidden;
      padding: 0;
      border-radius: ${token.borderRadiusLG + 8}px;
      background: ${token.colorBgLayout};
      box-shadow: 0 24px 56px rgba(31, 51, 89, 0.22);
    }

    .ant-modal-header {
      margin: 0;
      padding: 20px 24px 18px;
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
      max-height: calc(100vh - 180px);
      overflow-y: auto;
      padding: 18px 24px 20px;
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
        padding: 18px 18px 16px;
      }

      .ant-modal-body {
        max-height: calc(100vh - 164px);
        padding: 14px 16px 16px;
      }

      .ant-modal-footer {
        padding: 12px 16px 14px;
      }
    }
  `,
  createTitle: css`
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 12px;
    padding-inline-end: 36px;
  `,
  createTitleIcon: css`
    display: inline-flex;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusLG + 2}px;
    background: rgba(255, 255, 255, 0.18);
    color: ${token.colorWhite};
    font-size: 18px;
  `,
  createTitleCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  `,
  createTitleText: css`
    color: ${token.colorWhite};
    font-size: 18px;
    line-height: 1.35;
  `,
  createSubtitle: css`
    color: rgba(255, 255, 255, 0.82) !important;
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
  `,
  createForm: css`
    .ant-form-item {
      margin-bottom: 9px;
    }

    .ant-form-item-label {
      padding-bottom: 3px;
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
  createSection: css`
    min-width: 0;
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG + 2}px;
    background: ${token.colorBgContainer};
    box-shadow: 0 8px 24px rgba(31, 51, 89, 0.05);

    & + & {
      margin-top: 14px;
    }

    .ant-form-item:last-child {
      margin-bottom: 0;
    }
  `,
  sectionTitle: css`
    margin: 0 0 12px !important;
    color: ${token.colorPrimary};
    font-size: ${token.fontSizeSM}px !important;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1.5;
  `,
  recipientSummary: css`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid ${token.colorPrimaryBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorPrimaryBg};
    color: ${token.colorPrimary};

    .ant-typography {
      display: block;
      color: ${token.colorPrimary};
      font-size: ${token.fontSizeSM}px;
      line-height: 1.45;
    }
  `,
  recipientStatus: css`
    margin-top: 2px;
    opacity: 0.76;
  `,
  scopeGroup: css`
    display: grid;
    width: 100%;
    gap: 10px;
    grid-template-columns: repeat(3, minmax(0, 1fr));

    .ant-radio-button-wrapper-checked:not(
      .ant-radio-button-wrapper-disabled
    ) {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorPrimaryBg};
      box-shadow: none;
      color: ${token.colorPrimary};

      .${'scopeOptionIcon'} {
        background: ${token.colorPrimary};
        color: ${token.colorWhite};
      }
    }

    @media (max-width: 575px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  scopeFormItem: css`
    && {
      margin-bottom: 8px;
    }
  `,
  scopeOption: css`
    && {
      width: 100%;
      height: auto;
      min-height: 74px;
      padding: 11px 9px;
      border: 1px solid ${token.colorBorderSecondary};
      border-radius: ${token.borderRadiusLG + 2}px;
      line-height: normal;
      text-align: center;
      transition:
        transform 140ms cubic-bezier(0.23, 1, 0.32, 1),
        border-color 140ms ease,
        background-color 140ms ease;
    }

    &&::before {
      display: none;
    }

    &&:active {
      transform: scale(0.98);
    }

    &:hover {
      border-color: ${token.colorPrimary};
      background: ${token.colorPrimaryBg};
    }

    @media (prefers-reduced-motion: reduce) {
      && {
        transition:
          border-color 140ms ease,
          background-color 140ms ease;
      }

      &&:active {
        transform: none;
      }
    }
  `,
  scopeOptionLabel: css`
    overflow: hidden;
    color: currentColor;
    font-size: ${token.fontSizeSM}px;
    font-weight: 650;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  scopeOptionContent: css`
    display: flex;
    min-width: 0;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  `,
  scopeOptionCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 0;
  `,
  scopeOptionIcon: css`
    display: inline-flex;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    align-items: center;
    justify-content: center;
    border-radius: ${token.borderRadiusSM}px;
    background: ${token.colorFillSecondary};
    color: currentColor;
    font-size: 14px;
  `,
  targetLoadError: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 8px;

    .ant-btn {
      height: auto;
      padding: 0;
    }
  `,
  optionalLinkRow: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 1px;
    padding-top: 8px;
    border-top: 1px dashed ${token.colorBorderSecondary};

    .ant-btn {
      flex: 0 0 auto;
      padding-inline: 0;
    }
  `,
  optionalLinkCopy: css`
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;

    .ant-typography-secondary {
      font-size: ${token.fontSizeSM}px;
    }
  `,
  linkFormItem: css`
    && {
      margin-top: 7px;
      margin-bottom: 0;
    }
  `,
  createFooter: css`
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;

    @media (max-width: 575px) {
      gap: 8px;
    }
  `,
  sendButton: css`
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
  detailSummary: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
  `,
  detailBody: css`
    padding: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    white-space: pre-wrap;
    word-break: break-word;
  `,
  targetTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  `,
}));
