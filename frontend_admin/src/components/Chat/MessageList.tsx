import {
  Bubble,
  type BubbleItemType,
  type BubbleListProps,
} from '@ant-design/x';
import { type ComponentRef, forwardRef } from 'react';

export type ChatMessageItem = BubbleItemType;
export type ChatMessageListRef = ComponentRef<typeof Bubble.List>;

export const ChatMessageList = forwardRef<ChatMessageListRef, BubbleListProps>(
  function ChatMessageList({ autoScroll = false, classNames, ...props }, ref) {
    return (
      <Bubble.List
        {...props}
        ref={ref}
        autoScroll={autoScroll}
        classNames={{
          ...classNames,
          content: ['whitespace-pre-wrap break-words', classNames?.content]
            .filter(Boolean)
            .join(' '),
        }}
      />
    );
  },
);
