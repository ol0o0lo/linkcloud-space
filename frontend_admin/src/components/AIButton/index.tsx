import { Button } from 'antd';
import { createStyles } from 'antd-style';
import type { ComponentProps } from 'react';
import { AppIcon } from '@/components/AppIcon';

export type AIButtonProps = Omit<
  ComponentProps<typeof Button>,
  'type' | 'color' | 'variant' | 'danger' | 'ghost' | 'icon'
>;

const useStyles = createStyles(({ css, token }) => ({
  button: css`
    && {
      --ai-surface: linear-gradient(115deg, ${token['magenta-2']} 0%, ${token['purple-2']} 38%, ${token['blue-2']} 76%, ${token['cyan-1']} 100%);
      --ai-edge: linear-gradient(115deg, ${token['magenta-4']}, ${token['purple-4']} 38%, ${token['blue-4']} 76%, ${token['cyan-3']});
      flex-shrink: 0;
      color: ${token['purple-8']};
      border-color: transparent;
      background: var(--ai-surface) padding-box, var(--ai-edge) border-box;
      box-shadow: none;
      font-weight: 500;
      transition: transform ${token.motionDurationFast} cubic-bezier(0.23, 1, 0.32, 1);

      @media (hover: hover) and (pointer: fine) {
        &:not(:disabled):not(.ant-btn-disabled):not([aria-busy='true']):hover {
          --ai-edge: linear-gradient(115deg, ${token['magenta-5']}, ${token['purple-5']} 38%, ${token['blue-5']} 76%, ${token['cyan-4']});
          color: ${token['purple-8']};
          border-color: transparent;
          background: var(--ai-surface) padding-box, var(--ai-edge) border-box;
        }
      }

      &:not(:disabled):not(.ant-btn-disabled):not([aria-busy='true']):active {
        transform: scale(0.97);
      }

      &:focus-visible {
        outline: 2px solid ${token.colorPrimary};
        outline-offset: 3px;
      }

      &:disabled, &.ant-btn-disabled {
        color: ${token.colorTextDisabled};
        border-color: ${token.colorBorder};
        background: ${token.colorBgContainerDisabled};
      }

      @media (prefers-reduced-motion: reduce) {
        transition: none;
        &:not(:disabled):not(.ant-btn-disabled):not([aria-busy='true']):active { transform: none; }
      }
    }
  `,
}));

/** 统一 AI 操作外观；请求、权限和按钮文案由使用方控制。 */
export default function AIButton({
  className,
  loading,
  ...props
}: AIButtonProps) {
  const { cx, styles } = useStyles();

  return (
    <Button
      {...props}
      color="purple"
      variant="filled"
      className={cx(styles.button, className)}
      icon={<AppIcon name="ai" aria-hidden="true" />}
      loading={loading}
      aria-busy={Boolean(loading)}
    />
  );
}
