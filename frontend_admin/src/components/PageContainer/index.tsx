import {
  PageContainer as ProPageContainer,
  type PageContainerProps as ProPageContainerProps,
} from '@ant-design/pro-components';

export type PageContainerProps = ProPageContainerProps & {
  /**
   * 页面默认由面包屑表达当前位置，避免 PageContainer 再渲染一次同名标题。
   * 仅详情页等确实需要独立上下文标题时开启。
   */
  showTitle?: boolean;
};

export function PageContainer({
  showTitle = false,
  title,
  ...props
}: PageContainerProps) {
  return <ProPageContainer {...props} title={showTitle ? title : false} />;
}
