import { Tag, type TagProps, theme } from 'antd';
import type { ReactNode } from 'react';
import { AppIcon } from '@/components/AppIcon';
import type { SemanticTone } from '@/components/SemanticTone';
import { type AppStatusName, useResolvedAppStatus } from './registry';

export type {
  AppStatusDefinition,
  AppStatusDefinitions,
  AppStatusName,
  AppStatusStateDefinition,
  CoreAppStatusName,
  ResolvedAppStatus,
} from './registry';
export {
  APP_STATUS_DEFINITIONS,
  defineAppStatusDefinitions,
  registerAppStatusDefinitions,
  resolveAppStatusDefinition,
} from './registry';

const STATUS_TONE_TAG_COLOR: Record<SemanticTone, string> = {
  default: 'default',
  secondary: 'default',
  primary: 'blue',
  info: 'processing',
  success: 'success',
  warning: 'warning',
  error: 'error',
  disabled: 'default',
};

export type AppStatusTagProps = Omit<
  TagProps,
  'children' | 'color' | 'icon'
> & {
  children: ReactNode;
  name: AppStatusName;
  state: string;
};

/** 统一输出状态文字、状态图标、管理说明和语义色。 */
export function AppStatusTag({
  children,
  name,
  state,
  style,
  title,
  ...props
}: AppStatusTagProps) {
  const definition = useResolvedAppStatus(name, state);
  const resolvedTone = definition.tone;
  const { token } = theme.useToken();
  const neutralToneStyle =
    resolvedTone === 'disabled'
      ? {
          backgroundColor: token.colorFillTertiary,
          borderColor: token.colorBorder,
          color: token.colorTextDisabled,
        }
      : resolvedTone === 'secondary'
        ? {
            backgroundColor: token.colorFillQuaternary,
            borderColor: token.colorBorder,
            color: token.colorTextSecondary,
          }
        : undefined;

  return (
    <Tag
      {...props}
      color={STATUS_TONE_TAG_COLOR[resolvedTone]}
      icon={
        <AppIcon
          contrast={
            resolvedTone === 'secondary' || resolvedTone === 'disabled'
              ? undefined
              : 'light'
          }
          height={16}
          name={name}
          state={state}
          width={16}
        />
      }
      title={title ?? definition.description}
      variant="solid"
      style={{
        ...neutralToneStyle,
        alignItems: 'center',
        display: 'inline-flex',
        gap: token.marginXXS,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
