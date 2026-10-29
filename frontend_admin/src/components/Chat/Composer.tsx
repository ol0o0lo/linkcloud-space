import { Sender, type SenderProps } from '@ant-design/x';
import { Typography } from 'antd';

export interface ChatComposerProps
  extends Omit<SenderProps, 'value' | 'defaultValue'> {
  value: string;
  maxLength?: number;
  sendDisabled?: boolean;
  inputLabel?: string;
}

export function ChatComposer({
  value,
  maxLength,
  sendDisabled,
  inputLabel = '消息正文',
  disabled,
  readOnly,
  loading,
  footer,
  suffix,
  onSubmit,
  onKeyDown,
  ...sender
}: ChatComposerProps) {
  // Sender 将原生输入属性透传给内置输入框。
  const inputAttributes = { 'aria-label': inputLabel, maxLength };
  const cannotSend =
    Boolean(disabled || readOnly || sendDisabled) ||
    !value.trim() ||
    (maxLength !== undefined && value.length > maxLength);

  const submit: NonNullable<SenderProps['onSubmit']> = (...args) => {
    if (!cannotSend && !loading) onSubmit?.(...args);
  };

  return (
    <Sender
      {...inputAttributes}
      {...sender}
      value={value}
      disabled={disabled}
      readOnly={readOnly}
      loading={loading}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (onKeyDown?.(event) === false || event.nativeEvent.isComposing)
          return false;
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          submit(value);
          return false;
        }
        return undefined;
      }}
      footer={
        footer ??
        ((node, { components: { SendButton } }) => (
          <div className="flex w-full items-center justify-between gap-3">
            <Typography.Text type="secondary" className="text-xs!">
              {maxLength === undefined ? '' : `${value.length} / ${maxLength}`}
            </Typography.Text>
            {loading ? (
              node
            ) : (
              <SendButton aria-label="发送消息" disabled={cannotSend} />
            )}
          </div>
        ))
      }
      suffix={suffix ?? false}
    />
  );
}
