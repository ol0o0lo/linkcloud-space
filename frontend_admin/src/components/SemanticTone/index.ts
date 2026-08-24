/** 跨图标与状态展示共享的语义色名称。 */
export type SemanticTone =
  | 'default'
  | 'secondary'
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'disabled';

/** 语义色只映射到 Ant Design token，不在业务定义中写固定色值。 */
export const SEMANTIC_TONE_TOKEN = {
  default: 'colorText',
  secondary: 'colorTextSecondary',
  primary: 'colorPrimary',
  info: 'colorInfo',
  success: 'colorSuccess',
  warning: 'colorWarning',
  error: 'colorError',
  disabled: 'colorTextDisabled',
} as const satisfies Record<SemanticTone, string>;
